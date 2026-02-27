import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../api/client";
import { Loader2 } from "lucide-react";

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

const FIELDS = [
  { key: "cabeza" as keyof FormData, label: "Cabeza" },
  { key: "cola" as keyof FormData, label: "Cola" },
  { key: "pecho_abdomen" as keyof FormData, label: "Pecho / Abdomen" },
  { key: "muslos_tarsos" as keyof FormData, label: "Muslos / Tarsos" },
  { key: "cresta_babilla" as keyof FormData, label: "Cresta / Babilla" },
  { key: "color" as keyof FormData, label: "Color" },
];

export default function EvaluacionPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const [preview, setPreview] = useState<Record<string, number>>({});

  const { register, handleSubmit, watch, formState: { isSubmitting, errors } } = useForm<FormData>({
    defaultValues: {
      animal: params.get("animal") ?? "",
      cabeza: 5, cola: 5, pecho_abdomen: 5, muslos_tarsos: 5, cresta_babilla: 5, color: 5,
    },
  });

  const values = watch();
  const campos = [values.cabeza, values.cola, values.pecho_abdomen, values.muslos_tarsos, values.cresta_babilla, values.color];
  const media = (campos.reduce((a, b) => Number(a) + Number(b), 0) / 6).toFixed(2);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { data: res } = await apiClient.post("/evaluaciones/", data);
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["animals"] });
      navigate("/validaciones");
    },
  });

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Nueva Evaluación Morfológica</h1>

      <div className="card space-y-5">
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ID del Animal *</label>
            <input
              type="text"
              className="input-field"
              placeholder="UUID del animal"
              {...register("animal", { required: true })}
            />
          </div>

          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Puntuaciones (1–10)</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1 text-sm">
                Media: <strong className="text-blue-800">{media}</strong>
              </div>
            </div>

            {FIELDS.map(({ key, label }) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">{label}</label>
                  <span className="text-sm font-bold text-blue-700">{values[key]}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  className="w-full accent-blue-700"
                  {...register(key, { required: true, min: 1, max: 10, valueAsNumber: true })}
                />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>1</span><span>10</span>
                </div>
              </div>
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
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">
              {mutation.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Guardando...</>
              ) : (
                "Guardar Evaluación"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
