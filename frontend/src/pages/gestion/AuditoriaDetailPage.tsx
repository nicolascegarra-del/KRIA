import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { auditoriasApi } from "../../api/auditorias";
import { animalsApi } from "../../api/animals";
import type {
  AuditoriaEstado, AuditoriaAnimal, CriterioEvaluacion, PreguntaInstalacion,
} from "../../types";
import {
  ArrowLeft, ClipboardCheck, Plus, Trash2, Save, Loader2,
  CheckCircle2, Clock, XCircle, Calendar, ChevronDown, ChevronUp,
  Search, Bird,
} from "lucide-react";

const ESTADO_OPTS: { value: AuditoriaEstado; label: string }[] = [
  { value: "PLANIFICADA",  label: "Planificada" },
  { value: "EN_CURSO",     label: "En curso" },
  { value: "COMPLETADA",   label: "Completada" },
  { value: "CANCELADA",    label: "Cancelada" },
];

const ESTADO_COLOR: Record<AuditoriaEstado, string> = {
  PLANIFICADA: "bg-blue-100 text-blue-800",
  EN_CURSO:    "bg-amber-100 text-amber-800",
  COMPLETADA:  "bg-green-100 text-green-800",
  CANCELADA:   "bg-gray-100 text-gray-500",
};

