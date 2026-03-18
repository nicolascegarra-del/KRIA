import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { sociosApi } from "../../api/socios";
import Modal from "../../components/Modal";
import ErrorAlert from "../../components/ErrorAlert";
import SuccessToast from "../../components/SuccessToast";
import { useAutoCloseError } from "../../hooks/useAutoCloseError";
import { Search, UserX, Loader2, Users, Plus, Pencil, ExternalLink } from "lucide-react";
import type { Socio } from "../../types";

interface SocioFormData {
  nombre_razon_social: string;
  dni_nif: string;
  email: string;
  first_name: string;
  last_name: string;
  telefono: string;
  numero_socio: string;
  codigo_rega: string;
  direccion: string;
}

type ModalMode = "create" | "edit";

interface SocioModalProps {
  mode: ModalMode;
  socio?: Socio | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function SocioModal({ mode, socio, onClose, onSuccess }: SocioModalProps) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SocioFormData>({
    defaultValues:
      mode === "edit" && socio
        ? {
            nombre_razon_social: socio.nombre_razon_social ?? "",
            dni_nif: socio.dni_nif ?? "",
            email: socio.email ?? "",
            first_name: "",
            last_name: "",
            telefono: socio.telefono ?? "",
            numero_socio: socio.numero_socio ?? "",
            codigo_rega: socio.codigo_rega ?? "",
            direccion: socio.direccion ?? "",
          }
        : {},
  });

  const [error, setError, clearError] = useAutoCloseError();

