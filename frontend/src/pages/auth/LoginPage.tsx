import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Bird, Eye, EyeOff, Loader2, BookOpen, Shield, BarChart2 } from "lucide-react";
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
    <div className="min-h-screen flex">
      {/* Panel izquierdo — branding */}
      <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex-col justify-between p-12 text-white relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-white/5 pointer-events-none" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Bird size={22} className="text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">KRIA</span>
        </div>

        {/* Copy */}
        <div className="space-y-8 relative z-10">
          <div>
            <h1 className="text-4xl font-bold leading-tight">
              Gestión de Libros<br />Genealógicos Avícolas
            </h1>
            <p className="mt-4 text-blue-200 text-lg leading-relaxed max-w-md">
              Plataforma integral para asociaciones avícolas: registro genealógico, evaluaciones morfológicas y catálogos de reproductores.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <BookOpen size={17} />
              </div>
              <div>
                <p className="font-semibold text-sm">Registro genealógico completo</p>
                <p className="text-blue-300 text-sm mt-0.5">Trazabilidad total con árbol genealógico por ejemplar</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <Shield size={17} />
              </div>
              <div>
                <p className="font-semibold text-sm">Validación y evaluación morfológica</p>
                <p className="text-blue-300 text-sm mt-0.5">Flujo de aprobación con puntuación por criterios estándar</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <BarChart2 size={17} />
              </div>
              <div>
                <p className="font-semibold text-sm">Informes y certificados</p>
                <p className="text-blue-300 text-sm mt-0.5">Generación de PDFs y exportación Excel con un clic</p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-blue-400 text-xs relative z-10">
          © {new Date().getFullYear()} KRIA · Plataforma de Libros Genealógicos
        </p>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-sm">
          {/* Logo móvil */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 bg-blue-700">
              <Bird size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">KRIA</h1>
            <p className="text-sm text-gray-500 mt-1">Libros Genealógicos Avícolas</p>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Bienvenido</h2>
            <p className="text-sm text-gray-500 mt-1">Accede a tu cuenta para continuar</p>
          </div>

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
    </div>
  );
}
