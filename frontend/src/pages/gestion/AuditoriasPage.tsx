import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { auditoriasApi } from "../../api/auditorias";
import { sociosApi } from "../../api/socios";
import type { AuditoriaEstado } from "../../types";
import {
  ClipboardCheck, Plus, Search, ChevronRight,
  Calendar, User, CheckCircle2, Clock, XCircle, Loader2,
} from "lucide-react";

const ESTADO_CONFIG: Record<AuditoriaEstado, { label: string; color: string; icon: React.ReactNode }> = {
  PLANIFICADA: { label: "Planificada",  color: "bg-blue-100 text-blue-800",   icon: <Calendar size={12} /> },
  EN_CURSO:    { label: "En curso",     color: "bg-amber-100 text-amber-800",  icon: <Clock size={12} /> },
  COMPLETADA:  { label: "Completada",   color: "bg-green-100 text-green-800",  icon: <CheckCircle2 size={12} /> },
  CANCELADA:   { label: "Cancelada",    color: "bg-gray-100 text-gray-500",    icon: <XCircle size={12} /> },
};

export default function AuditoriasPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<AuditoriaEstado | "">("");
  const [showNew, setShowNew] = useState(false);

  const { data: auditorias = [], isLoading } = useQuery({
    queryKey: ["auditorias", estadoFilter],
    queryFn: () => auditoriasApi.list(estadoFilter ? { estado: estadoFilter } : undefined),
  });

  const filtered = auditorias.filter(a =>
    !search ||
    a.socio_nombre.toLowerCase().includes(search.toLowerCase()) ||
    a.auditores.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck size={22} className="text-primary" />
            Auditorías de Socios
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Visitas técnicas de evaluación y verificación de animales en instalaciones
          </p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-1.5">
          <Plus size={16} /> Nueva Auditoría
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por socio o auditor..."
            className="input-field pl-9 text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-field text-sm w-44"
          value={estadoFilter}
          onChange={e => setEstadoFilter(e.target.value as AuditoriaEstado | "")}
        >
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-10 text-gray-400">
          <Loader2 size={28} className="animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <ClipboardCheck size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay auditorías</p>
          <p className="text-sm mt-1">Crea la primera con el botón superior</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(a => {
            const cfg = ESTADO_CONFIG[a.estado];
            return (
              <div
                key={a.id}
                onClick={() => navigate(`/auditorias/${a.id}`)}
                className="card flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{a.socio_nombre}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                      {cfg.icon}{cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-0.5 text-xs text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      {new Date(a.fecha_planificada).toLocaleDateString("es-ES")}
                    </span>
                    {a.auditores && (
                      <span className="flex items-center gap-1">
                        <User size={11} />{a.auditores}
                      </span>
                    )}
                    <span>{a.animales_count} animal{a.animales_count !== 1 ? "es" : ""} evaluado{a.animales_count !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
              </div>
            );
          })}
        </div>
      )}

      {/* Modal nueva auditoría */}
      {showNew && (
        <NuevaAuditoriaModal
          onClose={() => setShowNew(false)}
          onCreated={id => {
            qc.invalidateQueries({ queryKey: ["auditorias"] });
            navigate(`/auditorias/${id}`);
          }}
        />
      )}
    </div>
  );
}

// ── Modal nueva auditoría ─────────────────────────────────────────────────────

function NuevaAuditoriaModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [socioId, setSocioId] = useState("");
  const [socioNombre, setSocioNombre] = useState("");
  const [socioSearch, setSocioSearch] = useState("");
  const [fechaPlanificada, setFechaPlanificada] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [auditores, setAuditores] = useState("");
  const [notas, setNotas] = useState("");

  const { data: sociosData } = useQuery({
    queryKey: ["socios-search-audit", socioSearch],
    queryFn: () => sociosApi.list({ search: socioSearch }),
    enabled: socioSearch.length >= 2,
  });
  const socios = sociosData?.results ?? [];

  const mutation = useMutation({
    mutationFn: () =>
      auditoriasApi.create({
        socio: socioId,
        fecha_planificada: fechaPlanificada,
        auditores,
        notas_generales: notas,
      }),
    onSuccess: res => onCreated(res.id),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Nueva Auditoría</h2>
        </div>
        <div className="p-5 space-y-4">
          {/* Socio picker */}
          <div>
            <label className="label">Socio *</label>
            {socioId ? (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm">
                <span className="flex-1 font-medium text-blue-900">{socioNombre}</span>
                <button onClick={() => { setSocioId(""); setSocioNombre(""); }} className="text-blue-400 hover:text-blue-700 text-xs">Cambiar</button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  className="input-field text-sm"
                  placeholder="Buscar socio por nombre o DNI..."
                  value={socioSearch}
                  onChange={e => setSocioSearch(e.target.value)}
                />
                {socios.length > 0 && (
                  <ul className="mt-1 border border-gray-200 rounded-lg bg-white shadow-sm max-h-36 overflow-y-auto divide-y divide-gray-100">
                    {socios.map(s => (
                      <li key={s.id}>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50"
                          onClick={() => { setSocioId(s.id); setSocioNombre(s.nombre_razon_social); setSocioSearch(""); }}
                        >
                          <span className="font-medium">{s.nombre_razon_social}</span>
                          <span className="text-gray-400 ml-2 text-xs">{s.dni_nif}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div>
            <label className="label">Fecha planificada *</label>
            <input
              type="date"
              className="input-field text-sm"
              value={fechaPlanificada}
              onChange={e => setFechaPlanificada(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Auditores (nombres, separados por comas)</label>
            <input
              type="text"
              className="input-field text-sm"
              placeholder="Ej: Juan García, María López"
              value={auditores}
              onChange={e => setAuditores(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Notas generales</label>
            <textarea
              className="input-field text-sm"
              rows={2}
              value={notas}
              onChange={e => setNotas(e.target.value)}
            />
          </div>
        </div>
        <div className="p-5 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!socioId || !fechaPlanificada || mutation.isPending}
            className="btn-primary disabled:opacity-50"
          >
            {mutation.isPending ? <><Loader2 size={15} className="animate-spin" /> Creando...</> : "Crear Auditoría"}
          </button>
        </div>
      </div>
    </div>
  );
}
