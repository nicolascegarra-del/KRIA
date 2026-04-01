import { useEffect, useState, useCallback } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import { useTenantStore, applyBranding } from "./store/tenantStore";
import { apiClient } from "./api/client";
import { useInactivityLogout } from "./hooks/useInactivityLogout";
import type { TenantBranding } from "./types";
import { Clock } from "lucide-react";

// Auth pages
import LoginPage from "./pages/auth/LoginPage";
import PasswordResetPage from "./pages/auth/PasswordResetPage";

// Shared pages
import PerfilPage from "./pages/PerfilPage";
import PropuestaMejoraPage from "./pages/PropuestaMejoraPage";

// Socio pages
import MisAnimalesPage from "./pages/socio/MisAnimalesPage";
import AnimalFormPage from "./pages/socio/AnimalFormPage";
import GranjasPage from "./pages/socio/GranjasPage";
import MisLotesPage from "./pages/socio/MisLotesPage";
import MisAnillasPage from "./pages/socio/MisAnillasPage";
import MisAuditoriasPage from "./pages/socio/MisAuditoriasPage";

// Gestion pages
import GranjasGestionPage from "./pages/gestion/GranjasGestionPage";
import DashboardPage from "./pages/gestion/DashboardPage";
import ValidacionesPage from "./pages/gestion/ValidacionesPage";
import SociosPage from "./pages/gestion/SociosPage";
import SocioDetailPage from "./pages/gestion/SocioDetailPage";
import ImportPage from "./pages/gestion/ImportPage";
import ReportesPage from "./pages/gestion/ReportesPage";
import EvaluacionPage from "./pages/gestion/EvaluacionPage";
import CandidatosReproductorPage from "./pages/gestion/CandidatosReproductorPage";
import CatalogoReproductoresPage from "./pages/gestion/CatalogoReproductoresPage";
import SuperAdminPage from "./pages/gestion/SuperAdminPage";
import AnillasPage from "./pages/gestion/AnillasPage";
import AuditoriasPage from "./pages/gestion/AuditoriasPage";
import AuditoriaDetailPage from "./pages/gestion/AuditoriaDetailPage";

// Layout
import Layout from "./components/Layout";
import OfflineIndicator from "./components/OfflineIndicator";

