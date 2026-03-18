import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../api/client";
import { animalsApi } from "../../api/animals";
import SuccessToast from "../../components/SuccessToast";
import { Loader2, Search, ClipboardList, Plus } from "lucide-react";
import type { Evaluacion } from "../../types";
import clsx from "clsx";

interface FormData {
  animal: string;
  cabeza: number;
  cola: number;
  pecho_abdomen: number;
  muslos_tarsos: number;
  cresta_babilla: number;
  color: number;
  notas: string;
}

const FIELDS: { key: keyof FormData; label: string }[] = [
  { key: "cabeza", label: "Cabeza" },
  { key: "cola", label: "Cola" },
  { key: "pecho_abdomen", label: "Pecho / Abdomen" },
  { key: "muslos_tarsos", label: "Muslos / Tarsos" },
  { key: "cresta_babilla", label: "Cresta / Babilla" },
  { key: "color", label: "Color" },
];

function scoreColor(v: number) {
  if (v <= 4) return "bg-red-600 text-white";
  if (v <= 6) return "bg-amber-500 text-white";
  if (v <= 8) return "bg-green-600 text-white";
  return "bg-yellow-400 text-gray-900";
}

function scoreColorOutline(v: number) {
  if (v <= 4) return "border-red-300 text-red-700 hover:bg-red-50";
  if (v <= 6) return "border-amber-300 text-amber-700 hover:bg-amber-50";
  if (v <= 8) return "border-green-300 text-green-700 hover:bg-green-50";
  return "border-yellow-300 text-yellow-700 hover:bg-yellow-50";
}

interface ScoreButtonsProps {
  value: number;
  onChange: (v: number) => void;
  label: string;
}

