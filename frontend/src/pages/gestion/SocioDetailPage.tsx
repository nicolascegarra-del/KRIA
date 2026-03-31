import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sociosApi } from "../../api/socios";
import { animalsApi } from "../../api/animals";
import { granjasApi } from "../../api/granjas";
import { configuracionApi } from "../../api/configuracion";
import { useTenantStore } from "../../store/tenantStore";
import AnimalStateChip from "../../components/AnimalStateChip";
import SuccessToast from "../../components/SuccessToast";
import {
  ArrowLeft,
  Bird,
  Building2,
  Plus,
  Loader2,
  AlertTriangle,
  UserCheck,
  Pencil,
  RefreshCw,
  CheckCircle,
  XCircle,
} from "lucide-react";
import type { Animal, AnimalEstado } from "../../types";
import clsx from "clsx";

const ACTIVO_STATES: AnimalEstado[] = ["REGISTRADO", "APROBADO", "EVALUADO"];
const NO_ACTIVO_STATES: AnimalEstado[] = ["RECHAZADO", "SOCIO_EN_BAJA", "BAJA"];

type Tab = "animales" | "granjas";

export default function SocioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { branding } = useTenantStore();
  const granjasEnabled = branding?.granjas_enabled !== false;
  const [tab, setTab] = useState<Tab>("animales");
  const [animalesSubTab, setAnimalesSubTab] = useState<"activos" | "no_activos">("activos");
  const [successMsg, setSuccessMsg] = useState("");

  // Dar de baja inline form
  const [bajaAnimalId, setBajaAnimalId] = useState<string | null>(null);
  const [bajaFecha, setBajaFecha] = useState(new Date().toISOString().slice(0, 10));
  const [bajaMotivoId, setBajaMotivoId] = useState("");

  const { data: socio, isLoading } = useQuery({
    queryKey: ["socio", id],
    queryFn: () => sociosApi.get(id!),
    enabled: !!id,
  });

  const { data: animalesData } = useQuery({
    queryKey: ["animals", { socio_id: id }],
    queryFn: () => animalsApi.list({ socio_id: id! }),
    enabled: tab === "animales" && !!id,
  });

  const { data: granjasData } = useQuery({
    queryKey: ["granjas", { socio_id: id }],
    queryFn: () => granjasApi.list({ socio_id: id! }),
    enabled: tab === "granjas" && !!id,
  });

  const reactivarMutation = useMutation({
    mutationFn: () => sociosApi.reactivar(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["socio", id] });
      setSuccessMsg("Socio reactivado correctamente.");
    },
  });

  const reactivarAnimalMutation = useMutation({
    mutationFn: (animalId: string) => animalsApi.reactivar(animalId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["animals", { socio_id: id }] });
      setSuccessMsg("Animal reactivado correctamente. Pendiente de aprobación.");
    },
  });

  const darBajaMutation = useMutation({
    mutationFn: ({ animalId, fecha_baja, motivo_baja }: { animalId: string; fecha_baja: string; motivo_baja: string }) =>
      animalsApi.darBaja(animalId, fecha_baja, motivo_baja),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["animals", { socio_id: id }] });
      setBajaAnimalId(null);
      setBajaMotivoId("");
      setSuccessMsg("Animal dado de baja correctamente.");
    },
  });

  const { data: motivosBaja = [] } = useQuery({
    queryKey: ["motivos-baja"],
    queryFn: configuracionApi.listMotivosBaja,
    enabled: tab === "animales",
  });

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "animales", label: "Animales", icon: <Bird size={15} /> },
    ...(granjasEnabled ? [{ key: "granjas" as Tab, label: "Granjas", icon: <Building2 size={15} /> }] : []),
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={32} className="animate-spin text-blue-700" />
      </div>
    );
  }

  if (!socio) {
    return (
      <div className="card text-center py-12 text-gray-500">Socio no encontrado.</div>
    );
  }

  const animales = animalesData?.results ?? [];
  const granjas = granjasData?.results ?? [];
  const animalesActivos = animales.filter((a: Animal) => ACTIVO_STATES.includes(a.estado));
  const animalesNoActivos = animales.filter((a: Animal) => NO_ACTIVO_STATES.includes(a.estado));

  return (
    <div className="space-y-4 max-w-3xl">
      <SuccessToast message={successMsg} onDismiss={() => setSuccessMsg("")} />

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/socios")}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Volver"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{socio.nombre_razon_social}</h1>
          <p className="text-sm text-gray-500">{socio.email || "Sin email"}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span
            className={clsx(
              "text-xs font-semibold px-2.5 py-1 rounded-full",
              socio.estado === "ALTA" ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"
            )}
          >
            {socio.estado}
          </span>
          {socio.has_portal_access ? (
            <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
              <CheckCircle size={12} /> Acceso al portal
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-200">
              <XCircle size={12} /> Sin acceso al portal
            </span>
          )}
        </div>
        {socio.estado === "BAJA" && (
          <button
            onClick={() => reactivarMutation.mutate()}
            disabled={reactivarMutation.isPending}
            className="btn-secondary flex items-center gap-2 text-sm text-green-700 border-green-300 hover:bg-green-50 disabled:opacity-40"
          >
            {reactivarMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
            Reactivar
          </button>
        )}
        <button
          onClick={() => navigate(`/socios/${id}/nuevo-animal`)}
          className="btn-primary gap-2 flex items-center text-sm"
        >
          <Plus size={15} /> Dar de alta animal
        </button>
      </div>

      {/* Datos del socio */}
      <div className="card">
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {[
            { label: "DNI / NIF", value: socio.dni_nif || "—" },
            { label: "Nº Socio", value: socio.numero_socio || "—" },
            { label: "Código REGA", value: socio.codigo_rega || "—" },
            { label: "Fecha de alta", value: socio.fecha_alta ? new Date(socio.fecha_alta).toLocaleDateString("es-ES") : "—" },
            { label: "Teléfono", value: socio.telefono || "—" },
            { label: "Nombre", value: socio.full_name || "—" },
            { label: "Cuota pagada hasta", value: socio.cuota_anual_pagada ? String(socio.cuota_anual_pagada) : "—" },
            { label: "Domicilio", value: socio.domicilio || "—" },
            { label: "Municipio", value: socio.municipio || "—" },
            { label: "Código postal", value: socio.codigo_postal || "—" },
            { label: "Provincia", value: socio.provincia || "—" },
            { label: "Nº Cuenta (IBAN)", value: socio.numero_cuenta || "—" },
          ].map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-gray-400">{label}</dt>
              <dd className="font-medium text-gray-800 truncate">{value}</dd>
            </div>
          ))}
          {socio.estado === "BAJA" && socio.razon_baja && (
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-xs text-gray-400">Razón de baja</dt>
              <dd className="text-red-700">{socio.razon_baja}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              tab === t.key ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Animales */}
      {tab === "animales" && (
        <div className="card space-y-3">
          {/* Sub-tabs activos / no activos */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => setAnimalesSubTab("activos")}
              className={clsx(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                animalesSubTab === "activos" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              )}
            >
              Activos ({animalesActivos.length})
            </button>
            <button
              onClick={() => setAnimalesSubTab("no_activos")}
              className={clsx(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                animalesSubTab === "no_activos" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              )}
            >
              No activos ({animalesNoActivos.length})
            </button>
          </div>

          {animalesSubTab === "activos" && (
            animalesActivos.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Bird size={36} className="mx-auto mb-2 text-gray-300" />
                <p>No hay animales activos.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {animalesActivos.map((a: Animal) => (
                  <div key={a.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="font-mono font-medium text-gray-900">{a.numero_anilla}</span>
                        <span className="text-sm text-gray-500 ml-2">
                          / {a.fecha_nacimiento ? new Date(a.fecha_nacimiento).getFullYear() : "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{a.variedad}</span>
                        <AnimalStateChip estado={a.estado} />
                        <button
                          onClick={() => navigate(`/socios/${id}/animales/${a.id}`)}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                          title="Ver / Editar"
                        >
                          <Pencil size={12} />
                          Ver/Editar
                        </button>
                        <button
                          onClick={() => {
                            setBajaAnimalId(a.id);
                            setBajaFecha(new Date().toISOString().slice(0, 10));
                            setBajaMotivoId("");
                          }}
                          className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 px-2 py-1 rounded hover:bg-orange-50"
                          title="Dar de baja"
                        >
                          <AlertTriangle size={12} />
                          Dar de baja
                        </button>
                      </div>
                    </div>
                    {/* Inline dar de baja form */}
                    {bajaAnimalId === a.id && (
                      <div className="mt-2 bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-medium text-orange-800">Confirmar baja del animal</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Fecha de baja</label>
                            <input
                              type="date"
                              className="input-field text-xs"
                              value={bajaFecha}
                              onChange={(e) => setBajaFecha(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Motivo</label>
                            <select
                              className="input-field text-xs"
                              value={bajaMotivoId}
                              onChange={(e) => setBajaMotivoId(e.target.value)}
                            >
                              <option value="">Seleccionar...</option>
                              {motivosBaja.filter(m => m.is_active).map((m) => (
                                <option key={m.id} value={m.id}>{m.nombre}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => darBajaMutation.mutate({ animalId: a.id, fecha_baja: bajaFecha, motivo_baja: bajaMotivoId })}
                            disabled={!bajaFecha || !bajaMotivoId || darBajaMutation.isPending}
                            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                          >
                            {darBajaMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : null}
                            Confirmar
                          </button>
                          <button
                            onClick={() => { setBajaAnimalId(null); setBajaMotivoId(""); }}
                            className="btn-secondary text-xs py-1.5 px-3"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}

          {animalesSubTab === "no_activos" && (
            animalesNoActivos.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Bird size={36} className="mx-auto mb-2 text-gray-300" />
                <p>No hay animales no activos.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {animalesNoActivos.map((a: Animal) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div>
                      <span className="font-mono font-medium text-gray-900">{a.numero_anilla}</span>
                      <span className="text-sm text-gray-500 ml-2">
                        / {a.fecha_nacimiento ? new Date(a.fecha_nacimiento).getFullYear() : "—"}
                      </span>
                      {a.estado === "BAJA" && a.motivo_baja_nombre && (
                        <span className="text-xs text-gray-400 ml-2">({a.motivo_baja_nombre})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{a.variedad}</span>
                      <AnimalStateChip estado={a.estado} />
                      <button
                        onClick={() => navigate(`/socios/${id}/animales/${a.id}`)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                        title="Ver / Editar"
                      >
                        <Pencil size={12} />
                        Ver/Editar
                      </button>
                      <button
                        onClick={() => reactivarAnimalMutation.mutate(a.id)}
                        disabled={reactivarAnimalMutation.isPending}
                        className="flex items-center gap-1 text-xs text-green-700 hover:text-green-900 px-2 py-1 rounded hover:bg-green-50 disabled:opacity-40"
                        title="Reactivar animal"
                      >
                        {reactivarAnimalMutation.isPending
                          ? <Loader2 size={12} className="animate-spin" />
                          : <RefreshCw size={12} />}
                        Reactivar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Tab: Granjas */}
      {tab === "granjas" && (
        <div className="card">
          {granjas.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Building2 size={36} className="mx-auto mb-2 text-gray-300" />
              <p>No hay granjas registradas.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {granjas.map((g) => (
                <div key={g.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="font-medium text-gray-900">{g.nombre}</div>
                  {g.codigo_rega && (
                    <div className="text-xs text-gray-400 mt-0.5">REGA: {g.codigo_rega}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
