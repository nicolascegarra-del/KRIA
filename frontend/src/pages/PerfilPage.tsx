import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import { apiClient } from "../api/client";
import { perfilSocioApi } from "../api/perfilSocio";
import SuccessToast from "../components/SuccessToast";
import ErrorAlert from "../components/ErrorAlert";
import { useAutoCloseError } from "../hooks/useAutoCloseError";
import { User, KeyRound, Loader2, ClipboardEdit, Lock, Clock, BadgeCheck } from "lucide-react";

// ─── Cambio de contraseña ─────────────────────────────────────────────────────

interface PasswordFormData {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

// ─── Formulario de datos de socio ─────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  telefono: "Teléfono",
  domicilio: "Domicilio",
  municipio: "Municipio",
  codigo_postal: "Código postal",
  provincia: "Provincia",
  numero_cuenta: "Número de cuenta (IBAN)",
  codigo_rega: "Código REGA",
  email: "Email de acceso",
};

const EDITABLE_FIELDS = Object.keys(FIELD_LABELS) as (keyof typeof FIELD_LABELS)[];

export default function PerfilPage() {
  const { user } = useAuthStore();
  const isSocio = !!user && !user.is_gestion && !user.is_superadmin;

  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError, clearError] = useAutoCloseError();

  // ── Contraseña ──────────────────────────────────────────────────────────────
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<PasswordFormData>();
  const newPassword = watch("new_password");

  const passwordMutation = useMutation({
    mutationFn: async (data: PasswordFormData) => {
      await apiClient.post("/auth/me/change-password/", {
        current_password: data.current_password,
        new_password: data.new_password,
      });
    },
    onSuccess: () => { reset(); setSuccessMsg("Contraseña actualizada correctamente."); },
    onError: (e: any) => {
      const d = e?.response?.data;
      setError(d?.detail ?? d?.current_password?.[0] ?? d?.new_password?.[0] ?? "Error al cambiar la contraseña.");
    },
  });

  // ── Datos de socio ──────────────────────────────────────────────────────────
  const { data: socio, isLoading: loadingSocio } = useQuery({
    queryKey: ["socio-me"],
    queryFn: perfilSocioApi.getMe,
    enabled: isSocio,
  });

  const [editMode, setEditMode] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [cambioError, setCambioError] = useState("");
  const [cambioSuccess, setCambioSuccess] = useState(false);

  useEffect(() => {
    if (socio) {
      setFormValues({
        telefono: socio.telefono ?? "",
        domicilio: socio.domicilio ?? "",
        municipio: socio.municipio ?? "",
        codigo_postal: socio.codigo_postal ?? "",
        provincia: socio.provincia ?? "",
        numero_cuenta: socio.numero_cuenta ?? "",
        codigo_rega: socio.codigo_rega ?? "",
        email: socio.email ?? "",
      });
    }
  }, [socio]);

  const cambioDatosMutation = useMutation({
    mutationFn: () => {
      // Only send fields that differ from current values
      const current: Record<string, string> = {
        telefono: socio?.telefono ?? "",
        domicilio: socio?.domicilio ?? "",
        municipio: socio?.municipio ?? "",
        codigo_postal: socio?.codigo_postal ?? "",
        provincia: socio?.provincia ?? "",
        numero_cuenta: socio?.numero_cuenta ?? "",
        codigo_rega: socio?.codigo_rega ?? "",
        email: socio?.email ?? "",
      };
      const changed: Record<string, string> = {};
      for (const key of EDITABLE_FIELDS) {
        if (formValues[key] !== current[key]) {
          changed[key] = formValues[key];
        }
      }
      return perfilSocioApi.solicitarCambio(changed);
    },
    onSuccess: () => {
      setEditMode(false);
      setCambioSuccess(true);
      setCambioError("");
      setTimeout(() => setCambioSuccess(false), 5000);
    },
    onError: (e: any) => {
      const d = e?.response?.data;
      setCambioError(d?.detail ?? "Error al enviar la solicitud.");
    },
  });

  const hasChanges = socio && EDITABLE_FIELDS.some(
    (k) => formValues[k] !== (k === "email" ? (socio.email ?? "") : (socio as any)[k] ?? "")
  );

  return (
    <div className="max-w-2xl space-y-6">
      <SuccessToast message={successMsg} onDismiss={() => setSuccessMsg("")} />

      <h1 className="text-xl font-bold text-gray-900">Mi Perfil</h1>

      {/* Info del usuario */}
      <div className="card space-y-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <User size={20} className="text-blue-700" />
          </div>
          <div>
            <div className="font-semibold text-gray-900">{user?.full_name || user?.email}</div>
            <div className="text-sm text-gray-500">{user?.email}</div>
          </div>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm border-t pt-3">
          <div>
            <dt className="text-xs text-gray-400">Rol</dt>
            <dd className="font-medium text-gray-800">
              {user?.is_superadmin ? "Super Admin" : user?.is_gestion ? "Gestión" : "Socio"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Asociación</dt>
            <dd className="font-medium text-gray-800 font-mono">{user?.tenant_slug}</dd>
          </div>
        </dl>
      </div>

      {/* Datos del socio — solo para socios */}
      {isSocio && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardEdit size={18} className="text-gray-500" />
              <h2 className="text-base font-semibold text-gray-800">Datos del socio</h2>
            </div>
            {!editMode && !loadingSocio && (
              <button
                onClick={() => { setEditMode(true); setCambioError(""); }}
                className="btn-secondary text-sm"
              >
                Modificar datos
              </button>
            )}
          </div>

          {loadingSocio ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
              <Loader2 size={16} className="animate-spin" /> Cargando...
            </div>
          ) : socio ? (
            <>
              {/* Datos de solo lectura */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                  <Lock size={11} /> Datos no modificables
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-gray-400 mb-0.5">Nombre / Razón social</dt>
                    <dd className="font-medium text-gray-800">{socio.nombre_razon_social}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-400 mb-0.5">DNI / NIF</dt>
                    <dd className="font-medium text-gray-800 font-mono">{socio.dni_nif || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-400 mb-0.5">Número de socio</dt>
                    <dd className="font-medium text-gray-800">{socio.numero_socio || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-400 mb-0.5">Fecha de alta</dt>
                    <dd className="font-medium text-gray-800">
                      {socio.fecha_alta ? new Date(socio.fecha_alta).toLocaleDateString("es-ES") : "—"}
                    </dd>
                  </div>
                </div>
                {/* Cuota */}
                <div className="border-t border-gray-200 pt-3 flex items-center gap-2">
                  {socio.cuota_anual_pagada ? (
                    <>
                      <BadgeCheck size={16} className="text-green-600 shrink-0" />
                      <span className="text-sm text-green-700 font-medium">
                        Cuota Anualidad Año <strong>{socio.cuota_anual_pagada}</strong> Pagada
                      </span>
                    </>
                  ) : (
                    <>
                      <Clock size={16} className="text-amber-500 shrink-0" />
                      <span className="text-sm text-amber-700">Sin información de cuota anual</span>
                    </>
                  )}
                </div>
              </div>

              {/* Datos editables */}
              {!editMode ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {EDITABLE_FIELDS.map((key) => (
                    <div key={key}>
                      <dt className="text-xs text-gray-400 mb-0.5">{FIELD_LABELS[key]}</dt>
                      <dd className="font-medium text-gray-800">
                        {(key === "email" ? socio.email : (socio as any)[key]) || <span className="text-gray-400 italic">sin datos</span>}
                      </dd>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-blue-700 bg-blue-50 rounded-lg p-3">
                    Los cambios que realices serán enviados a gestión para su validación. Se aplicarán una vez aprobados.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {EDITABLE_FIELDS.map((key) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {FIELD_LABELS[key]}
                        </label>
                        <input
                          type={key === "email" ? "email" : "text"}
                          className="input-field text-sm"
                          value={formValues[key] ?? ""}
                          onChange={(e) => setFormValues((prev) => ({ ...prev, [key]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                  {cambioError && (
                    <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{cambioError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => cambioDatosMutation.mutate()}
                      disabled={!hasChanges || cambioDatosMutation.isPending}
                      className="btn-primary text-sm flex items-center gap-2 disabled:opacity-40"
                    >
                      {cambioDatosMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                      Enviar solicitud de cambio
                    </button>
                    <button
                      onClick={() => { setEditMode(false); setCambioError(""); }}
                      className="btn-secondary text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {cambioSuccess && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg p-3">
                  <BadgeCheck size={16} />
                  Solicitud enviada correctamente. Gestión revisará tus cambios.
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* Cambio de contraseña */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound size={18} className="text-gray-500" />
          <h2 className="text-base font-semibold text-gray-800">Cambiar contraseña</h2>
        </div>

        <form onSubmit={handleSubmit((d) => passwordMutation.mutate(d))} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña actual *</label>
            <input
              type="password"
              className="input-field"
              autoComplete="current-password"
              {...register("current_password", { required: "Requerido" })}
            />
            {errors.current_password && <p className="text-xs text-red-600 mt-1">{errors.current_password.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña *</label>
            <input
              type="password"
              className="input-field"
              autoComplete="new-password"
              {...register("new_password", { required: "Requerido", minLength: { value: 8, message: "Mínimo 8 caracteres" } })}
            />
            {errors.new_password && <p className="text-xs text-red-600 mt-1">{errors.new_password.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nueva contraseña *</label>
            <input
              type="password"
              className="input-field"
              autoComplete="new-password"
              {...register("confirm_password", {
                required: "Requerido",
                validate: (v) => v === newPassword || "Las contraseñas no coinciden",
              })}
            />
            {errors.confirm_password && <p className="text-xs text-red-600 mt-1">{errors.confirm_password.message}</p>}
          </div>
          <ErrorAlert message={error} onDismiss={clearError} />
          <button type="submit" disabled={passwordMutation.isPending} className="btn-primary w-full disabled:opacity-50">
            {passwordMutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : "Cambiar contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}
