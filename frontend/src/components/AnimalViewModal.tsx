import { useQuery } from "@tanstack/react-query";
import { animalsApi } from "../api/animals";
import AnimalStateChip from "./AnimalStateChip";
import { X, Bird, Loader2, Scale, Calendar, TreeDeciduous } from "lucide-react";

interface Props {
  animalId: string;
  onClose: () => void;
}

const SEXO_LABEL: Record<string, string> = { M: "♂ Macho", H: "♀ Hembra" };
const VARIEDAD_LABEL: Record<string, string> = {
  SALMON: "Salmón", PLATA: "Plata", SIN_DEFINIR: "Sin definir",
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-400 w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800 font-medium flex-1">{value ?? <span className="text-gray-300">—</span>}</span>
    </div>
  );
}

export default function AnimalViewModal({ animalId, onClose }: Props) {
  const { data: animal, isLoading } = useQuery({
    queryKey: ["animal-detail", animalId],
    queryFn: () => animalsApi.get(animalId),
  });

  const perfilFoto = animal?.fotos?.find((f) => f.tipo === "PERFIL") ?? animal?.fotos?.[0];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Bird size={18} className="text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            {animal ? (
              <>
                <h2 className="font-bold text-gray-900 text-base font-mono">{animal.numero_anilla}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <AnimalStateChip estado={animal.estado} />
                </div>
              </>
            ) : (
              <div className="h-5 w-40 bg-gray-200 animate-pulse rounded" />
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={28} className="animate-spin text-blue-600" />
            </div>
          ) : animal ? (
            <div className="p-5 space-y-6">

              {/* Photo + basic info */}
              <div className="flex gap-5">
                {/* Photo */}
                <div className="shrink-0">
                  {perfilFoto ? (
                    <img
                      src={perfilFoto.url}
                      alt="Foto del animal"
                      className="w-28 h-28 rounded-2xl object-cover border border-gray-200 shadow-sm"
                    />
                  ) : (
                    <div className="w-28 h-28 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center">
                      <Bird size={36} className="text-gray-300" />
                    </div>
                  )}
                </div>

                {/* Basic info */}
                <div className="flex-1 min-w-0">
                  <InfoRow label="Número de anilla" value={<span className="font-mono">{animal.numero_anilla}</span>} />
                  <InfoRow label="Sexo" value={animal.sexo ? SEXO_LABEL[animal.sexo] : null} />
                  <InfoRow label="Variedad" value={VARIEDAD_LABEL[animal.variedad] ?? animal.variedad} />
                  <InfoRow
                    label="Año de nacimiento"
                    value={animal.fecha_nacimiento ? new Date(animal.fecha_nacimiento).getFullYear() : null}
                  />
                  <InfoRow label="Ganadería" value={animal.ganaderia_nacimiento_display ?? animal.ganaderia_nacimiento} />
                </div>
              </div>

              {/* Parentage */}
              {(animal.padre_anilla || animal.madre_anilla || animal.madre_lote_externo) && (
                <div className="bg-gray-50 rounded-2xl p-4 space-y-0.5">
                  <div className="flex items-center gap-1.5 mb-3">
                    <TreeDeciduous size={14} className="text-green-600" />
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Genealogía</span>
                  </div>
                  {animal.padre_anilla && (
                    <InfoRow label="Padre" value={<span className="font-mono text-blue-800">{animal.padre_anilla}{animal.padre_anio_nacimiento ? ` (${animal.padre_anio_nacimiento})` : ""}</span>} />
                  )}
                  {animal.madre_anilla && (
                    <InfoRow label="Madre" value={<span className="font-mono text-pink-700">{animal.madre_anilla}{animal.madre_anio_nacimiento ? ` (${animal.madre_anio_nacimiento})` : ""}</span>} />
                  )}
                  {!animal.madre_anilla && animal.madre_lote_externo && (
                    <InfoRow label="Madre (lote)" value={<span className="font-mono text-purple-700">{animal.madre_lote_externo}</span>} />
                  )}
                </div>
              )}

              {/* Additional info */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-0.5">
                <div className="flex items-center gap-1.5 mb-3">
                  <Calendar size={14} className="text-blue-600" />
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Datos adicionales</span>
                </div>
                {animal.granja_nombre && <InfoRow label="Granja" value={animal.granja_nombre} />}
                {animal.fecha_incubacion && (
                  <InfoRow label="Fecha incubación" value={new Date(animal.fecha_incubacion).toLocaleDateString("es-ES")} />
                )}
                {animal.fecha_baja && (
                  <InfoRow label="Fecha de baja" value={new Date(animal.fecha_baja).toLocaleDateString("es-ES")} />
                )}
                {animal.motivo_baja_nombre && <InfoRow label="Motivo de baja" value={animal.motivo_baja_nombre} />}
                {animal.razon_rechazo && <InfoRow label="Razón de rechazo" value={animal.razon_rechazo} />}
              </div>

              {/* Ganadería history */}
              {(animal.historico_ganaderias?.length > 0 || animal.ganaderia_nacimiento_display || animal.ganaderia_nacimiento) && (() => {
                const rows = animal.historico_ganaderias?.length > 0
                  ? animal.historico_ganaderias
                  : [{ ganaderia: animal.ganaderia_nacimiento_display || animal.ganaderia_nacimiento, fecha_alta: null, fecha_baja: null }];
                return (
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <Calendar size={14} className="text-green-600" />
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Historial de Ganaderías</span>
                    </div>
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-3 py-2 text-left font-semibold text-gray-500">Ganadería</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">Fecha Alta</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">Fecha Baja</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((g, i) => (
                            <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium text-gray-800">{g.ganaderia}</td>
                              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{g.fecha_alta ?? "—"}</td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {g.fecha_baja
                                  ? <span className="text-gray-500">{g.fecha_baja}</span>
                                  : <span className="text-green-600 font-semibold">Actual</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Weight history */}
              {animal.historico_pesos && animal.historico_pesos.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Scale size={14} className="text-orange-500" />
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Histórico de pesos</span>
                  </div>
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Fecha</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-500">Peso (kg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...animal.historico_pesos]
                          .sort((a, b) => b.fecha.localeCompare(a.fecha))
                          .map((p, i) => (
                            <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-600">
                                {new Date(p.fecha).toLocaleDateString("es-ES")}
                              </td>
                              <td className="px-3 py-2 text-right font-medium text-gray-900">
                                {Number(p.peso).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Photo gallery */}
              {animal.fotos && animal.fotos.length > 1 && (
                <div>
                  <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Fotos</div>
                  <div className="flex gap-2 flex-wrap">
                    {animal.fotos.map((f) => (
                      <a key={f.key} href={f.url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={f.url}
                          alt={f.tipo ?? "foto"}
                          className="w-16 h-16 rounded-xl object-cover border border-gray-200 hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="btn-secondary text-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
