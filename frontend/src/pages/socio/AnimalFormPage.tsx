import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { animalsApi } from "../../api/animals";
import { granjasApi } from "../../api/granjas";
import { lotesApi } from "../../api/lotes";
import { useTenantStore } from "../../store/tenantStore";
import AnimalStateChip from "../../components/AnimalStateChip";
import { Loader2, ArrowLeft, Info, Camera, X, Scale, Plus, CheckCircle2, Circle, XCircle, AlertCircle, History } from "lucide-react";
import type { Animal, FotoTipo } from "../../types";

const FOTO_TIPOS: { tipo: FotoTipo; label: string }[] = [
  { tipo: "PERFIL", label: "Perfil" },
  { tipo: "CABEZA", label: "Cabeza" },
  { tipo: "ANILLA", label: "Anilla" },
];

interface FormData {
  numero_anilla: string;
  fecha_nacimiento: string;
  sexo: "M" | "H";
  variedad: "SALMON" | "PLATA" | "SIN_DEFINIR";
  fecha_incubacion: string;
  ganaderia_nacimiento: string;
  padre_anilla: string;
  madre_anilla: string;

  granja: string;
}

export default function AnimalFormPage() {
  const { id, socioId } = useParams<{ id?: string; socioId?: string }>();
  const [searchParams] = useSearchParams();
  const readonly = searchParams.get("readonly") === "true";
  const isEdit = !!id;
  const isGestionCreate = !!socioId; // gestion admin creating for a specific socio
  const navigate = useNavigate();
  const { branding } = useTenantStore();
  const granjasEnabled = branding?.granjas_enabled !== false;
  const qc = useQueryClient();
  const [conflictError, setConflictError] = useState("");
  const [serverError, setServerError] = useState("");
  const [madreMode, setMadreMode] = useState<"individual" | "lote" | "externo">("individual");
  const [madreLoteId, setMadreLoteId] = useState("");
  const [madreLoteExterno, setMadreLoteExterno] = useState("");

  // Foto upload state: which tipo is being uploaded (edit mode — immediate API call)
  const [uploadingTipo, setUploadingTipo] = useState<FotoTipo | null>(null);
  const fileInputRefs = useRef<Record<FotoTipo, HTMLInputElement | null>>({
    PERFIL: null,
    CABEZA: null,
    ANILLA: null,
  });

  // Pending photos in creation mode — stored locally until animal is saved
  const [pendingPhotos, setPendingPhotos] = useState<Partial<Record<FotoTipo, File>>>({});
  const [pendingPreviews, setPendingPreviews] = useState<Partial<Record<FotoTipo, string>>>({});
  const pendingFileRefs = useRef<Record<FotoTipo, HTMLInputElement | null>>({
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

  // RECHAZADO animals are read-only for socios until admin reactivates
  const isRechazado = !isGestionCreate && animal?.estado === "RECHAZADO";
  const effectiveReadonly = readonly || isRechazado;
  // REGISTRADO/MODIFICADO animals: socios can only edit pesajes and fotos, not main fields
  const isPendingReview = !isGestionCreate && isEdit && (animal?.estado === "REGISTRADO" || animal?.estado === "MODIFICADO");
  // Solo se puede proponer como candidato si el animal está APROBADO (y no es gestión)
  const canProponerCandidato = isGestionCreate || !isEdit || animal?.estado === "APROBADO";

  // Campos protegidos: bloqueados una vez aprobado el animal si ya tenían valor.
  // Añadir datos en un campo vacío siempre está permitido.
  // Para socios: siempre. Para gestión: solo si allow_animal_modifications=false.
  const allowModifications = branding?.allow_animal_modifications !== false;
  const isValidated = isEdit && !!animal &&
    ["APROBADO", "EVALUADO", "SOCIO_EN_BAJA", "BAJA"].includes(animal.estado);
  const gestionCanEdit = isGestionCreate && allowModifications;
  const isProtectedLocked = isValidated && !gestionCanEdit;
  // Helpers: bloquea un campo solo si isProtectedLocked Y el campo ya tiene valor
  const lockedIfSet = (value: unknown) => isProtectedLocked && !!value;
  const padreHasValue = !!(animal?.padre_anilla);
  const madreHasValue = !!(animal?.madre_anilla || animal?.madre_lote || animal?.madre_lote_externo);

  const { data: granjasData } = useQuery({
    queryKey: ["granjas"],
    queryFn: () => granjasApi.list(),
    enabled: granjasEnabled,
  });

  const { data: lotesData } = useQuery({
    queryKey: ["lotes"],
    queryFn: lotesApi.list,
    enabled: madreMode === "lote" || madreMode === "externo",
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { isSubmitting } } = useForm<FormData>();

  useEffect(() => {
    if (animal) {
      if (animal.madre_lote) {
        setMadreMode("lote");
        setMadreLoteId(animal.madre_lote);
        setMadreLoteExterno("");
      } else if (animal.madre_lote_externo) {
        setMadreMode("externo");
        setMadreLoteId("");
        setMadreLoteExterno(animal.madre_lote_externo);
      } else {
        setMadreMode("individual");
        setMadreLoteId("");
        setMadreLoteExterno("");
      }
      reset({
        numero_anilla: animal.numero_anilla,
        fecha_nacimiento: animal.fecha_nacimiento,
        sexo: animal.sexo,
        variedad: (animal.variedad as any) === "OTRA" ? "SIN_DEFINIR" : animal.variedad,
        fecha_incubacion: animal.fecha_incubacion ?? "",
        ganaderia_nacimiento: animal.ganaderia_nacimiento_display || animal.ganaderia_nacimiento || "",
        padre_anilla: animal.padre_anilla ?? "",
        madre_anilla: animal.madre_anilla ?? "",

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
    onSuccess: async (savedAnimal) => {
      qc.invalidateQueries({ queryKey: ["animals"] });
      if (!isEdit && !isGestionCreate) {
        // Upload any photos the user selected before submitting
        const uploads = (Object.entries(pendingPhotos) as [FotoTipo, File][])
          .filter(([, file]) => file != null)
          .map(([tipo, file]) => animalsApi.uploadFoto(savedAnimal.id, file, tipo));
        if (uploads.length) await Promise.allSettled(uploads);
      }
      if (isGestionCreate) {
        const returnTo = searchParams.get("returnTo");
        navigate(returnTo || `/socios/${socioId}`);
      } else {
        navigate("/mis-animales");
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
      fecha_nacimiento: data.fecha_nacimiento,
      sexo: data.sexo,
      variedad: data.variedad,
      fecha_incubacion: data.fecha_incubacion || null,
      ganaderia_nacimiento: data.ganaderia_nacimiento,

      granja: data.granja || null,
      ...(isGestionCreate && { socio: socioId }),
    };

    // Padre: send by anilla if provided, otherwise clear
    if (data.padre_anilla) {
      payload.padre_anilla = data.padre_anilla;
    } else {
      payload.padre = null;
    }

    if (madreMode === "lote") {
      payload.madre_lote = madreLoteId || null;
      payload.madre_animal = null;
      payload.madre_lote_externo = "";
    } else if (madreMode === "externo") {
      payload.madre_lote_externo = madreLoteExterno;
      payload.madre_animal = null;
      payload.madre_lote = null;
    } else {
      if (data.madre_anilla) {
        payload.madre_anilla = data.madre_anilla;
      } else {
        payload.madre_animal = null;
      }
      payload.madre_lote = null;
      payload.madre_lote_externo = "";
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
    <div className="max-w-2xl mx-auto space-y-4">
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
            {isEdit
              ? (isRechazado || isPendingReview || effectiveReadonly)
                ? `Animal ${animal?.numero_anilla}`
                : `Editar Animal ${animal?.numero_anilla}`
              : "Registrar Animal"}
          </h1>
          {animal && (
            <div className="flex items-center gap-2 mt-1">
              <AnimalStateChip estado={animal.estado} />
              {!isPendingReview && (animal.estado === "APROBADO" || animal.estado === "EVALUADO") && (
                <span className="text-xs text-amber-600 flex items-center gap-1">
                  <Info size={12} />
                  Al guardar, el estado volverá a Añadido
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pending review banner */}
      {isPendingReview && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
            <AlertCircle size={16} />
            Animal pendiente de revisión
          </div>
          <p className="text-sm text-amber-700">
            Los datos principales no se pueden modificar mientras el animal está pendiente de aprobación.
            Puedes seguir añadiendo pesajes y fotos.
          </p>
        </div>
      )}


      {/* Rejection reason banner */}
      {isRechazado && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
            <XCircle size={16} />
            Animal rechazado
          </div>
          {animal?.razon_rechazo && (
            <p className="text-sm text-red-700">{animal.razon_rechazo}</p>
          )}
          <p className="text-xs text-red-400 mt-1">
            Contacta con la gestión de la asociación para más información.
          </p>
        </div>
      )}

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
                disabled={effectiveReadonly || isPendingReview || lockedIfSet(animal?.numero_anilla)}
                {...register("numero_anilla", { required: true })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Nacimiento *
              </label>
              <input
                type="date"
                className="input-field"
                max={new Date().toISOString().slice(0, 10)}
                disabled={effectiveReadonly || isPendingReview || lockedIfSet(animal?.fecha_nacimiento)}
                {...register("fecha_nacimiento", { required: true })}
              />
            </div>
          </div>

          {/* Biological */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sexo *</label>
              <select className="input-field" disabled={effectiveReadonly || isPendingReview || lockedIfSet(animal?.sexo)} {...register("sexo", { required: true })}>
                <option value="">Seleccionar...</option>
                <option value="M">♂ Macho</option>
                <option value="H">♀ Hembra</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Variedad</label>
              <select className="input-field" disabled={effectiveReadonly || isPendingReview} {...register("variedad")}>
                <option value="SALMON">Salmón</option>
                <option value="PLATA">Plata</option>
                <option value="SIN_DEFINIR">Sin Definir</option>
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
                  disabled={effectiveReadonly || isPendingReview || lockedIfSet(animal?.fecha_incubacion)}
                  {...register("fecha_incubacion")}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ganadería de Nacimiento</label>
                {lockedIfSet(animal?.ganaderia_nacimiento) ? (
                  <p className="input-field bg-gray-50 text-gray-700 cursor-default">
                    {animal?.ganaderia_nacimiento_display || animal?.ganaderia_nacimiento}
                  </p>
                ) : (
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Nombre de la ganadería de origen"
                    disabled={effectiveReadonly || isPendingReview}
                    {...register("ganaderia_nacimiento")}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Genealogy by anilla */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Genealogía</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Padre</label>
                <input
                  type="text"
                  className="input-field font-mono"
                  placeholder="Nº anilla del padre"
                  disabled={effectiveReadonly || isPendingReview || lockedIfSet(padreHasValue)}
                  {...register("padre_anilla")}
                />
              </div>
              <div>
                <div className="flex items-center gap-4 mb-2 flex-wrap">
                  <label className="text-xs text-gray-500">Madre</label>
                  <div className="flex gap-3 flex-wrap">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="madreMode"
                        checked={madreMode === "individual"}
                        onChange={() => { setMadreMode("individual"); setMadreLoteId(""); setMadreLoteExterno(""); }}
                        className="accent-blue-700"
                        disabled={effectiveReadonly || isPendingReview || lockedIfSet(madreHasValue)}
                      />
                      Individual
                    </label>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="madreMode"
                        checked={madreMode === "lote"}
                        onChange={() => { setMadreMode("lote"); setMadreLoteExterno(""); }}
                        className="accent-blue-700"
                        disabled={effectiveReadonly || isPendingReview || lockedIfSet(madreHasValue)}
                      />
                      Lote de Cría
                    </label>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="madreMode"
                        checked={madreMode === "externo"}
                        onChange={() => { setMadreMode("externo"); setMadreLoteId(""); }}
                        className="accent-blue-700"
                        disabled={effectiveReadonly || isPendingReview || lockedIfSet(madreHasValue)}
                      />
                      Lote de Cría de otro Criador
                    </label>
                  </div>
                </div>

                {madreMode === "individual" ? (
                  <input
                    type="text"
                    className="input-field font-mono"
                    placeholder="Nº anilla de la madre"
                    disabled={effectiveReadonly || isPendingReview || lockedIfSet(madreHasValue)}
                    {...register("madre_anilla")}
                  />
                ) : madreMode === "lote" ? (
                  <select
                    className="input-field"
                    value={madreLoteId}
                    disabled={effectiveReadonly || isPendingReview || lockedIfSet(madreHasValue)}
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
                ) : (
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Descripción del lote externo (ej: Ganadería García 2023)"
                    value={madreLoteExterno}
                    disabled={effectiveReadonly || isPendingReview || lockedIfSet(madreHasValue)}
                    onChange={(e) => setMadreLoteExterno(e.target.value)}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Farm & candidato */}
          {granjasEnabled && (
            <div className="border-t pt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Granja</label>
                <select className="input-field" disabled={effectiveReadonly || isPendingReview} {...register("granja")}>
                  <option value="">Sin asignar</option>
                  {granjasData?.results.map((g) => (
                    <option key={g.id} value={g.id}>{g.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
          )}


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

          {/* Fotos — antes de los botones */}
          {(isEdit || !isGestionCreate) && (
            <div className="border-t pt-4 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Fotos</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isEdit
                    ? "Fotos del animal (perfil, cabeza, anilla)."
                    : "Puedes añadir las fotos ahora — se subirán al registrar el animal."}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {FOTO_TIPOS.map(({ tipo, label }) => {
                  const foto = isEdit ? getFotoByTipo(tipo) : undefined;
                  const previewUrl = !isEdit ? pendingPreviews[tipo] : undefined;
                  const hasPhoto = !!foto || !!previewUrl;
                  const isUploading = uploadingTipo === tipo;
                  return (
                    <div key={tipo} className="flex flex-col items-center gap-1.5">
                      <div className="flex items-center gap-1 text-xs font-medium">
                        {hasPhoto ? (
                          <CheckCircle2 size={14} className="text-green-600" />
                        ) : (
                          <Circle size={14} className="text-gray-300" />
                        )}
                        <span className={hasPhoto ? "text-green-700" : "text-gray-400"}>{label}</span>
                      </div>
                      <div className="relative w-full aspect-square">
                        {hasPhoto ? (
                          <>
                            <img
                              src={foto?.url ?? previewUrl}
                              alt={`Foto ${label}`}
                              className="w-full h-full object-cover rounded-lg"
                            />
                            {!effectiveReadonly && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (isEdit && foto) {
                                    deleteFotoMutation.mutate(foto.key);
                                  } else {
                                    URL.revokeObjectURL(previewUrl!);
                                    setPendingPhotos((p) => { const n = { ...p }; delete n[tipo]; return n; });
                                    setPendingPreviews((p) => { const n = { ...p }; delete n[tipo]; return n; });
                                  }
                                }}
                                disabled={deleteFotoMutation.isPending}
                                className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-700"
                                title="Eliminar foto"
                              >
                                {deleteFotoMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
                              </button>
                            )}
                          </>
                        ) : (
                          !effectiveReadonly && (
                            <button
                              type="button"
                              onClick={() => {
                                if (isEdit) {
                                  setUploadingTipo(tipo);
                                  fileInputRefs.current[tipo]?.click();
                                } else {
                                  pendingFileRefs.current[tipo]?.click();
                                }
                              }}
                              disabled={isUploading || uploadFotoMutation.isPending}
                              className="w-full h-full rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                            >
                              {isUploading ? <Loader2 size={20} className="animate-spin" /> : <><Camera size={20} /><span className="text-xs mt-1">Añadir</span></>}
                            </button>
                          )
                        )}
                      </div>
                      <input ref={(el) => { fileInputRefs.current[tipo] = el; }} type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const file = e.target.files?.[0]; if (file) { uploadFotoMutation.mutate({ file, tipo }); e.target.value = ""; } else { setUploadingTipo(null); } }} />
                      <input ref={(el) => { pendingFileRefs.current[tipo] = el; }} type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const file = e.target.files?.[0]; if (file) { const url = URL.createObjectURL(file); setPendingPhotos((p) => ({ ...p, [tipo]: file })); setPendingPreviews((p) => ({ ...p, [tipo]: url })); } e.target.value = ""; }} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">
              {(effectiveReadonly || isPendingReview) ? "Volver" : "Cancelar"}
            </button>
            {!effectiveReadonly && !isPendingReview && (
              <button
                type="submit"
                disabled={isSubmitting || mutation.isPending}
                className="btn-primary flex-1"
              >
                {mutation.isPending ? (
                  <><Loader2 size={16} className="animate-spin" /> Guardando...</>
                ) : (
                  isEdit ? "Guardar cambios" : "Registrar Animal"
                )}
              </button>
            )}
            {readonly && !isRechazado && (
              <button
                type="button"
                onClick={() => navigate(`/mis-animales/${id}`)}
                className="btn-primary flex-1"
              >
                Editar
              </button>
            )}
          </div>
        </form>

      </div>

      {/* Ganadería history — only in edit mode when data exists */}
      {isEdit && (animal?.historico_ganaderias ?? []).length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <History size={16} className="text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-700">Historial de Ganaderías</h3>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-3 py-2 text-left">Ganadería</th>
                  <th className="px-3 py-2 text-left whitespace-nowrap">Fecha Alta</th>
                  <th className="px-3 py-2 text-left whitespace-nowrap">Fecha Baja</th>
                </tr>
              </thead>
              <tbody>
                {(animal?.historico_ganaderias ?? []).map((g, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-800">{g.ganaderia}</td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{g.fecha_alta ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {g.fecha_baja
                        ? <span className="text-gray-500">{g.fecha_baja}</span>
                        : <span className="text-green-600 font-medium text-xs">Actual</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            {!effectiveReadonly && (
              <button
                onClick={() => setShowPesajeForm(!showPesajeForm)}
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
              >
                <Plus size={14} />
                Añadir Pesaje
              </button>
            )}
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
