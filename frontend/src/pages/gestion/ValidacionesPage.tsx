import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { animalsApi } from "../../api/animals";
import AnimalStateChip from "../../components/AnimalStateChip";
import SuccessToast from "../../components/SuccessToast";
import { CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import type { Animal } from "../../types";

export default function ValidacionesPage() {
  const qc = useQueryClient();
  const [rejectModal, setRejectModal] = useState<Animal | null>(null);
  const [razonRechazo, setRazonRechazo] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveErrors, setApproveErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["animals", { estado: "AÑADIDO" }],
    queryFn: () => animalsApi.list({ estado: "AÑADIDO" }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => {
      setApprovingId(id);
      setApproveErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
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
      const msg =
        err?.response?.data?.detail ??
        "Error al aprobar el animal. Comprueba que tiene las 3 fotos obligatorias.";
      setApproveErrors((prev) => ({ ...prev, [id]: msg }));
      setTimeout(() => {
        setApproveErrors((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 6000);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, razon }: { id: string; razon: string }) =>
      animalsApi.reject(id, razon),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["animals"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setRejectModal(null);
      setRazonRechazo("");
      setSuccessMsg("Animal rechazado.");
    },
  });

  const animals = data?.results ?? [];

  return (
    <div className="space-y-4">
      <SuccessToast message={successMsg} onDismiss={() => setSuccessMsg("")} />

      <div>
        <h1 className="text-xl font-bold text-gray-900">Validaciones Pendientes</h1>
        <p className="text-sm text-gray-500">
          {data?.count ?? 0} animales pendientes de aprobación
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-20 animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : animals.length === 0 ? (
        <div className="card text-center py-12">
          <CheckCircle2 size={48} className="text-green-500 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No hay animales pendientes de validación.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {animals.map((animal) => (
            <div key={animal.id} className="card">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-gray-900">{animal.numero_anilla}</span>
                    <span className="text-sm text-gray-500">/ {animal.anio_nacimiento}</span>
                    <AnimalStateChip estado={animal.estado} />
                  </div>
                  <div className="text-sm text-gray-600">
                    {animal.sexo === "M" ? "♂" : "♀"} · {animal.variedad} ·{" "}
                    <strong>{animal.socio_nombre}</strong>
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
                    aria-label={`Aprobar ${animal.numero_anilla}`}
                    title="Aprobar"
                  >
                    {approvingId === animal.id ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={18} />
                    )}
                  </button>
                  <button
                    onClick={() => { setRejectModal(animal); setRazonRechazo(""); }}
                    className="p-2 rounded-lg bg-red-700 text-white hover:bg-red-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label={`Rechazar ${animal.numero_anilla}`}
                    title="Rechazar"
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
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-modal-title"
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4"
          >
            <h2 id="reject-modal-title" className="text-lg font-bold text-gray-900">
              Rechazar Animal
            </h2>
            <p className="text-sm text-gray-600">
              Animal: <strong>{rejectModal.numero_anilla}</strong> / {rejectModal.anio_nacimiento}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Razón de rechazo *
              </label>
              <textarea
                className="input-field h-24 resize-none"
                value={razonRechazo}
                onChange={(e) => setRazonRechazo(e.target.value)}
                placeholder="Describe el motivo del rechazo..."
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRejectModal(null)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                onClick={() =>
                  rejectMutation.mutate({ id: rejectModal.id, razon: razonRechazo })
                }
                disabled={!razonRechazo.trim() || rejectMutation.isPending}
                className="btn-danger flex-1"
              >
                {rejectMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  "Rechazar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