function ScoreButtons({ value, onChange, label }: ScoreButtonsProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className={clsx("text-sm font-bold px-2 py-0.5 rounded", scoreColor(value))}>
          {value}
        </span>
      </div>
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={clsx(
              "min-h-[44px] rounded-lg border-2 text-sm font-semibold transition-colors",
              value === n ? scoreColor(n) : clsx("bg-white", scoreColorOutline(n))
            )}
            aria-label={`${label}: ${n}`}
            aria-pressed={value === n}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

type Tab = "nueva" | "historial";

export default function EvaluacionPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("nueva");
  const [successMsg, setSuccessMsg] = useState("");

  // Búsqueda de animal por anilla
  const [anillaSearch, setAnillaSearch] = useState("");
  const [anioSearch, setAnioSearch] = useState(String(new Date().getFullYear()));
  const [animalId, setAnimalId] = useState(params.get("animal") ?? "");
  const [animalLabel, setAnimalLabel] = useState("");

  const { data: searchResults, isFetching: searching } = useQuery({
    queryKey: ["animals-search", anillaSearch, anioSearch],
    queryFn: () =>
      animalsApi.searchGlobal(anillaSearch, parseInt(anioSearch, 10)),
    enabled: anillaSearch.length >= 2 && !!anioSearch,
  });

  // Scores state (controlled, not via react-hook-form range)
  const [scores, setScores] = useState({ cabeza: 5, cola: 5, pecho_abdomen: 5, muslos_tarsos: 5, cresta_babilla: 5, color: 5 });
  const setScore = (key: string, v: number) => setScores((s) => ({ ...s, [key]: v }));

  const { register, handleSubmit, formState: { isSubmitting }, reset } = useForm<FormData>();

  const campos = Object.values(scores);
  const media = (campos.reduce((a, b) => a + b, 0) / 6).toFixed(2);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = { ...data, ...scores, animal: animalId };
      const { data: res } = await apiClient.post("/evaluaciones/", payload);
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["animals"] });
      qc.invalidateQueries({ queryKey: ["evaluaciones"] });
      setSuccessMsg("Evaluación guardada correctamente.");
      reset();
      setAnimalId("");
      setAnimalLabel("");
      setAnillaSearch("");
      setScores({ cabeza: 5, cola: 5, pecho_abdomen: 5, muslos_tarsos: 5, cresta_babilla: 5, color: 5 });
    },
  });

  // Historial
  const { data: historial, isLoading: loadingHistorial } = useQuery<Evaluacion[]>({
    queryKey: ["evaluaciones"],
    queryFn: async () => {
      const { data } = await apiClient.get("/evaluaciones/");
      return Array.isArray(data) ? data : data?.results ?? [];
    },
    enabled: tab === "historial",
  });

  return (
    <div className="max-w-2xl">
      <SuccessToast message={successMsg} onDismiss={() => setSuccessMsg("")} />

      <h1 className="text-xl font-bold text-gray-900 mb-4">Evaluación Morfológica</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("nueva")}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            tab === "nueva" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Plus size={15} />
          Nueva evaluación
        </button>
        <button
          onClick={() => setTab("historial")}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            tab === "historial" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <ClipboardList size={15} />
          Historial
        </button>
      </div>

      {tab === "nueva" && (
        <div className="card space-y-5">
          <form
            onSubmit={handleSubmit((d) => mutation.mutate(d))}
            className="space-y-5"
          >
            {/* Búsqueda de animal */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Animal *
              </label>
              {animalId && animalLabel ? (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm">
                  <span className="font-mono font-medium text-blue-800 flex-1">{animalLabel}</span>
                  <button
                    type="button"
                    onClick={() => { setAnimalId(""); setAnimalLabel(""); }}
                    className="text-blue-400 hover:text-blue-700 text-xs"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        className="input-field pl-9 font-mono"
                        placeholder="Nº de anilla"
                        value={anillaSearch}
                        onChange={(e) => setAnillaSearch(e.target.value)}
                      />
                    </div>
                    <input
                      type="number"
                      className="input-field w-24"
                      placeholder="Año"
                      value={anioSearch}
                      onChange={(e) => setAnioSearch(e.target.value)}
                      min={2000}
                      max={new Date().getFullYear()}
                    />
                    {searching && (
                      <Loader2 size={16} className="animate-spin self-center text-gray-400" />
                    )}
                  </div>
                  {searchResults && searchResults.length > 0 && !animalId && (
                    <ul className="bg-white border border-gray-200 rounded-lg shadow-sm divide-y divide-gray-100 max-h-40 overflow-y-auto">
                      {searchResults.map((a) => (
                        <li key={a.id}>
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between gap-2"
                            onClick={() => {
                              setAnimalId(a.id);
                              setAnimalLabel(`${a.numero_anilla} / ${a.anio_nacimiento} — ${a.socio_nombre}`);
                              setAnillaSearch("");
                            }}
                          >
                            <span className="font-mono">{a.numero_anilla}</span>
                            <span className="text-gray-500">{a.anio_nacimiento} · {a.socio_nombre}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {searchResults && searchResults.length === 0 && anillaSearch.length >= 2 && (
                    <p className="text-xs text-gray-400">Sin resultados</p>
                  )}
                </div>
              )}
            </div>

            {/* Score buttons */}
            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">Puntuaciones (1–10)</h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1 text-sm">
                  Media: <strong className="text-blue-800">{media}</strong>
                </div>
              </div>
              <div className="text-xs text-gray-400 flex gap-3">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-600 inline-block" />1–4 Deficiente</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />5–6 Regular</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-600 inline-block" />7–8 Bueno</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-400 inline-block" />9–10 Excelente</span>
              </div>
              {FIELDS.map(({ key, label }) => (
                <ScoreButtons
                  key={key}
                  label={label}
                  value={scores[key as keyof typeof scores]}
                  onChange={(v) => setScore(key, v)}
                />
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <textarea
                className="input-field h-20 resize-none"
                placeholder="Observaciones adicionales..."
                {...register("notas")}
              />
            </div>

            {mutation.isError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                Error al guardar la evaluación.
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={mutation.isPending || !animalId}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {mutation.isPending ? (
                  <><Loader2 size={16} className="animate-spin" /> Guardando...</>
                ) : (
                  "Guardar Evaluación"
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === "historial" && (
        <div className="card">
          <h2 className="text-base font-semibold text-gray-800 mb-3">Evaluaciones realizadas</h2>
          {loadingHistorial ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : !historial || historial.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No hay evaluaciones registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                    <th scope="col" className="pb-2 pr-3 text-left">Animal</th>
                    <th scope="col" className="pb-2 pr-3 text-right">Media</th>
                    <th scope="col" className="pb-2 pr-3 text-left">Notas</th>
                    <th scope="col" className="pb-2 text-left">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {historial.map((ev) => (
                    <tr key={ev.id} className="hover:bg-gray-50">
                      <td className="py-2 pr-3 font-mono text-gray-800">{ev.animal_anilla}</td>
                      <td className="py-2 pr-3 text-right">
                        <span className={clsx(
                          "font-bold px-2 py-0.5 rounded text-xs",
                          scoreColor(Math.round(parseFloat(ev.puntuacion_media)))
                        )}>
                          {ev.puntuacion_media}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-gray-500 truncate max-w-[120px]">{ev.notas || "—"}</td>
                      <td className="py-2 text-gray-400">
                        {new Date(ev.created_at).toLocaleDateString("es-ES")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
