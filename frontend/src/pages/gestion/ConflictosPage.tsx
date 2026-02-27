import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../api/client";
import { AlertTriangle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { Conflicto } from "../../types";

export default function ConflictosPage() {
  const qc = useQueryClient();
  const [activeModal, setActiveModal] = useState<{ conflicto: Conflicto; action: "resolve" | "discard" } | null>(null);
  const [notas, setNotas] = useState("");

  const { data, isLoading } = useQuery<{ results: Conflicto[] }>({
    queryKey: ["conflictos"],
    queryFn: async () => {
      const { data } = await apiClient.get("/dashboard/conflictos/");
      return data;
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, action, notas }: { id: string; action: string; notas: string }) => {
      await apiClient.post(`/dashboard/conflictos/${id}/resolve/`, { action, notas });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conflictos"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setActiveModal(null);
    },
  });

  const conflictos = data?.results ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Conflictos de Titularidad</h1>
        <p className="text-sm text-gray-500">{conflictos.length} conflictos pendientes</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="card h-24 animate-pulse bg-gray-100" />)}
        </div>
      ) : conflictos.length === 0 ? (
        <div className="card text-center py-12">
          <CheckCircle2 size={48} className="text-green-500 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No hay conflictos pendientes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {conflictos.map((c) => (
            <div key={c.id} className="card border-l-4 border-amber-400">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={16} className="text-amber-500" />
                    <span className="font-semibold text-gray-900">
                      Anilla {c.numero_anilla} / {c.anio_nacimiento}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-0.5">
                    <div>
                      <span className="text-gray-400">Propietario actual:</span>{" "}
                      <strong>{c.socio_actual_nombre}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400">Reclamante:</span>{" "}
                      <strong>{c.socio_reclamante_nombre}</strong>
                    </div>
                    <div className="text-xs text-gray-400">
                      Registrado: {new Date(c.created_at).toLocaleDateString("es-ES")}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setActiveModal({ conflicto: c, action: "resolve" }); setNotas(""); }}
                    className="p-2 rounded-lg bg-green-700 text-white hover:bg-green-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Resolver"
                  >
                    <CheckCircle2 size={18} />
                  </button>
                  <button
                    onClick={() => { setActiveModal({ conflicto: c, action: "discard" }); setNotas(""); }}
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

      {/* Modal */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">
              {activeModal.action === "resolve" ? "Resolver Conflicto" : "Descartar Conflicto"}
            </h2>
            <p className="text-sm text-gray-600">
              Anilla: <strong>{activeModal.conflicto.numero_anilla}</strong> / {activeModal.conflicto.anio_nacimiento}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
              <textarea
                className="input-field h-20 resize-none"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Descripción de la resolución..."
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setActiveModal(null)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                onClick={() =>
                  resolveMutation.mutate({
                    id: activeModal.conflicto.id,
                    action: activeModal.action,
                    notas,
                  })
                }
                disabled={resolveMutation.isPending}
                className={activeModal.action === "resolve" ? "btn-primary flex-1" : "btn-secondary flex-1"}
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