function ProtectedRoute({
  children,
  gestionOnly = false,
  socioOnly = false,
  superadminOnly = false,
}: {
  children: React.ReactNode;
  gestionOnly?: boolean;
  socioOnly?: boolean;
  superadminOnly?: boolean;
}) {
  const { user, impersonatingTenant } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  const isSuperadmin = user.is_superadmin && !impersonatingTenant;
  const effectiveIsGestion = !!impersonatingTenant || user.is_gestion;
  if (superadminOnly && !user.is_superadmin) return <Navigate to="/dashboard" replace />;
  // Superadmin sin impersonar no puede acceder a rutas de gestión o socio
  if (isSuperadmin && (gestionOnly || socioOnly)) return <Navigate to="/superadmin" replace />;
  if (gestionOnly && !effectiveIsGestion) return <Navigate to="/mis-animales" replace />;
  if (socioOnly && effectiveIsGestion) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function LayoutRoute({ children, gestionOnly = false, socioOnly = false, superadminOnly = false }: {
  children: React.ReactNode;
  gestionOnly?: boolean;
  socioOnly?: boolean;
  superadminOnly?: boolean;
}) {
  return (
    <ProtectedRoute gestionOnly={gestionOnly} socioOnly={socioOnly} superadminOnly={superadminOnly}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

// ── Inactivity Manager (must be inside BrowserRouter for useNavigate) ─────────
function InactivityManager({ timeoutMinutes }: { timeoutMinutes: number }) {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);

  const handleLogout = useCallback(() => {
    clearAuth();
    navigate("/login");
  }, [clearAuth, navigate]);

  const { reset } = useInactivityLogout({
    timeoutMinutes,
    enabled: !!user && timeoutMinutes > 0,
    onLogout: handleLogout,
    onWarn: () => setShowWarning(true),
    onResetWarn: () => setShowWarning(false),
  });

  if (!showWarning) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-4 max-w-sm w-[calc(100%-2rem)]">
      <Clock size={18} className="shrink-0" />
      <span className="text-sm font-medium flex-1">
        Tu sesión expirará pronto por inactividad.
      </span>
      <button
        onClick={reset}
        className="bg-white text-amber-700 px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap hover:bg-amber-50 transition-colors"
      >
        Continuar
      </button>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const { user, clearAuth, endImpersonation, impersonatingTenant } = useAuthStore();
  const { branding, setBranding, clearBranding } = useTenantStore();
  const [inactivityTimeout, setInactivityTimeout] = useState(0);

  // Listen for forced logout
  useEffect(() => {
    const handler = () => clearAuth();
    window.addEventListener("auth:logout", handler);
    return () => window.removeEventListener("auth:logout", handler);
  }, [clearAuth]);

  // Listen for impersonation token expiry
  useEffect(() => {
    const handler = () => {
      endImpersonation();
      window.location.href = "/superadmin";
    };
    window.addEventListener("impersonation:expired", handler);
    return () => window.removeEventListener("impersonation:expired", handler);
  }, [endImpersonation]);

  // Bootstrap tenant branding — resolved from JWT on the backend
  useEffect(() => {
    if (!user || user.is_superadmin) return;  // superadmins don't have tenant branding
    apiClient
      .get<TenantBranding>("/tenants/current/branding/")
      .then(({ data }) => { setBranding(data); applyBranding(data); })
      .catch(() => {/* Offline — branding from persisted store */});
  }, [user?.tenant_id, setBranding]);

  // Fetch branding when superadmin is impersonating a tenant; clear it when impersonation ends
  useEffect(() => {
    if (!impersonatingTenant) { clearBranding(); return; }
    apiClient
      .get<TenantBranding>("/tenants/current/branding/")
      .then(({ data }) => { setBranding(data); applyBranding(data); })
      .catch(() => {});
  }, [impersonatingTenant?.id, setBranding, clearBranding]);

  // Apply branding from cache immediately (skip for superadmins — they have no tenant branding)
  useEffect(() => {
    if (branding && user && !user.is_superadmin) applyBranding(branding);
  }, [branding, user?.is_superadmin]);

  // Title management
  useEffect(() => {
    if (!user) {
      document.title = "KRIA";
    } else if (user.is_superadmin) {
      document.title = "KRIA";
    }
  }, [user]);

  // Fetch inactivity timeout from public endpoint
  useEffect(() => {
    apiClient
      .get<{ inactivity_timeout_minutes: number }>("/public-settings/")
      .then(({ data }) => setInactivityTimeout(data.inactivity_timeout_minutes))
      .catch(() => {/* ignore — keep default 0 (disabled) */});
  }, []);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <OfflineIndicator />
      <InactivityManager timeoutMinutes={inactivityTimeout} />
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/reset-password" element={<PasswordResetPage />} />

        {/* Shared — autenticado (cualquier rol) */}
        <Route path="/perfil" element={<LayoutRoute><PerfilPage /></LayoutRoute>} />
        <Route path="/propuestas-mejora" element={<LayoutRoute><PropuestaMejoraPage /></LayoutRoute>} />

        {/* Socio routes */}
        <Route path="/mis-animales" element={<LayoutRoute socioOnly><MisAnimalesPage /></LayoutRoute>} />
        <Route path="/mis-animales/nuevo" element={<LayoutRoute socioOnly><AnimalFormPage /></LayoutRoute>} />
        <Route path="/mis-animales/:id" element={<LayoutRoute socioOnly><AnimalFormPage /></LayoutRoute>} />
        <Route path="/mis-granjas" element={<LayoutRoute socioOnly><GranjasPage /></LayoutRoute>} />
        <Route path="/mis-lotes" element={<LayoutRoute socioOnly><MisLotesPage /></LayoutRoute>} />
        <Route path="/mis-anillas" element={<LayoutRoute socioOnly><MisAnillasPage /></LayoutRoute>} />
        <Route path="/mis-auditorias" element={<LayoutRoute socioOnly><MisAuditoriasPage /></LayoutRoute>} />

        {/* Gestion routes */}
        <Route path="/dashboard" element={<LayoutRoute gestionOnly><DashboardPage /></LayoutRoute>} />
        <Route path="/validaciones" element={<LayoutRoute gestionOnly><ValidacionesPage /></LayoutRoute>} />
        <Route path="/socios" element={<LayoutRoute gestionOnly><SociosPage /></LayoutRoute>} />
        <Route path="/socios/:id" element={<LayoutRoute gestionOnly><SocioDetailPage /></LayoutRoute>} />
        <Route path="/socios/:socioId/nuevo-animal" element={<LayoutRoute gestionOnly><AnimalFormPage /></LayoutRoute>} />
        <Route path="/socios/:socioId/animales/:id" element={<LayoutRoute gestionOnly><AnimalFormPage /></LayoutRoute>} />
        <Route path="/granjas" element={<LayoutRoute gestionOnly><GranjasGestionPage /></LayoutRoute>} />
        <Route path="/anillas" element={<LayoutRoute gestionOnly><AnillasPage /></LayoutRoute>} />
        <Route path="/importar" element={<LayoutRoute gestionOnly><ImportPage /></LayoutRoute>} />
        <Route path="/reportes" element={<LayoutRoute gestionOnly><ReportesPage /></LayoutRoute>} />
        <Route path="/evaluaciones/nuevo" element={<LayoutRoute gestionOnly><EvaluacionPage /></LayoutRoute>} />
        <Route path="/reproductores/candidatos" element={<LayoutRoute gestionOnly><CandidatosReproductorPage /></LayoutRoute>} />
        <Route path="/reproductores/catalogo" element={<LayoutRoute gestionOnly><CatalogoReproductoresPage /></LayoutRoute>} />
        <Route path="/auditorias" element={<LayoutRoute gestionOnly><AuditoriasPage /></LayoutRoute>} />
        <Route path="/auditorias/:id" element={<LayoutRoute gestionOnly><AuditoriaDetailPage /></LayoutRoute>} />
        <Route path="/superadmin" element={<LayoutRoute superadminOnly><SuperAdminPage /></LayoutRoute>} />
        <Route path="/superadmin/asociaciones" element={<LayoutRoute superadminOnly><SuperAdminPage /></LayoutRoute>} />
        <Route path="/superadmin/configuracion" element={<LayoutRoute superadminOnly><SuperAdminPage /></LayoutRoute>} />
        <Route path="/superadmin/gestiones-avanzadas" element={<LayoutRoute superadminOnly><SuperAdminPage /></LayoutRoute>} />
        <Route path="/superadmin/log" element={<LayoutRoute superadminOnly><SuperAdminPage /></LayoutRoute>} />
        <Route path="/superadmin/mail-log" element={<LayoutRoute superadminOnly><SuperAdminPage /></LayoutRoute>} />

        {/* Default redirects */}
        <Route
          path="/"
          element={
            user
              ? <Navigate to={user.is_superadmin ? "/superadmin" : user.is_gestion ? "/dashboard" : "/mis-animales"} replace />
              : <Navigate to="/login" replace />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
