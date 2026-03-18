import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import { apiClient } from "../api/client";
import SuccessToast from "../components/SuccessToast";
import ErrorAlert from "../components/ErrorAlert";
import { useAutoCloseError } from "../hooks/useAutoCloseError";
import { User, KeyRound, Loader2 } from "lucide-react";

interface PasswordFormData {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export default function PerfilPage() {
  const { user } = useAuthStore();
  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError, clearError] = useAutoCloseError();

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<PasswordFormData>();
  const newPassword = watch("new_password");

  const mutation = useMutation({
    mutationFn: async (data: PasswordFormData) => {
      await apiClient.post("/accounts/me/change-password/", {
        current_password: data.current_password,
        new_password: data.new_password,
      });
    },
    onSuccess: () => {
      reset();
      setSuccessMsg("Contraseña actualizada correctamente.");
    },
    onError: (e: any) => {
      const d = e?.response?.data;
      setError(d?.detail ?? d?.current_password?.[0] ?? d?.new_password?.[0] ?? "Error al cambiar la contraseña.");
    },
  });

  return (
    <div className="max-w-lg space-y-6">
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
        <dl className="grid grid-cols-2 gap-3 text-sm border-t pt-3">
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

      {/* Cambio de contraseña */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound size={18} className="text-gray-500" />
          <h2 className="text-base font-semibold text-gray-800">Cambiar contraseña</h2>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña actual *
            </label>
            <input
              type="password"
              className="input-field"
              autoComplete="current-password"
              {...register("current_password", { required: "Requerido" })}
            />
            {errors.current_password && (
              <p className="text-xs text-red-600 mt-1">{errors.current_password.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nueva contraseña *
            </label>
            <input
              type="password"
              className="input-field"
              autoComplete="new-password"
              {...register("new_password", {
                required: "Requerido",
                minLength: { value: 8, message: "Mínimo 8 caracteres" },
              })}
            />
            {errors.new_password && (
              <p className="text-xs text-red-600 mt-1">{errors.new_password.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar nueva contraseña *
            </label>
            <input
              type="password"
              className="input-field"
              autoComplete="new-password"
              {...register("confirm_password", {
                required: "Requerido",
                validate: (v) => v === newPassword || "Las contraseñas no coinciden",
              })}
            />
            {errors.confirm_password && (
              <p className="text-xs text-red-600 mt-1">{errors.confirm_password.message}</p>
            )}
          </div>

          <ErrorAlert message={error} onDismiss={clearError} />

          <button
            type="submit"
            disabled={mutation.isPending}
            className="btn-primary w-full disabled:opacity-50"
          >
            {mutation.isPending ? (
              <><Loader2 size={16} className="animate-spin" /> Guardando...</>
            ) : (
              "Cambiar contraseña"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