  const createMutation = useMutation({
    mutationFn: (data: Partial<Socio>) => sociosApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["socios"] });
      onSuccess("Socio creado correctamente.");
      onClose();
    },
    onError: (err: any) => {
      const d = err?.response?.data;
      setError(
        d?.detail ??
          (typeof d === "object"
            ? Object.entries(d)
                .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
                .join(" | ")
            : "Error al guardar.")
      );
    },
  });

  const editMutation = useMutation({
    mutationFn: (data: Partial<Socio>) => sociosApi.update(socio!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["socios"] });
      onSuccess("Socio actualizado correctamente.");
      onClose();
    },
    onError: (err: any) => {
      const d = err?.response?.data;
      setError(
        d?.detail ??
          (typeof d === "object"
            ? Object.entries(d)
                .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
                .join(" | ")
            : "Error al guardar.")
      );
    },
  });

  const isPending = createMutation.isPending || editMutation.isPending;

  const onSubmit = (data: SocioFormData) => {
    clearError();
    const payload: any = {
      nombre_razon_social: data.nombre_razon_social,
      dni_nif: data.dni_nif,
      first_name: data.first_name,
      last_name: data.last_name,
      telefono: data.telefono || undefined,
      numero_socio: data.numero_socio || undefined,
      codigo_rega: data.codigo_rega || undefined,
      direccion: data.direccion || undefined,
    };
    if (mode === "create") {
      payload.email = data.email;
      createMutation.mutate(payload);
    } else {
      editMutation.mutate(payload);
    }
  };

  return (
    <Modal title={mode === "create" ? "Nuevo Socio" : "Editar Socio"} onClose={onClose}>
      {mode === "create" && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 mb-4">
          Se generará una contraseña automática y se enviará al email del socio.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre / Razón Social *
            </label>
            <input
              className="input-field"
              {...register("nombre_razon_social", { required: true })}
            />
            {errors.nombre_razon_social && (
              <p className="text-xs text-red-600 mt-1">Requerido</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DNI / NIF *</label>
            <input className="input-field" {...register("dni_nif", { required: true })} />
            {errors.dni_nif && <p className="text-xs text-red-600 mt-1">Requerido</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email {mode === "create" ? "*" : "(no editable)"}
            </label>
            <input
              type="email"
              className="input-field"
              disabled={mode === "edit"}
              {...register("email", { required: mode === "create" })}
            />
            {errors.email && <p className="text-xs text-red-600 mt-1">Requerido</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input className="input-field" {...register("first_name")} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos</label>
            <input className="input-field" {...register("last_name")} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input className="input-field" {...register("telefono")} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nº Socio</label>
            <input className="input-field" {...register("numero_socio")} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código REGA</label>
            <input className="input-field" {...register("codigo_rega")} />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
            <input className="input-field" {...register("direccion")} />
          </div>
        </div>

        <ErrorAlert message={error} onDismiss={clearError} />

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button type="submit" disabled={isPending} className="btn-primary flex-1">
            {isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : mode === "create" ? (
              "Crear Socio"
            ) : (
              "Guardar cambios"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function SociosPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [bajaModal, setBajaModal] = useState<Socio | null>(null);
  const [razonBaja, setRazonBaja] = useState("");
  const [socioModal, setSocioModal] = useState<{ mode: ModalMode; socio?: Socio } | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["socios", search],
    queryFn: () => sociosApi.list({ search }),
  });

  const bajaMutation = useMutation({
    mutationFn: ({ id, razon }: { id: string; razon: string }) =>
      sociosApi.darBaja(id, razon),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["socios"] });
      setBajaModal(null);
      setSuccessMsg("Socio dado de baja.");
    },
  });

  const socios = data?.results ?? [];

  return (
    <div className="space-y-4">
      <SuccessToast message={successMsg} onDismiss={() => setSuccessMsg("")} />

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Socios</h1>
          <p className="text-sm text-gray-500">{data?.count ?? 0} socios</p>
        </div>
        <button
          onClick={() => setSocioModal({ mode: "create" })}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} />
          Nuevo Socio
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, DNI o número de socio..."
          className="input-field pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card h-16 animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : socios.length === 0 ? (
        <div className="card text-center py-8">
          <Users size={40} className="text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">No se encontraron socios.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {socios.map((socio) => (
            <div key={socio.id} className="card">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{socio.nombre_razon_social}</span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        socio.estado === "ALTA"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {socio.estado}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 flex gap-3 mt-0.5 flex-wrap">
                    <span>DNI: {socio.dni_nif}</span>
                    {socio.numero_socio && <span>Nº {socio.numero_socio}</span>}
                    {socio.codigo_rega && <span>REGA: {socio.codigo_rega}</span>}
                    <span>{socio.email}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/socios/${socio.id}`)}
                    className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Ver ficha completa"
                    aria-label={`Ver ficha de ${socio.nombre_razon_social}`}
                  >
                    <ExternalLink size={16} />
                  </button>
                  <button
                    onClick={() => setSocioModal({ mode: "edit", socio })}
                    className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Editar socio"
                    aria-label={`Editar ${socio.nombre_razon_social}`}
                  >
                    <Pencil size={16} />
                  </button>
                  {socio.estado === "ALTA" && (
                    <button
                      onClick={() => {
                        setBajaModal(socio);
                        setRazonBaja("");
                      }}
                      className="p-2 rounded-lg bg-red-700 text-white hover:bg-red-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Dar de baja"
                      aria-label={`Dar de baja a ${socio.nombre_razon_social}`}
                    >
                      <UserX size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {socioModal && (
        <SocioModal
          mode={socioModal.mode}
          socio={socioModal.socio}
          onClose={() => setSocioModal(null)}
          onSuccess={setSuccessMsg}
        />
      )}

      {bajaModal && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="baja-modal-title"
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4"
          >
            <h2 id="baja-modal-title" className="text-lg font-bold text-gray-900">
              Dar de Baja a Socio
            </h2>
            <p className="text-sm text-gray-600">
              Socio: <strong>{bajaModal.nombre_razon_social}</strong>
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              ⚠️ Todos los animales del socio pasarán a estado "Socio en Baja".
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Razón de baja *
              </label>
              <textarea
                className="input-field h-20 resize-none"
                value={razonBaja}
                onChange={(e) => setRazonBaja(e.target.value)}
                placeholder="Motivo de la baja..."
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setBajaModal(null)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                onClick={() => bajaMutation.mutate({ id: bajaModal.id, razon: razonBaja })}
                disabled={!razonBaja.trim() || bajaMutation.isPending}
                className="btn-danger flex-1"
              >
                {bajaMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  "Confirmar Baja"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
