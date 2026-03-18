import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { animalsApi } from "../../api/animals";
import { granjasApi } from "../../api/granjas";
import { lotesApi } from "../../api/lotes";
import AnimalStateChip from "../../components/AnimalStateChip";
import GenealogyTooltip from "../../components/GenealogyTooltip";
import { Loader2, ArrowLeft, Info, Camera, X, Scale, Plus, CheckCircle2, Circle } from "lucide-react";
import type { Animal, FotoTipo } from "../../types";

const FOTO_TIPOS: { tipo: FotoTipo; label: string }[] = [
  { tipo: "PERFIL", label: "Perfil" },
  { tipo: "CABEZA", label: "Cabeza" },
  { tipo: "ANILLA", label: "Anilla" },
];

interface FormData {
  numero_anilla: string;
  anio_nacimiento: number;
  sexo: "M" | "H";
  variedad: "SALMON" | "PLATA" | "OTRA";
  fecha_incubacion: string;
  ganaderia_nacimiento: string;
  ganaderia_actual: string;
  padre_anilla: string;
  padre_anio: string;
  madre_anilla: string;
  madre_anio: string;
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
  const [madreMode, setMadreMode] = useState<"individual" | "lote">("individual");
  const [madreLoteId, setMadreLoteId] = useState("");

  // Foto upload state: which tipo is being uploaded
  const [uploadingTipo, setUploadingTipo] = useState<FotoTipo | null>(null);
  const fileInputRefs = useRef<Record<FotoTipo, HTMLInputElement | null>>({
    PERFIL: null,
    CABEZA: null,
    ANILLA: null,
  });

  // Pesaje form state
  const [showPesajeForm, setShowPesajeForm] = useState(false);
  const [pesajeFecha, setPesajeFecha] = useState(new Date().toISOString().slice(0, 10));
  const [pesajePeso, setPesajePeso] = useState("");

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

  const { data: lotesData } = useQuery({
    queryKey: ["lotes"],
    queryFn: lotesApi.list,
    enabled: madreMode === "lote",
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>();

  useEffect(() => {
    if (animal) {
      if (animal.madre_lote) {
        setMadreMode("lote");
        setMadreLoteId(animal.madre_lote);
      } else {
        setMadreMode("individual");
        setMadreLoteId("");
      }
      reset({
        numero_anilla: animal.numero_anilla,
        anio_nacimiento: animal.anio_nacimiento,
        sexo: animal.sexo,
        variedad: animal.variedad,
        fecha_incubacion: animal.fecha_incubacion ?? "",
        ganaderia_nacimiento: animal.ganaderia_nacimiento ?? "",
        ganaderia_actual: animal.ganaderia_actual ?? "",
        padre_anilla: animal.padre_anilla ?? "",
        padre_anio: animal.padre_anio_nacimiento ? String(animal.padre_anio_nacimiento) : "",
        madre_anilla: animal.madre_anilla ?? "",
        madre_anio: animal.madre_anio_nacimiento ? String(animal.madre_anio_nacimiento) : "",
        candidato_reproductor: animal.candidato_reproductor,
        granja: animal.granja ?? "",
      });
    }
  }, [animal, reset]);

  const uploadFotoMutation = useMutation({
    mutationFn: ({ file, tipo }: { file: File; tipo: FotoTipo }) =>
      animalsApi.uploadFoto(id!, file, tipo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["animal", id] });
      setUploadingTipo(null);
    },
    onError: () => setUploadingTipo(null),
  });

