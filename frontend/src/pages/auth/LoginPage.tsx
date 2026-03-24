import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Bird, Eye, EyeOff, Loader2 } from "lucide-react";
import { authApi } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";

interface FormData {
  email: string;
  password: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth, user } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormData>();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      if (user.is_superadmin) navigate("/superadmin", { replace: true });
      else navigate(user.is_gestion ? "/dashboard" : "/mis-animales", { replace: true });
    }
  }, [user, navigate]);

  const onSubmit = async (data: FormData) => {
    setError("");
    try {
      const res = await authApi.login(data.email, data.password);
      setAuth(res.user, res.access, res.refresh);
      if (res.user.is_superadmin) {
        navigate("/superadmin", { replace: true });
      } else if (res.user.is_gestion) {
        navigate("/dashboard", { replace: true });
      } else {
        navigate("/mis-animales", { replace: true });
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? err?.response?.data?.non_field_errors?.[0] ?? "Credenciales incorrectas.";
      setError(detail);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 bg-blue-700">
            <Bird size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">KRIA</h1>
          <p className="text-sm text-gray-500 mt-1">Libros Genealógicos Avícolas</p>
        </div>

        {/* Login form */}
        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                className="input-field"
                autoComplete="email"
                {...register("email", { required: true })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input-field pr-12"
                  autoComplete="current-password"
                  {...register("password", { required: true })}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 min-h-0"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full"
            >
              {isSubmitting ? (
                <><Loader2 size={18} className="animate-spin" /> Accediendo...</>
              ) : (
                "Iniciar sesión"
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link
              to="/auth/reset-password"
              className="text-sm text-blue-700 hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
