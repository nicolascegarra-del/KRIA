import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import { useTenantStore, applyBranding } from "./store/tenantStore";
import { apiClient } from "./api/client";
import type { TenantBranding } from "./types";

// Auth pages
import LoginPage from "./pages/auth/LoginPage";
import PasswordResetPage from "./pages/auth/PasswordResetPage";

// Shared pages
import PerfilPage from "./pages/PerfilPage";

// Socio pages
import MisAnimalesPage from "./pages/socio/MisAnimalesPage";
import AnimalFormPage from "./pages/socio/AnimalFormPage";
import GranjasPage from "./pages/socio/GranjasPage";
import MisLotesPage from "./pages/socio/MisLotesPage";
import MisDocumentosPage from "./pages/socio/MisDocumentosPage";

// Gestion pages
import GranjasGestionPage from "./pages/gestion/GranjasGestionPage";
import DashboardPage from "./pages/gestion/DashboardPage";
import ValidacionesPage from "./pages/gestion/ValidacionesPage";
import ConflictosPage from "./pages/gestion/ConflictosPage";
import SociosPage from "./pages/gestion/SociosPage";
import SocioDetailPage from "./pages/gestion/SocioDetailPage";
import ImportPage from "./pages/gestion/ImportPage";
import ReportesPage from "./pages/gestion/ReportesPage";
import EvaluacionPage from "./pages/gestion/EvaluacionPage";
import CandidatosReproductorPage from "./pages/gestion/CandidatosReproductorPage";
import CatalogoReproductoresPage from "./pages/gestion/CatalogoReproductoresPage";
import DocumentosPage from "./pages/gestion/DocumentosPage";
import SolicitudesRealtaPage from "./pages/gestion/SolicitudesRealtaPage";
import SuperAdminPage from "./pages/gestion/SuperAdminPage";
import AnillasPage from "./pages/gestion/AnillasPage";

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
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (superadminOnly && !user.is_superadmin) return <Navigate to="/dashboard" replace />;
  if (gestionOnly && !user.is_gestion) return <Navigate to="/mis-animales" replace />;
  if (socioOnly && user.is_gestion) return <Navigate to="/dashboard" replace />;
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

export default function App() {
  const { user, clearAuth } = useAuthStore();
  const { branding, setBranding, slug } = useTenantStore();

  // Listen for forced logout
  useEffect(() => {
    const handler = () => clearAuth();
    window.addEventListener("auth:logout", handler);
    return () => window.removeEventListener("auth:logout", handler);
  }, [clearAuth]);

  // Bootstrap tenant branding on load
  useEffect(() => {
    const tenantSlug = slug || localStorage.getItem("tenant_slug");
    if (!tenantSlug) return;

    apiClient
      .get<TenantBranding>("/tenants/current/branding/", {
        headers: { "X-Tenant-Slug": tenantSlug },
      })
      .then(({ data }) => {
        setBranding(data);
        applyBranding(data);
      })
      .catch(() => {/* Offline — branding from persisted store */});
  }, [slug, setBranding]);

  // Apply branding from cache immediately
  useEffect(() => {
    if (branding) applyBranding(branding);
  }, [branding]);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <OfflineIndicator />
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/reset-password" element={<PasswordResetPage />} />

        {/* Shared — autenticado (cualquier rol) */}
        <Route path="/perfil" element={<LayoutRoute><PerfilPage /></LayoutRoute>} />

        {/* Socio routes */}
        <Route path="/mis-animales" element={<LayoutRoute socioOnly><MisAnimalesPage /></LayoutRoute>} />
        <Route path="/mis-animales/nuevo" element={<LayoutRoute socioOnly><AnimalFormPage /></LayoutRoute>} />
        <Route path="/mis-animales/:id" element={<LayoutRoute socioOnly><AnimalFormPage /></LayoutRoute>} />
        <Route path="/mis-granjas" element={<LayoutRoute socioOnly><GranjasPage /></LayoutRoute>} />
        <Route path="/mis-lotes" element={<LayoutRoute socioOnly><MisLotesPage /></LayoutRoute>} />
        <Route path="/mis-documentos" element={<LayoutRoute socioOnly><MisDocumentosPage /></LayoutRoute>} />

        {/* Gestion routes */}
        <Route path="/dashboard" element={<LayoutRoute gestionOnly><DashboardPage /></LayoutRoute>} />
        <Route path="/validaciones" element={<LayoutRoute gestionOnly><ValidacionesPage /></LayoutRoute>} />
        <Route path="/conflictos" element={<LayoutRoute gestionOnly><ConflictosPage /></LayoutRoute>} />
        <Route path="/socios" element={<LayoutRoute gestionOnly><SociosPage /></LayoutRoute>} />
        <Route path="/socios/:id" element={<LayoutRoute gestionOnly><SocioDetailPage /></LayoutRoute>} />
        <Route path="/granjas" element={<LayoutRoute gestionOnly><GranjasGestionPage /></LayoutRoute>} />
        <Route path="/anillas" element={<LayoutRoute gestionOnly><AnillasPage /></LayoutRoute>} />
        <Route path="/documentos" element={<LayoutRoute gestionOnly><DocumentosPage /></LayoutRoute>} />
        <Route path="/importar" element={<LayoutRoute gestionOnly><ImportPage /></LayoutRoute>} />
        <Route path="/reportes" element={<LayoutRoute gestionOnly><ReportesPage /></LayoutRoute>} />
        <Route path="/evaluaciones/nuevo" element={<LayoutRoute gestionOnly><EvaluacionPage /></LayoutRoute>} />
        <Route path="/reproductores/candidatos" element={<LayoutRoute gestionOnly><CandidatosReproductorPage /></LayoutRoute>} />
        <Route path="/reproductores/catalogo" element={<LayoutRoute gestionOnly><CatalogoReproductoresPage /></LayoutRoute>} />
        <Route path="/solicitudes-realta" element={<LayoutRoute gestionOnly><SolicitudesRealtaPage /></LayoutRoute>} />
        <Route path="/superadmin" element={<LayoutRoute superadminOnly><SuperAdminPage /></LayoutRoute>} />

        {/* Default redirects */}
        <Route
          path="/"
          element={
            user
              ? <Navigate to={user.is_gestion ? "/dashboard" : "/mis-animales"} replace />
              : <Navigate to="/login" replace />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
