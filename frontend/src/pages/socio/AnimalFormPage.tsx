import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { animalsApi } from "../../api/animals";
import AnimalStateChip from "../../components/AnimalStateChip";
import GenealogyTooltip from "../../components/GenealogyTooltip";
import { Loader2, ArrowLeft, Info } from "lucide-react";
import type { Animal } from "../../types";

interface FormData {
  numero_anilla: string;
  anio_nacimiento: number;
  sexo: "M" | "H";
  variedad: "SALMON" | "PLATA" | "OTRA";
  padre: string;
  madre_animal: string;
  candidato_reproductor: boolean;
}

export default function AnimalFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showGenealogia, setShowGenealogia] = useState(false);
  const [conflictError, setConflictError] = useState("");

  const { data: animal, isLoading } = useQuery({
    queryKey: ["animal", id],
    queryFn: () => animalsApi.get(id!),
    enabled: isEdit,
  });

  const { data: genealogy } = useQuery({
    queryKey: ["genealogy", id],
    queryFn: () => animalsApi.genealogy(id!),
    enabled: isEdit && showGenealogia,
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>();

  useEffect(() => {
    if (animal) {
      reset({
        numero_anilla: animal.numero_anilla,
        anio_nacimiento: animal.anio_nacimiento,
        sexo: animal.sexo,
        variedad: animal.variedad,
        padre: animal.padre ?? "",
        madre_animal: animal.madre_animal ?? "",
        candidato_reproductor: animal.candidato_reproductor,
      });
    }
  }, [animal, reset]);

  const mutation = useMutation({
    mutationFn: (data: Partial<Animal>) =>
      isEdit ? animalsApi.update(id!, data) : animalsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["animals"] });
      navigate("/mis-animales");
    },
    onError: (err: any) => {
      if (err?.response?.status === 409) {
        setConflictError(
          err?.response?.data?.detail ?? "Conflicto de titularidad — animal pertenece a otro socio activo."
        );
      }
    },
  });

  const onSubmit = (data: FormData) => {
    setConflictError("");
    const payload: Partial<Animal> = {
      ...data,
      padre: data.padre || null,
      madre_animal: data.madre_animal || null,
    } as any;
    mutation.mutate(payload);
  };

  if (isEdit && isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={32} className="animate-spin text-blue-700" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {isEdit ? `Editar Animal ${animal?.numero_anilla}` : "Registrar Animal"}
          </h1>
          {animal && (
            <div className="flex items-center gap-2 mt-1">
              <AnimalStateChip estado={animal.estado} />
              {animal.estado === "APROBADO" || animal.estado === "EVALUADO" ? (
                <span className="text-xs text-amber-600 flex items-center gap-1">
                  <Info size={12} />
                  Al guardar, el estado volverá a Añadido
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="card space-y-5">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nº de Anilla *
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="ES-2024-XXXX"
                {...register("numero_anilla", { required: true })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Año de Nacimiento *
              </label>
              <input
                type="number"
                className="input-field"
                min={2000}
                max={new Date().getFullYear()}
                {...register("anio_nacimiento", { required: true, valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sexo *</label>
              <select className="input-field" {...register("sexo", { required: true })}>
                <option value="">Seleccionar...</option>
                <option value="M">♂ Macho</option>
                <option value="H">♀ Hembra</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Variedad</label>
              <select className="input-field" {...register("variedad")}>
                <option value="SALMON">Salmón</option>
                <option value="PLATA">Plata</option>
                <option value="OTRA">Otra</option>
              </select>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Genealogía</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">ID del Padre (opcional)</label>
                <input
                  type="text"
                  className="input-field text-xs"
                  placeholder="UUID del animal padre"
                  {...register("padre")}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">ID de la Madre (opcional)</label>
                <input
                  type="text"
                  className="input-field text-xs"
                  placeholder="UUID del animal madre"
                  {...register("madre_animal")}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 accent-blue-700"
                {...register("candidato_reproductor")}
              />
              <span className="text-sm text-gray-700">Proponer como candidato a reproductor</span>
            </label>
          </div>

          {conflictError && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-sm text-red-700">
              <strong>Conflicto de titularidad:</strong> {conflictError}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || mutation.isPending}
              className="btn-primary flex-1"
            >
              {mutation.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Guardando...</>
              ) : (
                isEdit ? "Guardar cambios" : "Registrar animal"
              )}
            </button>
          </div>
        </form>

        {/* Genealogy visualization */}
        {isEdit && (
          <div className="border-t pt-4">
            <button
              onClick={() => setShowGenealogia(!showGenealogia)}
              className="text-sm text-blue-700 hover:underline"
            >
              {showGenealogia ? "Ocultar" : "Ver"} árbol genealógico
            </button>
            {showGenealogia && genealogy?.tree && (
              <div className="mt-3 overflow-x-auto">
                <GenealogyTooltip tree={genealogy.tree} width={480} height={280} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