export default function AuditoriaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"animales" | "instalaciones">("animales");
  const [showAddAnimal, setShowAddAnimal] = useState(false);

  const { data: auditoria, isLoading } = useQuery({
    queryKey: ["auditoria", id],
    queryFn: () => auditoriasApi.get(id!),
    enabled: !!id,
  });

  const { data: criterios = [] } = useQuery({
    queryKey: ["criterios"],
    queryFn: auditoriasApi.criterios.list,
  });

  const { data: preguntas = [] } = useQuery({
    queryKey: ["preguntas-instalacion"],
    queryFn: auditoriasApi.preguntas.list,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<typeof auditoria>) =>
      auditoriasApi.update(id!, payload as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auditoria", id] }),
  });

  const deleteAnimalMutation = useMutation({
    mutationFn: (animalId: string) => auditoriasApi.animales.delete(id!, animalId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auditoria", id] }),
  });

  if (isLoading || !auditoria) {
    return (
      <div className="flex justify-center py-20 text-gray-400">
        <Loader2 size={32} className="animate-spin" />
      </div>
    );
  }

  const activeCriterios = criterios.filter(c => c.is_active);
  const activePreguntas = preguntas.filter(p => p.is_active);

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate("/auditorias")} className="mt-0.5 text-gray-400 hover:text-gray-700">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">
              Auditoría — {auditoria.socio_nombre}
            </h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLOR[auditoria.estado]}`}>
              {ESTADO_OPTS.find(o => o.value === auditoria.estado)?.label}
            </span>
          </div>
          <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
            <Calendar size={12} />
            {new Date(auditoria.fecha_planificada).toLocaleDateString("es-ES")}
            {auditoria.auditores && ` · ${auditoria.auditores}`}
          </p>
        </div>
        {/* Cambio de estado */}
        <select
          className="input-field text-sm w-36"
          value={auditoria.estado}
          onChange={e =>
            updateMutation.mutate({ estado: e.target.value as AuditoriaEstado })
          }
        >
          {ESTADO_OPTS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {([
          { key: "animales",      label: `Animales (${auditoria.animales_evaluados.length})` },
          { key: "instalaciones", label: `Instalaciones` },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Animales ─────────────────────────────────────────────────────── */}
      {activeTab === "animales" && (
        <div className="space-y-4">
          {activeCriterios.length === 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No hay criterios de evaluación configurados. Configúralos en el panel de superadmin → asociación → Auditorías.
            </div>
          )}

          {/* Animales ya evaluados */}
          <div className="space-y-3">
            {auditoria.animales_evaluados.map(av => (
              <AnimalEvaluadoCard
                key={av.id}
                item={av}
                criterios={activeCriterios}
                auditoriaId={id!}
                onDelete={() => deleteAnimalMutation.mutate(av.id)}
                onUpdated={() => qc.invalidateQueries({ queryKey: ["auditoria", id] })}
              />
            ))}
          </div>

          <button
            onClick={() => setShowAddAnimal(true)}
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <Plus size={15} /> Añadir animal a evaluar
          </button>

          {showAddAnimal && (
            <AddAnimalPanel
              auditoriaId={id!}
              criterios={activeCriterios}
              socioId={auditoria.socio}
              onDone={() => {
                setShowAddAnimal(false);
                qc.invalidateQueries({ queryKey: ["auditoria", id] });
              }}
              onCancel={() => setShowAddAnimal(false)}
            />
          )}
        </div>
      )}

      {/* ── Tab: Instalaciones ────────────────────────────────────────────────── */}
      {activeTab === "instalaciones" && (
        <InstalacionesForm
          auditoriaId={id!}
          preguntas={activePreguntas}
          existentes={auditoria.respuestas_instalacion}
          onSaved={() => qc.invalidateQueries({ queryKey: ["auditoria", id] })}
        />
      )}
    </div>
  );
}

// ── Tarjeta de animal evaluado ────────────────────────────────────────────────

function AnimalEvaluadoCard({
  item,
  criterios,
  auditoriaId,
  onDelete,
  onUpdated,
}: {
  item: AuditoriaAnimal;
  criterios: CriterioEvaluacion[];
  auditoriaId: string;
  onDelete: () => void;
  onUpdated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [puntuaciones, setPuntuaciones] = useState<Record<string, number>>(item.puntuaciones);
  const [notas, setNotas] = useState(item.notas);
  const [dirty, setDirty] = useState(false);

  const updateMutation = useMutation({
    mutationFn: () =>
      auditoriasApi.animales.update(auditoriaId, item.id, { puntuaciones, notas }),
    onSuccess: () => { setDirty(false); onUpdated(); },
  });

  const porcentaje = item.porcentaje;
  const color =
    porcentaje === null ? "text-gray-400" :
    porcentaje >= 75 ? "text-green-600" :
    porcentaje >= 50 ? "text-amber-600" : "text-red-600";

  return (
    <div className="card">
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <Bird size={16} className="text-gray-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-mono font-semibold text-gray-900">
            {item.animal_anilla || item.numero_anilla_manual || "—"}
          </span>
        </div>
        <span className={`text-sm font-bold ${color}`}>
          {porcentaje !== null ? `${porcentaje}%` : "—"}
        </span>
        <span className="text-xs text-gray-400">
          {item.puntuacion_total}/{item.puntuacion_maxima}
        </span>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-gray-100 pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {criterios.map(c => (
              <div key={c.id}>
                <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                  <span>{c.nombre}</span>
                  <span className="text-gray-400">×{c.multiplicador}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={puntuaciones[c.id] ?? 0}
                  onChange={e => {
                    setPuntuaciones(p => ({ ...p, [c.id]: parseInt(e.target.value) }));
                    setDirty(true);
                  }}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>0</span>
                  <span className="font-bold text-gray-700">{puntuaciones[c.id] ?? 0}</span>
                  <span>10</span>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="label text-xs">Notas</label>
            <textarea
              className="input-field text-sm"
              rows={2}
              value={notas}
              onChange={e => { setNotas(e.target.value); setDirty(true); }}
            />
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={e => { e.stopPropagation(); onDelete(); }}
              className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
            >
              <Trash2 size={13} /> Eliminar
            </button>
            {dirty && (
              <button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="btn-primary text-xs py-1 px-3 flex items-center gap-1"
              >
                {updateMutation.isPending
                  ? <><Loader2 size={12} className="animate-spin" /> Guardando...</>
                  : <><Save size={12} /> Guardar</>
                }
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Panel para añadir animal ──────────────────────────────────────────────────

function AddAnimalPanel({
  auditoriaId,
  criterios,
  socioId,
  onDone,
  onCancel,
}: {
  auditoriaId: string;
  criterios: CriterioEvaluacion[];
  socioId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"existente" | "manual">("existente");
  const [animalId, setAnimalId] = useState("");
  const [animalLabel, setAnimalLabel] = useState("");
  const [anillaManual, setAnillaManual] = useState("");
  const [searchAnilla, setSearchAnilla] = useState("");
  const [searchAnio, setSearchAnio] = useState(String(new Date().getFullYear()));
  const [puntuaciones, setPuntuaciones] = useState<Record<string, number>>({});
  const [notas, setNotas] = useState("");

  const { data: searchResults, isFetching } = useQuery({
    queryKey: ["animals-search-audit-add", searchAnilla, searchAnio],
    queryFn: () =>
      animalsApi.searchGlobal(searchAnilla, parseInt(searchAnio, 10)),
    enabled: searchAnilla.length >= 2 && !!searchAnio,
  });

  const mutation = useMutation({
    mutationFn: () =>
      auditoriasApi.animales.create(auditoriaId, {
        animal: mode === "existente" ? animalId || null : null,
        numero_anilla_manual: mode === "manual" ? anillaManual : "",
        puntuaciones,
        notas,
      }),
    onSuccess: onDone,
  });

  const canSubmit =
    (mode === "existente" && !!animalId) ||
    (mode === "manual" && !!anillaManual.trim());

  return (
    <div className="card border-2 border-primary/20 bg-primary/5 space-y-4">
      <div className="flex gap-3">
        <button
          onClick={() => setMode("existente")}
          className={`text-sm px-3 py-1 rounded-lg border transition-colors ${
            mode === "existente"
              ? "bg-primary text-white border-primary"
              : "bg-white text-gray-600 border-gray-200"
          }`}
        >
          Animal ya registrado
        </button>
        <button
          onClick={() => setMode("manual")}
          className={`text-sm px-3 py-1 rounded-lg border transition-colors ${
            mode === "manual"
              ? "bg-primary text-white border-primary"
              : "bg-white text-gray-600 border-gray-200"
          }`}
        >
          Dar de alta en el momento
        </button>
      </div>

      {mode === "existente" && (
        animalId ? (
          <div className="flex items-center gap-2 bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm">
            <span className="flex-1 font-mono font-medium text-blue-800">{animalLabel}</span>
            <button onClick={() => { setAnimalId(""); setAnimalLabel(""); }} className="text-blue-400 hover:text-blue-700 text-xs">Cambiar</button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  className="input-field pl-8 text-sm font-mono"
                  placeholder="Nº anilla"
                  value={searchAnilla}
                  onChange={e => setSearchAnilla(e.target.value)}
                />
              </div>
              <input
                type="number"
                className="input-field w-20 text-sm"
                placeholder="Año"
                value={searchAnio}
                onChange={e => setSearchAnio(e.target.value)}
                min={2000}
                max={new Date().getFullYear()}
              />
              {isFetching && <Loader2 size={14} className="animate-spin self-center text-gray-400" />}
            </div>
            {searchResults && searchResults.length > 0 && (
              <ul className="bg-white border border-gray-200 rounded-lg shadow-sm divide-y divide-gray-100 max-h-32 overflow-y-auto">
                {searchResults.map(a => (
                  <li key={a.id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex gap-2"
                      onClick={() => {
                        setAnimalId(a.id);
                        setAnimalLabel(`${a.numero_anilla} / ${a.fecha_nacimiento ? new Date(a.fecha_nacimiento).getFullYear() : "—"}`);
                        setSearchAnilla("");
                      }}
                    >
                      <span className="font-mono font-medium">{a.numero_anilla}</span>
                      <span className="text-gray-400">{a.fecha_nacimiento ? new Date(a.fecha_nacimiento).getFullYear() : "—"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      )}

      {mode === "manual" && (
        <div>
          <label className="label text-xs">Nº de anilla *</label>
          <input
            type="text"
            className="input-field text-sm font-mono"
            placeholder="Introduce el número de anilla"
            value={anillaManual}
            onChange={e => setAnillaManual(e.target.value)}
          />
          <p className="text-xs text-amber-700 mt-1">
            Este animal se registrará como evaluado en la auditoría. Recuerda darlo de alta en el sistema después.
          </p>
        </div>
      )}

      {/* Criterios de evaluación */}
      {criterios.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Puntuaciones</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {criterios.map(c => (
              <div key={c.id}>
                <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                  <span>{c.nombre}</span>
                  <span className="text-gray-400">×{c.multiplicador}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={puntuaciones[c.id] ?? 0}
                  onChange={e =>
                    setPuntuaciones(p => ({ ...p, [c.id]: parseInt(e.target.value) }))
                  }
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>0</span>
                  <span className="font-bold text-gray-700">{puntuaciones[c.id] ?? 0}</span>
                  <span>10</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="label text-xs">Notas</label>
        <textarea className="input-field text-sm" rows={2} value={notas} onChange={e => setNotas(e.target.value)} />
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn-secondary text-sm">Cancelar</button>
        <button
          onClick={() => mutation.mutate()}
          disabled={!canSubmit || mutation.isPending}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {mutation.isPending ? <><Loader2 size={13} className="animate-spin" /> Guardando...</> : "Guardar evaluación"}
        </button>
      </div>
    </div>
  );
}

// ── Formulario instalaciones ──────────────────────────────────────────────────

function InstalacionesForm({
  auditoriaId,
  preguntas,
  existentes,
  onSaved,
}: {
  auditoriaId: string;
  preguntas: PreguntaInstalacion[];
  existentes: { pregunta: string; respuesta: string }[];
  onSaved: () => void;
}) {
  const [respuestas, setRespuestas] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    existentes.forEach(r => { map[r.pregunta] = r.respuesta; });
    return map;
  });

  // Sincroniza cuando lleguen datos frescos
  useEffect(() => {
    const map: Record<string, string> = {};
    existentes.forEach(r => { map[r.pregunta] = r.respuesta; });
    setRespuestas(map);
  }, [existentes.length]);

  const mutation = useMutation({
    mutationFn: () =>
      auditoriasApi.respuestas.save(
        auditoriaId,
        Object.entries(respuestas).map(([pregunta, respuesta]) => ({ pregunta, respuesta }))
      ),
    onSuccess: onSaved,
  });

  if (preguntas.length === 0) {
    return (
      <div className="card text-center py-10 text-gray-400">
        <p className="font-medium">No hay preguntas configuradas</p>
        <p className="text-sm mt-1">Configúralas en el panel de superadmin → asociación → Auditorías</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {preguntas.map(p => (
        <div key={p.id} className="card">
          <p className="text-sm font-medium text-gray-800 mb-2">{p.texto}</p>
          {p.tipo === "SINO" && (
            <div className="flex gap-3">
              {["si", "no"].map(v => (
                <label key={v} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name={p.id}
                    value={v}
                    checked={respuestas[p.id] === v}
                    onChange={() => setRespuestas(r => ({ ...r, [p.id]: v }))}
                    className="accent-primary"
                  />
                  {v === "si" ? "Sí" : "No"}
                </label>
              ))}
            </div>
          )}
          {p.tipo === "TEXTO" && (
            <textarea
              className="input-field text-sm"
              rows={3}
              value={respuestas[p.id] ?? ""}
              onChange={e => setRespuestas(r => ({ ...r, [p.id]: e.target.value }))}
              placeholder="Descripción..."
            />
          )}
          {p.tipo === "PUNTUACION" && (
            <div>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={parseInt(respuestas[p.id] ?? "0")}
                onChange={e => setRespuestas(r => ({ ...r, [p.id]: e.target.value }))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>0</span>
                <span className="font-bold text-gray-700">{respuestas[p.id] ?? "0"}</span>
                <span>10</span>
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="flex justify-end">
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="btn-primary flex items-center gap-1.5"
        >
          {mutation.isPending
            ? <><Loader2 size={15} className="animate-spin" /> Guardando...</>
            : <><Save size={15} /> Guardar respuestas</>
          }
        </button>
      </div>
    </div>
  );
}