  const deleteFotoMutation = useMutation({
    mutationFn: (key: string) => animalsApi.deleteFoto(id!, key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["animal", id] }),
  });

  const pesajeMutation = useMutation({
    mutationFn: ({ fecha, peso }: { fecha: string; peso: number }) =>
      animalsApi.addPesaje(id!, fecha, peso),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["animal", id] });
      setShowPesajeForm(false);
      setPesajePeso("");
    },
  });

  const mutation = useMutation({
    mutationFn: (data: Partial<Animal>) =>
      isEdit ? animalsApi.update(id!, data) : animalsApi.create(data),
    onSuccess: (savedAnimal) => {
      qc.invalidateQueries({ queryKey: ["animals"] });
      if (isEdit) {
        navigate("/mis-animales");
      } else {
        // After creation redirect to edit so the user can add photos immediately
        navigate(`/mis-animales/${savedAnimal.id}`, { replace: true });
      }
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
    const payload: any = {
      numero_anilla: data.numero_anilla,
      anio_nacimiento: data.anio_nacimiento,
      sexo: data.sexo,
      variedad: data.variedad,
      fecha_incubacion: data.fecha_incubacion || null,
      ganaderia_nacimiento: data.ganaderia_nacimiento,
      ganaderia_actual: data.ganaderia_actual,
      candidato_reproductor: data.candidato_reproductor,
      granja: data.granja || null,
    };

    // Genealogy: send by anilla+año if provided, otherwise clear
    if (data.padre_anilla && data.padre_anio) {
      payload.padre_anilla = data.padre_anilla;
      payload.padre_anio = parseInt(data.padre_anio, 10);
    } else if (!data.padre_anilla) {
      payload.padre = null;
    }

    if (madreMode === "lote") {
      payload.madre_lote = madreLoteId || null;
      payload.madre_animal = null;
    } else {
      if (data.madre_anilla && data.madre_anio) {
        payload.madre_anilla = data.madre_anilla;
        payload.madre_anio = parseInt(data.madre_anio, 10);
      } else if (!data.madre_anilla) {
        payload.madre_animal = null;
      }
      payload.madre_lote = null;
    }

    mutation.mutate(payload);
  };

  const handlePesajeSubmit = () => {
    const peso = parseFloat(pesajePeso);
    if (!pesajeFecha || isNaN(peso) || peso <= 0) return;
    pesajeMutation.mutate({ fecha: pesajeFecha, peso });
  };

  // Helpers for typed photos
  const getFotoByTipo = (tipo: FotoTipo) =>
    (animal?.fotos ?? []).find((f) => f.tipo === tipo);

  if (isEdit && isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={32} className="animate-spin text-blue-700" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
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
              {(animal.estado === "APROBADO" || animal.estado === "EVALUADO") && (
                <span className="text-xs text-amber-600 flex items-center gap-1">
                  <Info size={12} />
                  Al guardar, el estado volverá a Añadido
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main form */}
      <div className="card space-y-5">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Identification */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nº de Anilla *
              </label>
              <input
                type="text"
                className="input-field font-mono"
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

          {/* Biological */}
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

          {/* Breeding data */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Datos de Cría</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fecha de Incubación</label>
                <input
                  type="date"
                  className="input-field"
                  {...register("fecha_incubacion")}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ganadería de Nacimiento</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Nombre de la ganadería de origen"
                    {...register("ganaderia_nacimiento")}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ganadería Actual</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Nombre de la ganadería actual"
                    {...register("ganaderia_actual")}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Genealogy by anilla */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Genealogía</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Padre (anilla + año)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input-field font-mono flex-1"
                    placeholder="Nº anilla del padre"
                    {...register("padre_anilla")}
                  />
                  <input
                    type="number"
                    className="input-field w-24"
                    placeholder="Año"
                    min={2000}
                    max={new Date().getFullYear()}
                    {...register("padre_anio")}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-4 mb-2">
                  <label className="text-xs text-gray-500">Madre</label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="madreMode"
                        checked={madreMode === "individual"}
                        onChange={() => {
                          setMadreMode("individual");
                          setMadreLoteId("");
                        }}
                        className="accent-blue-700"
                      />
                      Individual
                    </label>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="madreMode"
                        checked={madreMode === "lote"}
                        onChange={() => setMadreMode("lote")}
                        className="accent-blue-700"
                      />
                      Lote de Cría
                    </label>
                  </div>
                </div>

                {madreMode === "individual" ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="input-field font-mono flex-1"
                      placeholder="Nº anilla de la madre"
                      {...register("madre_anilla")}
                    />
                    <input
                      type="number"
                      className="input-field w-24"
                      placeholder="Año"
                      min={2000}
                      max={new Date().getFullYear()}
                      {...register("madre_anio")}
                    />
                  </div>
                ) : (
                  <select
                    className="input-field"
                    value={madreLoteId}
                    onChange={(e) => setMadreLoteId(e.target.value)}
                  >
                    <option value="">Sin lote asignado</option>
                    {(lotesData?.results ?? []).map((lote) => (
                      <option key={lote.id} value={lote.id}>
                        {lote.nombre}
                        {lote.is_closed ? " (Finalizado)" : ""}
                        {lote.macho_anilla ? ` — Macho: ${lote.macho_anilla}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Farm & candidato */}
          <div className="border-t pt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Granja</label>
              <select className="input-field" {...register("granja")}>
                <option value="">Sin asignar</option>
                {granjasData?.results.map((g) => (
                  <option key={g.id} value={g.id}>{g.nombre}</option>
                ))}
              </select>
            </div>

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
            <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">
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

      {/* Typed photos section — only in edit mode */}
      {isEdit && (
        <div className="card space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Fotos obligatorias</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Se requieren las 3 fotos para poder aprobar el animal.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {FOTO_TIPOS.map(({ tipo, label }) => {
              const foto = getFotoByTipo(tipo);
              const isUploading = uploadingTipo === tipo;

              return (
                <div key={tipo} className="flex flex-col items-center gap-1.5">
                  {/* Indicator */}
                  <div className="flex items-center gap-1 text-xs font-medium">
                    {foto ? (
                      <CheckCircle2 size={14} className="text-green-600" />
                    ) : (
                      <Circle size={14} className="text-gray-300" />
                    )}
                    <span className={foto ? "text-green-700" : "text-gray-400"}>{label}</span>
                  </div>

                  {/* Photo or placeholder */}
                  <div className="relative w-full aspect-square">
                    {foto ? (
                      <>
                        <img
                          src={foto.url}
                          alt={`Foto ${label}`}
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
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setUploadingTipo(tipo);
                          fileInputRefs.current[tipo]?.click();
                        }}
                        disabled={isUploading || uploadFotoMutation.isPending}
                        className="w-full h-full rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                      >
                        {isUploading ? (
                          <Loader2 size={20} className="animate-spin" />
                        ) : (
                          <>
                            <Camera size={20} />
                            <span className="text-xs mt-1">Añadir</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Hidden file input per tipo */}
                  <input
                    ref={(el) => { fileInputRefs.current[tipo] = el; }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        uploadFotoMutation.mutate({ file, tipo });
                        e.target.value = "";
                      } else {
                        setUploadingTipo(null);
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Weight history — only in edit mode */}
      {isEdit && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale size={16} className="text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-700">Historial de Pesajes</h3>
            </div>
            <button
              onClick={() => setShowPesajeForm(!showPesajeForm)}
              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
            >
              <Plus size={14} />
              Añadir pesaje
            </button>
          </div>

          {/* Add weight form */}
          {showPesajeForm && (
            <div className="bg-gray-50 rounded-lg p-3 flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Fecha</label>
                <input
                  type="date"
                  className="input-field text-sm"
                  value={pesajeFecha}
                  onChange={(e) => setPesajeFecha(e.target.value)}
                />
              </div>
              <div className="w-28">
                <label className="block text-xs text-gray-500 mb-1">Peso (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input-field text-sm"
                  placeholder="0.00"
                  value={pesajePeso}
                  onChange={(e) => setPesajePeso(e.target.value)}
                />
              </div>
              <button
                onClick={handlePesajeSubmit}
                disabled={pesajeMutation.isPending || !pesajeFecha || !pesajePeso}
                className="btn-primary text-sm py-2 px-4"
              >
                {pesajeMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  "Guardar"
                )}
              </button>
              <button
                onClick={() => { setShowPesajeForm(false); setPesajePeso(""); }}
                className="btn-secondary text-sm py-2 px-3"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Weight list */}
          {(animal?.historico_pesos ?? []).length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">Sin pesajes registrados</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {[...(animal?.historico_pesos ?? [])].reverse().map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-gray-500">{p.fecha}</span>
                  <span className="font-semibold text-gray-900">{p.peso} kg</span>
                  {p.usuario && (
                    <span className="text-xs text-gray-400">{p.usuario}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
