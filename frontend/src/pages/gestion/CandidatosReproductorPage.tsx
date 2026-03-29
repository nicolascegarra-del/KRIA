import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reproductoresApi } from "../../api/reproductores";
import AnimalStateChip from "../../components/AnimalStateChip";
import { Bird, Check, X, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import type { Animal } from "../../types";

export default function CandidatosReproductorPage() {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [actionId, setActionId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["candidatos-reproductor"],
    queryFn: () => reproductoresApi.candidatos(),
  });

  const mutation = useMutation({
    mutationFn: ({ id, aprobado }: { id: string; aprobado: boolean }) =>
      reproductoresApi.aprobar(id, aprobado, notas[id]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidatos-reproductor"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setActionId(null);
    },
  });

  const handleAction = (id: string, aprobado: boolean) => {
    setActionId(id);
    mutation.mutate({ id, aprobado });
  };

  const toggleExpand = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 p-6">
        <Loader2 size={20} className="animate-spin" />
        Cargando candidatos…
      </div>
    );
  }

  const candidatos: Animal[] = data?.results ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Candidatos a Reproductor</h1>
          <p className="text-sm text-gray-500">
            {candidatos.length === 0
              ? "No hay candidatos pendientes"
              : `${candidatos.length} candidato${candidatos.length !== 1 ? "s" : ""} pendiente${candidatos.length !== 1 ? "s" : ""} de revisión`}
          </p>
        </div>
        <Bird size={32} className="text-emerald-600" />
      </div>

      {candidatos.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <Bird size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Sin candidatos pendientes</p>
          <p className="text-sm mt-1">Cuando un socio proponga un reproductor aparecerá aquí.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {candidatos.map((animal) => {
            const isExpanded = expandedId === animal.id;
            const isPending = actionId === animal.id && mutation.isPending;

            return (
              <div key={animal.id} className="card">
                {/* Header row */}
                <div className="flex items-start gap-4">
                  {/* Foto */}
                  <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                    {animal.fotos.find((f) => f.tipo === "PERFIL") ? (
                      <img
                        src={animal.fotos.find((f) => f.tipo === "PERFIL")!.url}
                        alt="Perfil"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <Bird size={24} />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-gray-900">{animal.numero_anilla}</span>
                      <span className="text-gray-400 text-sm">({animal.fecha_nacimiento ? new Date(animal.fecha_nacimiento).getFullYear() : "—"})</span>
                      <AnimalStateChip estado={animal.estado} />
                    </div>
                    <div className="text-sm text-gray-600 mt-0.5">
                      {animal.sexo === "M" ? "Macho" : "Hembra"} · {animal.variedad}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{animal.socio_nombre}</div>
                  </div>

                  {/* Expand toggle */}
                  <button
                    onClick={() => toggleExpand(animal.id)}
                    className="text-gray-400 hover:text-gray-600 p-1"
                    aria-label="Ver detalles"
                  >
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>

                {/* Expandible — notas + acciones */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                    {/* Datos adicionales */}
                    {(animal.padre_anilla || animal.madre_anilla) && (
                      <div className="text-sm text-gray-600">
                        {animal.padre_anilla && <span>Padre: <code className="bg-gray-100 px-1 rounded">{animal.padre_anilla}</code></span>}
                        {animal.madre_anilla && <span className="ml-3">Madre: <code className="bg-gray-100 px-1 rounded">{animal.madre_anilla}</code></span>}
                      </div>
                    )}

                    {/* Notas de decisión */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Notas de decisión (opcional)
                      </label>
                      <textarea
                        rows={2}
                        className="input-field text-sm resize-none"
                        placeholder="Motivo de aprobación o denegación…"
                        value={notas[animal.id] ?? ""}
                        onChange={(e) =>
                          setNotas((prev) => ({ ...prev, [animal.id]: e.target.value }))
                        }
                      />
                    </div>

                    {/* Botones */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleAction(animal.id, true)}
                        disabled={isPending}
                        className="btn-primary gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                        Aprobar como reproductor
                      </button>
                      <button
                        onClick={() => handleAction(animal.id, false)}
                        disabled={isPending}
                        className="btn-danger gap-2 disabled:opacity-50"
                      >
                        {isPending ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                        Denegar
                      </button>
                    </div>

                    {mutation.isError && actionId === animal.id && (
                      <p className="text-sm text-red-600">
                        {(mutation.error as any)?.response?.data?.detail ?? "Error al procesar la acción."}
                      </p>
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
