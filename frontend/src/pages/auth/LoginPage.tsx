import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Bird, Eye, EyeOff, Loader2 } from "lucide-react";
import { authApi } from "../../api/auth";
import { apiClient } from "../../api/client";
import { useAuthStore } from "../../store/authStore";
import { useTenantStore, applyBranding } from "../../store/tenantStore";
import type { TenantBranding } from "../../types";

interface FormData {
  email: string;
  password: string;
  access_as_gestion: boolean;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth, user } = useAuthStore();
  const { branding, setBranding, slug } = useTenantStore();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [tenantSlug, setTenantSlug] = useState(slug ?? "");
  const [isLoadingBranding, setIsLoadingBranding] = useState(false);

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: { access_as_gestion: false },
  });

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate(user.is_gestion ? "/dashboard" : "/mis-animales", { replace: true });
    }
  }, [user, navigate]);

  // Load branding when slug changes
  useEffect(() => {
    if (!tenantSlug) return;
    const t = setTimeout(async () => {
      setIsLoadingBranding(true);
      try {
        const { data } = await apiClient.get<TenantBranding>("/tenants/current/branding/", {
          headers: { "X-Tenant-Slug": tenantSlug },
        });
        setBranding(data);
        applyBranding(data);
        localStorage.setItem("tenant_slug", tenantSlug);
      } catch {
        // slug not found or offline
      } finally {
        setIsLoadingBranding(false);
      }
    }, 600); // debounce
    return () => clearTimeout(t);
  }, [tenantSlug, setBranding]);

  const onSubmit = async (data: FormData) => {
    setError("");
    try {
      const res = await authApi.login(data.email, data.password, data.access_as_gestion);
      setAuth(res.user, res.access, res.refresh);
      navigate(res.user.is_gestion ? "/dashboard" : "/mis-animales", { replace: true });
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? err?.response?.data?.non_field_errors?.[0] ?? "Credenciales incorrectas.";
      setError(detail);
    }
  };

  const primaryColor = branding?.primary_color ?? "#1565C0";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: primaryColor }}
          >
            {branding?.logo_url ? (
              <img src={branding.logo_url} alt="Logo" className="w-10 h-10 object-cover rounded" />
            ) : (
              <Bird size={32} className="text-white" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {branding?.name ?? "AGAMUR"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Libros Genealógicos Avícolas</p>
        </div>

        {/* Tenant slug input */}
        <div className="card mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Código de asociación
          </label>
          <div className="relative">
            <input
              type="text"
              className="input-field pr-8"
              placeholder="p.ej. demo"
              value={tenantSlug}
              onChange={(e) => setTenantSlug(e.target.value.toLowerCase().trim())}
              autoCapitalize="none"
              autoComplete="organization"
            />
            {isLoadingBranding && (
              <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
            )}
          </div>
          {branding && tenantSlug === branding.slug && (
            <p className="text-xs text-green-700 mt-1">✓ {branding.name}</p>
          )}
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

            {/* Dual-mode checkbox */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-gray-300 accent-blue-700"
                {...register("access_as_gestion")}
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">
                Acceder como equipo de Gestión
              </span>
            </label>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full"
              style={{ background: primaryColor }}
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
