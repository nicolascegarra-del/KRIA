import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { animalsApi } from "../../api/animals";
import { reproductoresApi } from "../../api/reproductores";
import { apiClient } from "../../api/client";
import AnimalStateChip from "../../components/AnimalStateChip";
import SuccessToast from "../../components/SuccessToast";
import {
  CheckCircle2, XCircle, Loader2, AlertCircle, AlertTriangle,
  Bird, Check, X, ChevronDown, ChevronUp,
} from "lucide-react";
import type { Animal, Conflicto } from "../../types";

export default function ValidacionesPage() {
  const qc = useQueryClient();
  const [successMsg, setSuccessMsg] = useState("");

  // ── Validaciones (animales AÑADIDO) ──────────────────────────────────────
  const [rejectModal, setRejectModal] = useState<Animal | null>(null);
  const [razonRechazo, setRazonRechazo] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveErrors, setApproveErrors] = useState<Record<string, string>>({});

  const { data: validacionesData, isLoading: loadingValidaciones } = useQuery({
    queryKey: ["animals", { estado: "AÑADIDO" }],
    queryFn: () => animalsApi.list({ estado: "AÑADIDO" }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => {
      setApprovingId(id);
      setApproveErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });
      return animalsApi.approve(id);
    },
    onSuccess: (_, id) => {
      setApprovingId(null);
      qc.invalidateQueries({ queryKey: ["animals"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setSuccessMsg("Animal aprobado correctamente.");
    },
    onError: (err: any, id: string) => {
      setApprovingId(null);
      const msg = err?.response?.data?.detail ?? "Error al aprobar. Comprueba que tiene las 3 fotos obligatorias.";
      setApproveErrors((prev) => ({ ...prev, [id]: msg }));
      setTimeout(() => setApproveErrors((prev) => { const next = { ...prev }; delete next[id]; return next; }), 6000);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, razon }: { id: string; razon: string }) => animalsApi.reject(id, razon),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["animals"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setRejectModal(null);
      setRazonRechazo("");
      setSuccessMsg("Animal rechazado.");
    },
  });

  // ── Candidatos a reproductor ──────────────────────────────────────────────
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [candidatoNotas, setCandidatoNotas] = useState<Record<string, string>>({});
  const [actionId, setActionId] = useState<string | null>(null);

  const { data: candidatosData, isLoading: loadingCandidatos } = useQuery({
    queryKey: ["candidatos-reproductor"],
    queryFn: () => reproductoresApi.candidatos(),
  });

  const candidatoMutation = useMutation({
    mutationFn: ({ id, aprobado }: { id: string; aprobado: boolean }) =>
      reproductoresApi.aprobar(id, aprobado, candidatoNotas[id]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidatos-reproductor"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setActionId(null);
      setSuccessMsg("Candidato procesado.");
    },
  });

  // ── Conflictos ────────────────────────────────────────────────────────────
  const [conflictoModal, setConflictoModal] = useState<{ conflicto: Conflicto; action: "resolve" | "discard" } | null>(null);
  const [conflictoNotas, setConflictoNotas] = useState("");

  const { data: conflictosData, isLoading: loadingConflictos } = useQuery<{ results: Conflicto[] }>({
    queryKey: ["conflictos"],
    queryFn: async () => { const { data } = await apiClient.get("/dashboard/conflictos/"); return data; },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, action, notas }: { id: string; action: string; notas: string }) => {
      await apiClient.post(`/dashboard/conflictos/${id}/resolve/`, { action, notas });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conflictos"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setConflictoModal(null);
      setSuccessMsg("Conflicto actualizado.");
    },
  });

  const animals = validacionesData?.results ?? [];
  const candidatos: Animal[] = candidatosData?.results ?? [];
  const conflictos = conflictosData?.results ?? [];

  const totalPending = animals.length + candidatos.length + conflictos.length;
  const isLoading = loadingValidaciones || loadingCandidatos || loadingConflictos;

  return (
    <div className="space-y-4">
      <SuccessToast message={successMsg} onDismiss={() => setSuccessMsg("")} />

      <div>
        <h1 className="text-xl font-bold text-gray-900">Validaciones</h1>
        <p className="text-sm text-gray-500">{totalPending} elementos pendientes</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="card h-20 animate-pulse bg-gray-100" />)}
        </div>
      ) : totalPending === 0 ? (
        <div className="card text-center py-12">
          <CheckCircle2 size={48} className="text-green-500 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No hay elementos pendientes de validación.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* ── Animales AÑADIDO ─────────────────────────────────────────── */}
          {animals.map((animal) => (
            <div key={animal.id} className="card">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-gray-900">{animal.numero_anilla}</span>
                    <span className="text-sm text-gray-500">/ {animal.fecha_nacimiento ? new Date(animal.fecha_nacimiento).getFullYear() : "—"}</span>
                    <AnimalStateChip estado={animal.estado} />
                  </div>
                  <div className="text-sm text-gray-600">
                    {animal.sexo === "M" ? "♂" : "♀"} · {animal.variedad} · <strong>{animal.socio_nombre}</strong>
                  </div>
                  {approveErrors[animal.id] && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                      <AlertCircle size={13} className="mt-0.5 shrink-0" />
                      {approveErrors[animal.id]}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => approveMutation.mutate(animal.id)}
                    disabled={approvingId === animal.id}
                    className="p-2 rounded-lg bg-green-700 text-white hover:bg-green-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Aprobar"
                  >
                    {approvingId === animal.id ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                  </button>
                  <button
                    onClick={() => { setRejectModal(animal); setRazonRechazo(""); }}
                    className="p-2 rounded-lg bg-red-700 text-white hover:bg-red-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Rechazar"
                  >
                    <XCircle size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* ── Candidatos a reproductor ─────────────────────────────────── */}
          {candidatos.map((animal) => {
            const isExpanded = expandedId === animal.id;
            const isPending = actionId === animal.id && candidatoMutation.isPending;
            return (
              <div key={`cand-${animal.id}`} className="card border-l-4 border-emerald-400">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                    {animal.fotos.find((f) => f.tipo === "PERFIL") ? (
                      <img src={animal.fotos.find((f) => f.tipo === "PERFIL")!.url} alt="Perfil" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300"><Bird size={20} /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-gray-900">{animal.numero_anilla}</span>
                      <span className="text-gray-400 text-sm">({animal.fecha_nacimiento ? new Date(animal.fecha_nacimiento).getFullYear() : "—"})</span>
                      <AnimalStateChip estado={animal.estado} />
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">Candidato</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-0.5">
                      {animal.sexo === "M" ? "Macho" : "Hembra"} · {animal.variedad} · <span className="text-xs text-gray-400">{animal.socio_nombre}</span>
                    </div>
                  </div>
                  <button onClick={() => setExpandedId((prev) => (prev === animal.id ? null : animal.id))} className="text-gray-400 hover:text-gray-600 p-1">
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                    {(animal.padre_anilla || animal.madre_anilla) && (
                      <div className="text-sm text-gray-600">
                        {animal.padre_anilla && <span>Padre: <code className="bg-gray-100 px-1 rounded">{animal.padre_anilla}</code></span>}
                        {animal.madre_anilla && <span className="ml-3">Madre: <code className="bg-gray-100 px-1 rounded">{animal.madre_anilla}</code></span>}
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Notas de decisión (opcional)</label>
                      <textarea
                        rows={2}
                        className="input-field text-sm resize-none"
                        placeholder="Motivo de aprobación o denegación…"
                        value={candidatoNotas[animal.id] ?? ""}
                        onChange={(e) => setCandidatoNotas((prev) => ({ ...prev, [animal.id]: e.target.value }))}
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => { setActionId(animal.id); candidatoMutation.mutate({ id: animal.id, aprobado: true }); }}
                        disabled={isPending}
                        className="btn-primary gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                        Aprobar reproductor
                      </button>
                      <button
                        onClick={() => { setActionId(animal.id); candidatoMutation.mutate({ id: animal.id, aprobado: false }); }}
                        disabled={isPending}
                        className="btn-danger gap-2 disabled:opacity-50"
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

          {/* ── Conflictos de titularidad ─────────────────────────────────── */}
          {conflictos.map((c) => (
            <div key={`conf-${c.id}`} className="card border-l-4 border-amber-400">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={15} className="text-amber-500" />
                    <span className="font-semibold text-gray-900">Anilla {c.numero_anilla} / {c.anio_nacimiento}</span>
                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Conflicto</span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-0.5">
                    <div><span className="text-gray-400">Propietario actual:</span> <strong>{c.socio_actual_nombre}</strong></div>
                    <div><span className="text-gray-400">Reclamante:</span> <strong>{c.socio_reclamante_nombre}</strong></div>
                    <div className="text-xs text-gray-400">Registrado: {new Date(c.created_at).toLocaleDateString("es-ES")}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setConflictoModal({ conflicto: c, action: "resolve" }); setConflictoNotas(""); }}
                    className="p-2 rounded-lg bg-green-700 text-white hover:bg-green-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Resolver"
                  >
                    <CheckCircle2 size={18} />
                  </button>
                  <button
                    onClick={() => { setConflictoModal({ conflicto: c, action: "discard" }); setConflictoNotas(""); }}
                    className="p-2 rounded-lg bg-gray-500 text-white hover:bg-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Descartar"
                  >
                    <XCircle size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Rechazar Animal</h2>
            <p className="text-sm text-gray-600">
              Animal: <strong>{rejectModal.numero_anilla}</strong> / {rejectModal.fecha_nacimiento ? new Date(rejectModal.fecha_nacimiento).getFullYear() : "—"}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Razón de rechazo *</label>
              <textarea
                className="input-field h-24 resize-none"
                value={razonRechazo}
                onChange={(e) => setRazonRechazo(e.target.value)}
                placeholder="Describe el motivo del rechazo..."
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRejectModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button
                onClick={() => rejectMutation.mutate({ id: rejectModal.id, razon: razonRechazo })}
                disabled={!razonRechazo.trim() || rejectMutation.isPending}
                className="btn-danger flex-1"
              >
                {rejectMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : "Rechazar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conflicto modal */}
      {conflictoModal && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">
              {conflictoModal.action === "resolve" ? "Resolver Conflicto" : "Descartar Conflicto"}
            </h2>
            <p className="text-sm text-gray-600">
              Anilla: <strong>{conflictoModal.conflicto.numero_anilla}</strong> / {conflictoModal.conflicto.anio_nacimiento}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
              <textarea
                className="input-field h-20 resize-none"
                value={conflictoNotas}
                onChange={(e) => setConflictoNotas(e.target.value)}
                placeholder="Descripción de la resolución..."
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConflictoModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button
                onClick={() => resolveMutation.mutate({ id: conflictoModal.conflicto.id, action: conflictoModal.action, notas: conflictoNotas })}
                disabled={resolveMutation.isPending}
                className={conflictoModal.action === "resolve" ? "btn-primary flex-1" : "btn-secondary flex-1"}
              >
                {resolveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
