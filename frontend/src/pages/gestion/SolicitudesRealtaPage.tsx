import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { realtaApi } from "../../api/realta";
import { RefreshCw, Check, X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import type { SolicitudRealta } from "../../types";

export default function SolicitudesRealtaPage() {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [actionId, setActionId] = useState<string | null>(null);

  const { data: solicitudes = [], isLoading } = useQuery<SolicitudRealta[]>({
    queryKey: ["solicitudes-realta"],
    queryFn: realtaApi.list,
  });

  const mutation = useMutation({
    mutationFn: ({ id, aprobado }: { id: string; aprobado: boolean }) =>
      realtaApi.resolver(id, aprobado, notas[id]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["solicitudes-realta"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setActionId(null);
    },
  });

  const pendientes = solicitudes.filter((s) => s.estado === "PENDIENTE");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><RefreshCw size={20} className="text-violet-600" />Solicitudes de Re-alta</h1>
          <p className="text-sm text-gray-500">{pendientes.length} pendiente{pendientes.length !== 1 ? "s" : ""} de resolución</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="card h-16 animate-pulse bg-gray-100" />)}</div>
      ) : pendientes.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <RefreshCw size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Sin solicitudes pendientes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendientes.map((s) => {
            const isExpanded = expandedId === s.id;
            const isPending = actionId === s.id && mutation.isPending;
            return (
              <div key={s.id} className="card">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{s.solicitante_nombre ?? "Socio"}</div>
                    <div className="text-xs text-gray-400">Animal: <code className="bg-gray-100 px-1 rounded">{s.animal_anilla ?? s.animal}</code> · {new Date(s.created_at).toLocaleDateString("es-ES")}</div>
                    {s.notas && <div className="text-sm text-gray-600 mt-1 italic">"{s.notas}"</div>}
                  </div>
                  <button onClick={() => setExpandedId(isExpanded ? null : s.id)} className="text-gray-400 hover:text-gray-600 p-1">
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Notas (opcional)</label>
                      <textarea rows={2} className="input-field text-sm resize-none" placeholder="Motivo de la decisión…" value={notas[s.id] ?? ""} onChange={(e) => setNotas(p => ({ ...p, [s.id]: e.target.value }))} />
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => { setActionId(s.id); mutation.mutate({ id: s.id, aprobado: true }); }} disabled={isPending} className="btn-primary gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
                        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Aprobar re-alta
                      </button>
                      <button onClick={() => { setActionId(s.id); mutation.mutate({ id: s.id, aprobado: false }); }} disabled={isPending} className="btn-danger gap-2 disabled:opacity-50">
                        {isPending ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />} Denegar
                      </button>
                    </div>
                    {mutation.isError && actionId === s.id && (
                      <p className="text-sm text-red-600">{(mutation.error as any)?.response?.data?.detail ?? "Error."}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
