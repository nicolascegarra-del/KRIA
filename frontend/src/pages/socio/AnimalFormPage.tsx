import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { animalsApi } from "../../api/animals";
import { granjasApi } from "../../api/granjas";
import AnimalStateChip from "../../components/AnimalStateChip";
import GenealogyTooltip from "../../components/GenealogyTooltip";
import { Loader2, ArrowLeft, Info, Camera, X } from "lucide-react";
import type { Animal } from "../../types";

interface FormData {
  numero_anilla: string;
  anio_nacimiento: number;
  sexo: "M" | "H";
  variedad: "SALMON" | "PLATA" | "OTRA";
  padre: string;
  madre_animal: string;
  candidato_reproductor: boolean;
  granja: string;
}

export default function AnimalFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showGenealogia, setShowGenealogia] = useState(false);
  const [conflictError, setConflictError] = useState("");
  const [serverError, setServerError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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

  const { data: granjasData } = useQuery({
    queryKey: ["granjas"],
    queryFn: () => granjasApi.list(),
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
        granja: animal.granja ?? "",
      });
    }
  }, [animal, reset]);

  const uploadFotoMutation = useMutation({
    mutationFn: (file: File) => animalsApi.uploadFoto(id!, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["animal", id] }),
  });

  const deleteFotoMutation = useMutation({
    mutationFn: (key: string) => animalsApi.deleteFoto(id!, key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["animal", id] }),
  });

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
      } else {
        const data = err?.response?.data;
        let msg = "Error al guardar el animal. Comprueba los datos e inténtalo de nuevo.";
        if (data?.detail) {
          msg = data.detail;
        } else if (data && typeof data === "object") {
          msg = Object.entries(data)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
            .join(" | ");
        } else if (err?.message) {
          msg = err.message;
        }
        setServerError(msg);
      }
    },
  });

  const onSubmit = (data: FormData) => {
    setConflictError("");
    setServerError("");
    const payload: Partial<Animal> = {
      ...data,
      padre: data.padre || null,
      madre_animal: data.madre_animal || null,
      granja: data.granja || null,
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Granja</label>
            <select className="input-field" {...register("granja")}>
              <option value="">Sin asignar</option>
              {granjasData?.results.map((g) => (
                <option key={g.id} value={g.id}>{g.nombre}</option>
              ))}
            </select>
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

          {serverError && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-sm text-red-700">
              {serverError}
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

      {/* Photos section — only in edit mode */}
      {isEdit && (
        <div className="card mt-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Fotos</h3>
          <div className="flex flex-wrap gap-3">
            {(animal?.fotos ?? []).map((foto) => (
              <div key={foto.key} className="relative w-20 h-20">
                <img
                  src={foto.url}
                  alt="Foto animal"
                  className="w-full h-full object-cover rounded-lg"
                />
                <button
                  onClick={() => deleteFotoMutation.mutate(foto.key)}
                  disabled={deleteFotoMutation.isPending}
                  className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-700"
                  title="Eliminar foto"
                >
                  {deleteFotoMutation.isPending ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : (
                    <X size={10} />
                  )}
                </button>
              </div>
            ))}

            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadFotoMutation.isPending}
              className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
              title="Añadir foto"
            >
              {uploadFotoMutation.isPending ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <Camera size={20} />
                  <span className="text-xs mt-1">Añadir</span>
                </>
              )}
            </button>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  uploadFotoMutation.mutate(file);
                  e.target.value = "";
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
