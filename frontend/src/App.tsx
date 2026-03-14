import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import { useTenantStore, applyBranding } from "./store/tenantStore";
import { apiClient } from "./api/client";
import type { TenantBranding } from "./types";

// Auth pages
import LoginPage from "./pages/auth/LoginPage";
import PasswordResetPage from "./pages/auth/PasswordResetPage";

// Socio pages
import MisAnimalesPage from "./pages/socio/MisAnimalesPage";
import AnimalFormPage from "./pages/socio/AnimalFormPage";
import GranjasPage from "./pages/socio/GranjasPage";
import MisLotesPage from "./pages/socio/MisLotesPage";

// Gestion pages
import GranjasGestionPage from "./pages/gestion/GranjasGestionPage";
import DashboardPage from "./pages/gestion/DashboardPage";
import ValidacionesPage from "./pages/gestion/ValidacionesPage";
import ConflictosPage from "./pages/gestion/ConflictosPage";
import SociosPage from "./pages/gestion/SociosPage";
import ImportPage from "./pages/gestion/ImportPage";
import ReportesPage from "./pages/gestion/ReportesPage";
import EvaluacionPage from "./pages/gestion/EvaluacionPage";
import CandidatosReproductorPage from "./pages/gestion/CandidatosReproductorPage";

// Layout
import Layout from "./components/Layout";
import OfflineIndicator from "./components/OfflineIndicator";

function ProtectedRoute({
  children,
  gestionOnly = false,
  socioOnly = false,
}: {
  children: React.ReactNode;
  gestionOnly?: boolean;
  socioOnly?: boolean;
}) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (gestionOnly && !user.is_gestion) return <Navigate to="/mis-animales" replace />;
  if (socioOnly && user.is_gestion) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
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

        {/* Socio routes */}
        <Route
          path="/mis-animales"
          element={
            <ProtectedRoute socioOnly>
              <Layout>
                <MisAnimalesPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/mis-animales/nuevo"
          element={
            <ProtectedRoute socioOnly>
              <Layout>
                <AnimalFormPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/mis-animales/:id"
          element={
            <ProtectedRoute socioOnly>
              <Layout>
                <AnimalFormPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Socio granja route */}
        <Route
          path="/mis-granjas"
          element={
            <ProtectedRoute socioOnly>
              <Layout>
                <GranjasPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Socio lotes route */}
        <Route
          path="/mis-lotes"
          element={
            <ProtectedRoute socioOnly>
              <Layout>
                <MisLotesPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Gestion routes */}
        <Route
          path="/granjas"
          element={
            <ProtectedRoute gestionOnly>
              <Layout>
                <GranjasGestionPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute gestionOnly>
              <Layout>
                <DashboardPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/validaciones"
          element={
            <ProtectedRoute gestionOnly>
              <Layout>
                <ValidacionesPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/conflictos"
          element={
            <ProtectedRoute gestionOnly>
              <Layout>
                <ConflictosPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/socios"
          element={
            <ProtectedRoute gestionOnly>
              <Layout>
                <SociosPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/importar"
          element={
            <ProtectedRoute gestionOnly>
              <Layout>
                <ImportPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reportes"
          element={
            <ProtectedRoute gestionOnly>
              <Layout>
                <ReportesPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/evaluaciones/nuevo"
          element={
            <ProtectedRoute gestionOnly>
              <Layout>
                <EvaluacionPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reproductores/candidatos"
          element={
            <ProtectedRoute gestionOnly>
              <Layout>
                <CandidatosReproductorPage />
              </Layout>
            </ProtectedRoute>
          }
        />

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
