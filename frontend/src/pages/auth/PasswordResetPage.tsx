import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { authApi } from "../../api/auth";
import { Bird, Loader2, CheckCircle2 } from "lucide-react";

export default function PasswordResetPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [done, setDone] = useState(false);

  if (token) {
    return <ConfirmForm token={token} onDone={() => setDone(true)} done={done} />;
  }
  return <RequestForm onDone={() => setDone(true)} done={done} />;
}

function RequestForm({ onDone, done }: { onDone: () => void; done: boolean }) {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<{ email: string }>();
  const [error, setError] = useState("");

  const onSubmit = async ({ email }: { email: string }) => {
    try {
      await authApi.requestPasswordReset(email);
      onDone();
    } catch {
      setError("Error al enviar el email. Inténtalo de nuevo.");
    }
  };

  return (
    <PageWrapper title="Restablecer contraseña">
      {done ? (
        <div className="text-center py-6">
          <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
          <p className="text-gray-700">
            Si ese email existe, recibirás un enlace de restablecimiento en breve.
          </p>
          <Link to="/login" className="btn-primary mt-4 inline-flex">Volver al inicio</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" className="input-field" {...register("email", { required: true })} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Enviar enlace"}
          </button>
          <Link to="/login" className="block text-center text-sm text-gray-500 hover:underline">Volver</Link>
        </form>
      )}
    </PageWrapper>
  );
}

function ConfirmForm({ token, onDone, done }: { token: string; onDone: () => void; done: boolean }) {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<{ new_password: string }>();
  const [error, setError] = useState("");

  const onSubmit = async ({ new_password }: { new_password: string }) => {
    try {
      await authApi.confirmPasswordReset(token, new_password);
      onDone();
    } catch {
      setError("Token inválido o expirado.");
    }
  };

  return (
    <PageWrapper title="Nueva contraseña">
      {done ? (
        <div className="text-center py-6">
          <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
          <p className="text-gray-700">Contraseña actualizada correctamente.</p>
          <Link to="/login" className="btn-primary mt-4 inline-flex">Iniciar sesión</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
            <input
              type="password"
              className="input-field"
              autoComplete="new-password"
              {...register("new_password", { required: true, minLength: 8 })}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Guardar contraseña"}
          </button>
        </form>
      )}
    </PageWrapper>
  );
}

function PageWrapper({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Bird size={40} className="text-blue-800 mx-auto mb-2" />
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        </div>
        <div className="card">{children}</div>
      </div>
    </div>
  );
}
