import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { animalsApi } from "../../api/animals";
import { realtaApi } from "../../api/realta";
import { apiClient } from "../../api/client";
import { sociosApi } from "../../api/socios";
import { lotesApi } from "../../api/lotes";
import { perfilSocioApi } from "../../api/perfilSocio";
import AnimalStateChip from "../../components/AnimalStateChip";
import SuccessToast from "../../components/SuccessToast";
import {
  CheckCircle2, Loader2, AlertCircle, AlertTriangle,
  Bird, Check, X, ChevronDown, ChevronUp, Link, Link2Off, RefreshCw,
  ExternalLink, ClipboardEdit, ArrowRight, History, Trash2,
} from "lucide-react";
import type { Animal, Conflicto, SolicitudRealta, SolicitudCambioDatos } from "../../types";

export default function ValidacionesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [successMsg, setSuccessMsg] = useState("");

  // Shared expand state for all card types (prefixed keys: a-, c-, r-, cf-)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggleExpand = (key: string) =>
    setExpandedId((prev) => (prev === key ? null : key));

  // ── Validaciones (animales REGISTRADO) ───────────────────────────────────
  const [rejectNotas, setRejectNotas] = useState<Record<string, string>>({});
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveErrors, setApproveErrors] = useState<Record<string, string>>({});

  const { data: validacionesData, isLoading: loadingValidaciones } = useQuery({
    queryKey: ["animals", { estado: "REGISTRADO" }],
    queryFn: () => animalsApi.list({ estado: "REGISTRADO" }),
  });

  const { data: modificadosData } = useQuery({
    queryKey: ["animals", { estado: "MODIFICADO" }],
    queryFn: () => animalsApi.list({ estado: "MODIFICADO" }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => animalsApi.approve(id),
    onMutate: (id: string) => {
      setApprovingId(id);
      setApproveErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    onSuccess: () => {
      setApprovingId(null);
      qc.invalidateQueries({ queryKey: ["animals"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setSuccessMsg("Animal aprobado correctamente.");
    },
    onError: (err: any, id: string) => {
      setApprovingId(null);
      const msg =
        err?.response?.data?.detail ?? "Error al aprobar. Revisa los datos del animal.";
      setApproveErrors((prev) => ({ ...prev, [id]: msg }));
      setTimeout(
        () =>
          setApproveErrors((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          }),
        6000
      );
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, razon }: { id: string; razon: string }) =>
      animalsApi.reject(id, razon),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["animals"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setRejectNotas((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setApproveErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setExpandedId(null);
      setSuccessMsg("Animal rechazado.");
    },
  });

  // ── Conflictos ────────────────────────────────────────────────────────────
  const [conflictoNotas, setConflictoNotas] = useState<Record<string, string>>({});

  const { data: conflictosData, isLoading: loadingConflictos } = useQuery<{
    results: Conflicto[];
  }>({
    queryKey: ["conflictos"],
    queryFn: async () => {
      const { data } = await apiClient.get("/dashboard/conflictos/");
      return data;
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({
      id,
      action,
      notas,
    }: {
      id: string;
      action: string;
      notas: string;
    }) => {
      await apiClient.post(`/dashboard/conflictos/${id}/resolve/`, {
        action,
        notas,
      });
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["conflictos"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setConflictoNotas((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setExpandedId(null);
      setSuccessMsg("Conflicto actualizado.");
    },
  });

  // ── Solicitudes de Re-alta ────────────────────────────────────────────────
  const [realtaActionId, setRealtaActionId] = useState<string | null>(null);
  const [realtaNotas, setRealtaNotas] = useState<Record<string, string>>({});

  const { data: solicitudesRealta = [], isLoading: loadingSolicitudes } = useQuery({
    queryKey: ["solicitudes-realta"],
    queryFn: realtaApi.list,
  });

  const realtaResolveMutation = useMutation({
    mutationFn: ({ id, aprobado }: { id: string; aprobado: boolean }) =>
      realtaApi.resolver(id, aprobado, realtaNotas[id]),
    onSuccess: (_, { aprobado }) => {
      qc.invalidateQueries({ queryKey: ["solicitudes-realta"] });
      qc.invalidateQueries({ queryKey: ["animals"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setRealtaActionId(null);
      setExpandedId(null);
      setSuccessMsg(
        aprobado
          ? "Re-alta aprobada. El animal vuelve al estado Añadido."
          : "Re-alta denegada."
      );
    },
  });

  // ── Solicitudes de cambio de datos ───────────────────────────────────────
  const { data: solicitudesCambio, isLoading: loadingCambios } = useQuery({
    queryKey: ["solicitudes-cambio-datos"],
    queryFn: perfilSocioApi.listSolicitudes,
  });

  const cambioDatosResolveMutation = useMutation({
    mutationFn: ({ id, accion }: { id: string; accion: "aprobar" | "denegar" }) =>
      perfilSocioApi.resolver(id, accion),
    onSuccess: (_, { accion }) => {
      qc.invalidateQueries({ queryKey: ["solicitudes-cambio-datos"] });
      if (accion === "aprobar") {
        qc.invalidateQueries({ queryKey: ["socios"] });
        qc.invalidateQueries({ queryKey: ["socios-all"] });
      }
      setExpandedId(null);
      setSuccessMsg(accion === "aprobar" ? "Datos actualizados correctamente." : "Solicitud denegada.");
    },
  });

  // ── Ganaderías de nacimiento ──────────────────────────────────────────────
  const { data: ganaderiasData, isLoading: loadingGanaderias } = useQuery({
    queryKey: ["ganaderias-nacimiento"],
    queryFn: animalsApi.getGanaderiasNacimiento,
  });

  const { data: sociosData } = useQuery({
    queryKey: ["socios-all"],
    queryFn: () => sociosApi.list({ page: 1, page_size: 500 } as any),
  });

  const ganaderiaMapMutation = useMutation({
    mutationFn: ({ nombre, socio }: { nombre: string; socio: string | null }) =>
      animalsApi.saveGanaderiaMap(nombre, socio),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ganaderias-nacimiento"] });
      qc.invalidateQueries({ queryKey: ["animals"] });
      setSuccessMsg("Redirección guardada.");
    },
  });

  const ganaderiaAceptarMutation = useMutation({
    mutationFn: async (animalIds: string[]) => {
      await Promise.all(animalIds.map((id) => animalsApi.approve(id)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ganaderias-nacimiento"] });
      qc.invalidateQueries({ queryKey: ["animals"] });
      setSuccessMsg("Animales aprobados correctamente.");
    },
  });

  // ── Lotes externos ────────────────────────────────────────────────────────
  const { data: lotesExternosData, isLoading: loadingLotesExternos } = useQuery({
    queryKey: ["lotes-externos"],
    queryFn: animalsApi.getLotesExternos,
  });

  const { data: lotesData } = useQuery({
    queryKey: ["lotes-all"],
    queryFn: lotesApi.list,
  });

  const loteExternoMapMutation = useMutation({
    mutationFn: ({
      descripcion,
      lote,
    }: {
      descripcion: string;
      lote: string | null;
    }) => animalsApi.saveLoteExternoMap(descripcion, lote),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lotes-externos"] });
      qc.invalidateQueries({ queryKey: ["animals"] });
      setSuccessMsg("Redirección guardada.");
    },
  });

  // ── Cesiones pendientes ───────────────────────────────────────────────────
  const [cesionDestinoMap, setCesionDestinoMap] = useState<Record<string, string>>({});

  const { data: cesionesPendientes = [], isLoading: loadingCesiones } = useQuery({
    queryKey: ["cesiones-pendientes"],
    queryFn: animalsApi.getCesionesPendientes,
  });

  const confirmarCesionMutation = useMutation({
    mutationFn: ({ id, socio_destino_id }: { id: string; socio_destino_id: string }) =>
      animalsApi.confirmarCesion(id, socio_destino_id),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["cesiones-pendientes"] });
      qc.invalidateQueries({ queryKey: ["animals"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setCesionDestinoMap((prev) => { const next = { ...prev }; delete next[id]; return next; });
      setSuccessMsg("Cesión confirmada correctamente.");
    },
  });

  const rechazarCesionMutation = useMutation({
    mutationFn: (id: string) => animalsApi.rechazarCesion(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cesiones-pendientes"] });
      qc.invalidateQueries({ queryKey: ["animals"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setSuccessMsg("Cesión rechazada.");
    },
  });

  // ── Revisión de ganaderías en histórico ──────────────────────────────────
  const [historicoFilter, setHistoricoFilter] = useState("");
  const [historicoRemapMap, setHistoricoRemapMap] = useState<Record<string, string>>({});
  const [historicoConfirmDelete, setHistoricoConfirmDelete] = useState<Record<string, boolean>>({});
  const [showKnownSocios, setShowKnownSocios] = useState(false);

  const { data: historicoRevisionData, isLoading: loadingHistoricoRevision } = useQuery({
    queryKey: ["historico-ganaderias-revision"],
    queryFn: animalsApi.getHistoricoRevision,
  });

  type HistoricoEntry = { nombre: string; animal_count: number; is_known_socio: boolean };

  const historicoRemapMutation = useMutation({
    mutationFn: ({ nombre, socio_id }: { nombre: string; socio_id: string }) =>
      animalsApi.historicoRevisionAction({ nombre, accion: "remap", socio_id }),
    onSuccess: (res, { nombre }) => {
      // Remove immediately from cache so it disappears without waiting for refetch
      qc.setQueryData<HistoricoEntry[]>(["historico-ganaderias-revision"], (old) =>
        (old ?? []).filter((h) => h.nombre !== nombre)
      );
      // Background refetch to get accurate counts for the new name
      qc.invalidateQueries({ queryKey: ["historico-ganaderias-revision"] });
      setHistoricoRemapMap((prev) => { const n = { ...prev }; delete n[nombre]; return n; });
      if (res.updated === 0) {
        setSuccessMsg("Remap ejecutado pero no se encontraron animales con ese nombre en el histórico.");
      } else {
        setSuccessMsg(`Remap aplicado en ${res.updated} animal${res.updated !== 1 ? "es" : ""}.`);
      }
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail ?? err?.message ?? "Error al aplicar el remap.";
      setSuccessMsg(`Error: ${detail}`);
    },
  });

  const historicoEliminarMutation = useMutation({
    mutationFn: (nombre: string) =>
      animalsApi.historicoRevisionAction({ nombre, accion: "eliminar" }),
    onSuccess: (res, nombre) => {
      // Remove immediately from cache
      qc.setQueryData<HistoricoEntry[]>(["historico-ganaderias-revision"], (old) =>
        (old ?? []).filter((h) => h.nombre !== nombre)
      );
      qc.invalidateQueries({ queryKey: ["historico-ganaderias-revision"] });
      if (res.updated === 0) {
        setSuccessMsg("Eliminar ejecutado pero no se encontraron animales con ese nombre en el histórico.");
      } else {
        setSuccessMsg(`Entradas eliminadas en ${res.updated} animal${res.updated !== 1 ? "es" : ""}.`);
      }
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail ?? err?.message ?? "Error al eliminar las entradas.";
      setSuccessMsg(`Error: ${detail}`);
    },
  });

  const animals = [
    ...(validacionesData?.results ?? []),
    ...(modificadosData?.results ?? []),
  ];
  const conflictos = conflictosData?.results ?? [];

  const totalPending =
    animals.length +
    conflictos.length +
    solicitudesRealta.length;
  const isLoading =
    loadingValidaciones ||
    loadingConflictos ||
    loadingSolicitudes;

  // ── Sexo chip ─────────────────────────────────────────────────────────────
  const SexoChip = ({ sexo }: { sexo: string }) => (
    <span
      className={`text-xs px-1.5 py-0.5 rounded font-medium ${
        sexo === "M"
          ? "bg-blue-50 text-blue-600"
          : "bg-pink-50 text-pink-600"
      }`}
    >
      {sexo === "M" ? "♂ Macho" : "♀ Hembra"}
    </span>
  );

  // ── Animal photo thumbnail ─────────────────────────────────────────────────
  const AnimalPhoto = ({
    fotos,
    placeholderClass,
    placeholder,
  }: {
    fotos: Animal["fotos"];
    placeholderClass: string;
    placeholder: JSX.Element;
  }) => {
    const perfil = fotos?.find((f) => f.tipo === "PERFIL");
    return (
      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
        {perfil ? (
          <img
            src={perfil.url}
            alt="Perfil"
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center ${placeholderClass}`}
          >
            {placeholder}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <SuccessToast message={successMsg} onDismiss={() => setSuccessMsg("")} />

      <div>
        <h1 className="text-xl font-bold text-gray-900">Validaciones</h1>
        <p className="text-sm text-gray-500">
          {totalPending} elementos pendientes
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-20 animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : totalPending === 0 ? (
        <div className="card text-center py-12">
          <CheckCircle2 size={48} className="text-green-500 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">
            No hay elementos pendientes de validación.
          </p>
        </div>
      ) : (
        <div className="space-y-2">

          {/* ── Animales REGISTRADO ──────────────────────────────────────── */}
          {animals.map((animal) => {
            const key = `a-${animal.id}`;
            const isExpanded = expandedId === key;
            const isApproving = approvingId === animal.id;
            const razon = rejectNotas[animal.id] ?? "";
            return (
              <div key={key} className="card border-l-4 border-blue-400">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <AnimalPhoto
                    fotos={animal.fotos}
                    placeholderClass="bg-blue-50"
                    placeholder={<Bird size={22} className="text-blue-300" />}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-gray-900">
                        {animal.numero_anilla}
                      </span>
                      <span className="text-gray-400 text-sm">
                        (
                        {animal.fecha_nacimiento
                          ? new Date(animal.fecha_nacimiento).getFullYear()
                          : "—"}
                        )
                      </span>
                      <AnimalStateChip estado={animal.estado} />
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                        Nuevo animal
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mt-0.5 flex items-center gap-2 flex-wrap">
                      <SexoChip sexo={animal.sexo} />
                      <span className="text-gray-500">{animal.variedad}</span>
                      <span className="text-gray-400">·</span>
                      <span className="font-medium truncate">
                        {animal.socio_nombre}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleExpand(key)}
                    className="text-gray-400 hover:text-gray-600 p-1 shrink-0 mt-0.5"
                  >
                    {isExpanded ? (
                      <ChevronUp size={18} />
                    ) : (
                      <ChevronDown size={18} />
                    )}
                  </button>
                </div>

                {/* Expanded body */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                    {approveErrors[animal.id] && (
                      <div className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                        <AlertCircle size={13} className="mt-0.5 shrink-0" />
                        {approveErrors[animal.id]}
                      </div>
                    )}
                    {(animal.padre_anilla || animal.madre_anilla) && (
                      <div className="text-sm text-gray-600 flex gap-4 flex-wrap">
                        {animal.padre_anilla && (
                          <span>
                            Padre:{" "}
                            <code className="bg-gray-100 px-1 rounded text-xs">
                              {animal.padre_anilla}
                            </code>
                          </span>
                        )}
                        {animal.madre_anilla && (
                          <span>
                            Madre:{" "}
                            <code className="bg-gray-100 px-1 rounded text-xs">
                              {animal.madre_anilla}
                            </code>
                          </span>
                        )}
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Razón de rechazo{" "}
                        <span className="text-gray-400">
                          (obligatorio para rechazar)
                        </span>
                      </label>
                      <textarea
                        rows={2}
                        className="input-field text-sm resize-none"
                        placeholder="Describe el motivo del rechazo..."
                        value={razon}
                        onChange={(e) =>
                          setRejectNotas((prev) => ({
                            ...prev,
                            [animal.id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="flex gap-2 flex-wrap items-center">
                      <button
                        onClick={() => approveMutation.mutate(animal.id)}
                        disabled={isApproving}
                        className="btn-primary gap-2 bg-green-700 hover:bg-green-800 disabled:opacity-50"
                      >
                        {isApproving ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Check size={16} />
                        )}
                        Aprobar
                      </button>
                      <button
                        onClick={() =>
                          rejectMutation.mutate({ id: animal.id, razon })
                        }
                        disabled={
                          !razon.trim() || rejectMutation.isPending
                        }
                        className="btn-danger gap-2 disabled:opacity-50"
                      >
                        {rejectMutation.isPending ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <X size={16} />
                        )}
                        Rechazar
                      </button>
                      <button
                        onClick={() =>
                          navigate(
                            `/socios/${animal.socio}/animales/${animal.id}`
                          )
                        }
                        className="btn-secondary gap-2 ml-auto"
                      >
                        <ExternalLink size={14} />
                        Ver Ficha
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Solicitudes de Re-alta ───────────────────────────────────── */}
          {solicitudesRealta.map((sol: SolicitudRealta) => {
            const key = `r-${sol.id}`;
            const isExpanded = expandedId === key;
            const isPending =
              realtaActionId === sol.id && realtaResolveMutation.isPending;
            return (
              <div key={key} className="card border-l-4 border-violet-400">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                    <RefreshCw size={22} className="text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-gray-900">
                        {sol.animal_anilla ?? sol.animal}
                      </span>
                      {sol.animal_anio && (
                        <span className="text-gray-400 text-sm">
                          ({sol.animal_anio})
                        </span>
                      )}
                      <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-medium">
                        Solicitud re-alta
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mt-0.5">
                      Solicitante:{" "}
                      <span className="font-medium">
                        {sol.solicitante_nombre}
                      </span>
                      <span className="text-gray-400 ml-2 text-xs">
                        {new Date(sol.created_at).toLocaleDateString("es-ES")}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleExpand(key)}
                    className="text-gray-400 hover:text-gray-600 p-1 shrink-0 mt-0.5"
                  >
                    {isExpanded ? (
                      <ChevronUp size={18} />
                    ) : (
                      <ChevronDown size={18} />
                    )}
                  </button>
                </div>

                {/* Expanded body */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                    {sol.notas && (
                      <div className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 italic">
                        "{sol.notas}"
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Notas de decisión{" "}
                        <span className="text-gray-400">(opcional)</span>
                      </label>
                      <textarea
                        rows={2}
                        className="input-field text-sm resize-none"
                        placeholder="Motivo de aprobación o denegación…"
                        value={realtaNotas[sol.id] ?? ""}
                        onChange={(e) =>
                          setRealtaNotas((prev) => ({
                            ...prev,
                            [sol.id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => {
                          setRealtaActionId(sol.id);
                          realtaResolveMutation.mutate({
                            id: sol.id,
                            aprobado: true,
                          });
                        }}
                        disabled={isPending}
                        className="btn-primary gap-2 bg-green-700 hover:bg-green-800 disabled:opacity-50"
                      >
                        {isPending ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Check size={16} />
                        )}
                        Aprobar re-alta
                      </button>
                      <button
                        onClick={() => {
                          setRealtaActionId(sol.id);
                          realtaResolveMutation.mutate({
                            id: sol.id,
                            aprobado: false,
                          });
                        }}
                        disabled={isPending}
                        className="btn-danger gap-2 disabled:opacity-50"
                      >
                        {isPending ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <X size={16} />
                        )}
                        Denegar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Conflictos de titularidad ─────────────────────────────────── */}
          {conflictos.map((c) => {
            const key = `cf-${c.id}`;
            const isExpanded = expandedId === key;
            const isPending = resolveMutation.isPending;
            return (
              <div key={key} className="card border-l-4 border-amber-400">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                    <AlertTriangle size={22} className="text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-gray-900">
                        {c.numero_anilla}
                      </span>
                      <span className="text-gray-400 text-sm">
                        ({c.anio_nacimiento})
                      </span>
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                        Conflicto titularidad
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mt-0.5 flex gap-3 flex-wrap">
                      <span>
                        <span className="text-gray-400">Actual: </span>
                        <span className="font-medium">
                          {c.socio_actual_nombre}
                        </span>
                      </span>
                      <span>
                        <span className="text-gray-400">Reclamante: </span>
                        <span className="font-medium">
                          {c.socio_reclamante_nombre}
                        </span>
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {new Date(c.created_at).toLocaleDateString("es-ES")}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleExpand(key)}
                    className="text-gray-400 hover:text-gray-600 p-1 shrink-0 mt-0.5"
                  >
                    {isExpanded ? (
                      <ChevronUp size={18} />
                    ) : (
                      <ChevronDown size={18} />
                    )}
                  </button>
                </div>

                {/* Expanded body */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Notas de resolución{" "}
                        <span className="text-gray-400">(opcional)</span>
                      </label>
                      <textarea
                        rows={2}
                        className="input-field text-sm resize-none"
                        placeholder="Descripción de la resolución..."
                        value={conflictoNotas[c.id] ?? ""}
                        onChange={(e) =>
                          setConflictoNotas((prev) => ({
                            ...prev,
                            [c.id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() =>
                          resolveMutation.mutate({
                            id: c.id,
                            action: "resolve",
                            notas: conflictoNotas[c.id] ?? "",
                          })
                        }
                        disabled={isPending}
                        className="btn-primary gap-2 disabled:opacity-50"
                      >
                        {isPending ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Check size={16} />
                        )}
                        Resolver
                      </button>
                      <button
                        onClick={() =>
                          resolveMutation.mutate({
                            id: c.id,
                            action: "discard",
                            notas: conflictoNotas[c.id] ?? "",
                          })
                        }
                        disabled={isPending}
                        className="btn-secondary gap-2 disabled:opacity-50"
                      >
                        {isPending ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <X size={16} />
                        )}
                        Descartar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Solicitudes de cambio de datos ───────────────────────────────── */}
      {loadingCambios ? null : (solicitudesCambio?.results ?? []).length > 0 && (
        <div className="space-y-3">
          {(solicitudesCambio?.results ?? []).map((sol) => {
            const key = `cd-${sol.id}`;
            const isExpanded = expandedId === key;
            const isPending = cambioDatosResolveMutation.isPending;
            const LABELS: Record<string, string> = {
              telefono: "Teléfono", domicilio: "Domicilio", municipio: "Municipio",
              codigo_postal: "Código postal", provincia: "Provincia",
              numero_cuenta: "Nº cuenta", codigo_rega: "Código REGA", email: "Email",
            };
            const cambios = Object.entries(sol.datos_propuestos);
            return (
              <div key={key} className="card border-l-4 border-sky-400">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg bg-sky-50 flex items-center justify-center shrink-0">
                    <ClipboardEdit size={22} className="text-sky-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{sol.socio_nombre}</span>
                      <span className="text-xs text-gray-400">Nº {sol.socio_numero}</span>
                      <span className="text-xs bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded font-medium">
                        Cambio de datos
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 flex gap-2 flex-wrap">
                      <span>{cambios.length} campo{cambios.length !== 1 ? "s" : ""} solicitado{cambios.length !== 1 ? "s" : ""}</span>
                      <span>·</span>
                      <span>{new Date(sol.created_at).toLocaleDateString("es-ES")}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleExpand(key)}
                    className="text-gray-400 hover:text-gray-600 p-1 shrink-0 mt-0.5"
                  >
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                    {/* Tabla de cambios propuestos */}
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Campo</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Valor actual</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Valor propuesto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cambios.map(([field, newVal]) => (
                            <tr key={field} className="border-b border-gray-100 last:border-0">
                              <td className="px-3 py-2 text-gray-600 font-medium">{LABELS[field] ?? field}</td>
                              <td className="px-3 py-2 text-gray-400 line-through">
                                {sol.datos_actuales?.[field] || <span className="italic">vacío</span>}
                              </td>
                              <td className="px-3 py-2 text-gray-900 font-semibold flex items-center gap-1">
                                <ArrowRight size={12} className="text-sky-500 shrink-0" />
                                {newVal || <span className="text-gray-400 italic">vacío</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => cambioDatosResolveMutation.mutate({ id: sol.id, accion: "aprobar" })}
                        disabled={isPending}
                        className="btn-primary gap-2 disabled:opacity-50"
                      >
                        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                        Aprobar y aplicar
                      </button>
                      <button
                        onClick={() => cambioDatosResolveMutation.mutate({ id: sol.id, accion: "denegar" })}
                        disabled={isPending}
                        className="btn-secondary gap-2 disabled:opacity-50"
                      >
                        {isPending ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                        Denegar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Ganaderías de nacimiento ──────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Link size={16} className="text-blue-600" />
          <h2 className="text-base font-semibold text-gray-900">
            Ganaderías de Nacimiento
          </h2>
          <span className="text-xs text-gray-400 ml-auto">
            {ganaderiasData?.length ?? 0} pendientes
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Redirige los nombres de ganadería escritos por los socios hacia el
          socio registrado correspondiente. Desaparecen al aprobar los animales.
        </p>
        {loadingGanaderias ? (
          <div className="flex justify-center py-4">
            <Loader2 size={20} className="animate-spin text-blue-600" />
          </div>
        ) : !ganaderiasData?.length ? (
          <p className="text-sm text-gray-400 text-center py-3">
            No hay ganaderías pendientes de redirigir.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {ganaderiasData.map((g) => (
              <div key={g.ganaderia_nombre} className="py-3 space-y-2">
                {/* Nombre de ganadería + selector de redirección */}
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-gray-900 block">
                      {g.socio_nombre ?? g.ganaderia_nombre}
                    </span>
                    {g.socio_nombre && (
                      <span className="text-xs text-gray-400 block">
                        escrito como: {g.ganaderia_nombre}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {g.animal_count} animal{g.animal_count !== 1 ? "es" : ""} pendiente{g.animal_count !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      className="input-field text-sm py-1 min-w-[180px]"
                      value={g.socio_real ?? ""}
                      onChange={(e) =>
                        ganaderiaMapMutation.mutate({
                          nombre: g.ganaderia_nombre,
                          socio: e.target.value || null,
                        })
                      }
                      disabled={ganaderiaMapMutation.isPending}
                    >
                      <option value="">— Sin redirección —</option>
                      {(sociosData?.results ?? []).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre_razon_social}
                        </option>
                      ))}
                    </select>
                    {g.socio_real && (
                      <>
                        <button
                          onClick={() => navigate(`/socios/${g.socio_real}`)}
                          className="text-blue-500 hover:text-blue-700 p-1"
                          title="Ver ficha del socio redirigido"
                        >
                          <ExternalLink size={14} />
                        </button>
                        <button
                          onClick={() =>
                            ganaderiaMapMutation.mutate({
                              nombre: g.ganaderia_nombre,
                              socio: null,
                            })
                          }
                          disabled={ganaderiaMapMutation.isPending}
                          className="text-gray-400 hover:text-red-500 p-1"
                          title="Quitar redirección"
                        >
                          <Link2Off size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {/* Animales pendientes con esta ganadería */}
                {g.animals.length > 0 && (
                  <div className="ml-1 space-y-1">
                    {g.animals.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-3 py-1.5">
                        <Bird size={12} className="text-gray-400 shrink-0" />
                        <span className="font-mono font-medium text-gray-700">{a.numero_anilla}</span>
                        <AnimalStateChip estado={a.estado} />
                        <span className="text-gray-400 mx-1">·</span>
                        <button
                          onClick={() => navigate(`/socios/${a.socio_id}`)}
                          className="text-blue-600 hover:underline flex items-center gap-1 min-w-0 truncate"
                          title="Ver ficha del socio"
                        >
                          {a.socio_nombre}
                          <ExternalLink size={10} className="shrink-0" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {/* Botón Aceptar: solo disponible cuando hay redirección asignada */}
                {g.socio_real && g.animals.length > 0 && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => ganaderiaAceptarMutation.mutate(g.animals.map((a) => a.id))}
                      disabled={ganaderiaAceptarMutation.isPending}
                      className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                    >
                      {ganaderiaAceptarMutation.isPending
                        ? <Loader2 size={13} className="animate-spin" />
                        : <Check size={13} />}
                      Aceptar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Lotes externos ────────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Link size={16} className="text-emerald-600" />
          <h2 className="text-base font-semibold text-gray-900">
            Lotes de Otra Ganadería
          </h2>
          <span className="text-xs text-gray-400 ml-auto">
            {lotesExternosData?.length ?? 0} distintos
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Redirige las descripciones de lote externo escritas por los socios
          hacia el lote real registrado.
        </p>
        {loadingLotesExternos ? (
          <div className="flex justify-center py-4">
            <Loader2 size={20} className="animate-spin text-emerald-600" />
          </div>
        ) : !lotesExternosData?.length ? (
          <p className="text-sm text-gray-400 text-center py-3">
            No hay lotes externos registrados todavía.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {lotesExternosData.map((le) => (
              <div
                key={le.descripcion}
                className="py-2.5 flex items-center gap-3 flex-wrap"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-900 truncate block">
                    {le.descripcion}
                  </span>
                  <span className="text-xs text-gray-400">
                    {le.animal_count} animal{le.animal_count !== 1 ? "es" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    className="input-field text-sm py-1 min-w-[180px]"
                    value={le.lote_real ?? ""}
                    onChange={(e) =>
                      loteExternoMapMutation.mutate({
                        descripcion: le.descripcion,
                        lote: e.target.value || null,
                      })
                    }
                    disabled={loteExternoMapMutation.isPending}
                  >
                    <option value="">— Sin redirección —</option>
                    {(lotesData?.results ?? []).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nombre}
                        {l.is_closed ? " (Finalizado)" : ""}
                      </option>
                    ))}
                  </select>
                  {le.lote_real && (
                    <button
                      onClick={() =>
                        loteExternoMapMutation.mutate({
                          descripcion: le.descripcion,
                          lote: null,
                        })
                      }
                      disabled={loteExternoMapMutation.isPending}
                      className="text-gray-400 hover:text-red-500 p-1"
                      title="Quitar redirección"
                    >
                      <Link2Off size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Revisión de Ganaderías en Histórico ──────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-1">
          <History size={16} className="text-orange-600" />
          <h2 className="text-base font-semibold text-gray-900">
            Revisión de Ganaderías en Histórico
          </h2>
          <span className="text-xs text-gray-400 ml-auto">
            {(historicoRevisionData ?? []).filter((h) => !h.is_known_socio).length} pendientes
            {" · "}
            {(historicoRevisionData ?? []).length} total
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Solo se muestran los nombres que no coinciden con ningún socio registrado. Mapéalos al socio real o elimínalos si son datos erróneos de la importación.
        </p>
        <div className="flex gap-2 mb-3 flex-wrap">
          <input
            type="text"
            className="input-field text-sm flex-1 min-w-[180px]"
            placeholder="Filtrar por nombre…"
            value={historicoFilter}
            onChange={(e) => setHistoricoFilter(e.target.value)}
          />
          <button
            onClick={() => setShowKnownSocios((v) => !v)}
            className={`btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 ${showKnownSocios ? "bg-orange-50 text-orange-700 border-orange-200" : ""}`}
          >
            {showKnownSocios ? "Ocultar socios conocidos" : "Ver todos"}
          </button>
        </div>
        {(() => {
          if (loadingHistoricoRevision) {
            return (
              <div className="flex justify-center py-4">
                <Loader2 size={20} className="animate-spin text-orange-600" />
              </div>
            );
          }
          const all = historicoRevisionData ?? [];
          const filtered = all
            .filter((h) => showKnownSocios || !h.is_known_socio)
            .filter((h) =>
              !historicoFilter ||
              h.nombre.toLowerCase().includes(historicoFilter.toLowerCase())
            );
          if (all.length === 0) {
            return <p className="text-sm text-gray-400 text-center py-3">No hay datos en el histórico de ganaderías.</p>;
          }
          if (filtered.length === 0) {
            return (
              <div className="text-center py-6">
                <CheckCircle2 size={32} className="text-green-500 mx-auto mb-2" />
                <p className="text-sm text-gray-500 font-medium">
                  {!showKnownSocios
                    ? "Todos los nombres del histórico corresponden a socios registrados."
                    : "No hay nombres que coincidan con el filtro."}
                </p>
              </div>
            );
          }
          return (
            <div className="divide-y divide-gray-100">
              {filtered.map((h) => {
                const isConfirming = !!historicoConfirmDelete[h.nombre];
                const selectedSocioId = historicoRemapMap[h.nombre] ?? "";
                return (
                  <div key={h.nombre} className="py-3 flex flex-wrap items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900 font-mono break-all">
                          {h.nombre}
                        </span>
                        {h.is_known_socio && (
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium shrink-0">
                            Socio conocido
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {h.animal_count} aparición{h.animal_count !== 1 ? "es" : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <select
                        className="input-field text-sm py-1 min-w-[180px]"
                        value={selectedSocioId}
                        onChange={(e) =>
                          setHistoricoRemapMap((prev) => ({ ...prev, [h.nombre]: e.target.value }))
                        }
                        disabled={historicoRemapMutation.isPending}
                      >
                        <option value="">— Seleccionar socio —</option>
                        {(sociosData?.results ?? []).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nombre_razon_social}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          if (!selectedSocioId) return;
                          historicoRemapMutation.mutate({ nombre: h.nombre, socio_id: selectedSocioId });
                        }}
                        disabled={!selectedSocioId || historicoRemapMutation.isPending}
                        className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {historicoRemapMutation.isPending ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Link size={12} />
                        )}
                        Remap
                      </button>
                      {!isConfirming ? (
                        <button
                          onClick={() =>
                            setHistoricoConfirmDelete((prev) => ({ ...prev, [h.nombre]: true }))
                          }
                          className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={12} />
                          Eliminar
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-red-600 font-semibold">¿Seguro?</span>
                          <button
                            onClick={() => {
                              historicoEliminarMutation.mutate(h.nombre);
                              setHistoricoConfirmDelete((prev) => {
                                const n = { ...prev };
                                delete n[h.nombre];
                                return n;
                              });
                            }}
                            disabled={historicoEliminarMutation.isPending}
                            className="btn-danger text-xs py-1 px-2.5 flex items-center gap-1"
                          >
                            {historicoEliminarMutation.isPending ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Check size={12} />
                            )}
                            Sí
                          </button>
                          <button
                            onClick={() =>
                              setHistoricoConfirmDelete((prev) => {
                                const n = { ...prev };
                                delete n[h.nombre];
                                return n;
                              })
                            }
                            className="btn-secondary text-xs py-1 px-2.5"
                          >
                            No
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* ── Cesiones Pendientes ─────────────────────────────────────────── */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <ArrowRight size={16} className="text-purple-600" />
          <h2 className="text-base font-semibold text-gray-900">
            Cesiones Pendientes
          </h2>
          {cesionesPendientes.length > 0 && (
            <span className="ml-1 bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {cesionesPendientes.length}
            </span>
          )}
        </div>

        {loadingCesiones ? (
          <div className="flex justify-center py-6">
            <Loader2 size={22} className="animate-spin text-purple-500" />
          </div>
        ) : cesionesPendientes.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No hay cesiones pendientes</p>
        ) : (
          <div className="space-y-3">
            {cesionesPendientes.map((cesion) => {
              const socioDestinoId = cesionDestinoMap[cesion.id] ?? "";
              return (
                <div key={cesion.id} className="border border-purple-200 rounded-xl p-4 space-y-3 bg-purple-50/30">
                  <div className="flex flex-wrap items-start gap-3 justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-gray-900">{cesion.numero_anilla}</span>
                        <Bird size={13} className="text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {cesion.sexo === "M" ? "♂ Macho" : "♀ Hembra"} · {cesion.variedad}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Cedente: <span className="font-medium text-gray-700">{cesion.socio_cedente_nombre ?? "—"}</span>
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Propuesta: <span className="font-medium italic">"{cesion.cesion_propuesta}"</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="input-field text-sm py-1 flex-1 min-w-[200px]"
                      value={socioDestinoId}
                      onChange={(e) =>
                        setCesionDestinoMap((prev) => ({ ...prev, [cesion.id]: e.target.value }))
                      }
                    >
                      <option value="">— Seleccionar socio destino —</option>
                      {(sociosData?.results ?? []).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre_razon_social} ({s.numero_socio})
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => {
                        if (!socioDestinoId) return;
                        confirmarCesionMutation.mutate({ id: cesion.id, socio_destino_id: socioDestinoId });
                      }}
                      disabled={!socioDestinoId || confirmarCesionMutation.isPending}
                      className="btn-primary text-sm flex items-center gap-1 py-1.5 px-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                    >
                      {confirmarCesionMutation.isPending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Check size={14} />
                      )}
                      Confirmar
                    </button>

                    <button
                      onClick={() => rechazarCesionMutation.mutate(cesion.id)}
                      disabled={rechazarCesionMutation.isPending}
                      className="btn-secondary text-sm flex items-center gap-1 py-1.5 px-3 text-red-600 hover:bg-red-50"
                    >
                      <X size={14} />
                      Rechazar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
