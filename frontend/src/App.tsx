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

// Gestion pages
import DashboardPage from "./pages/gestion/DashboardPage";
import ValidacionesPage from "./pages/gestion/ValidacionesPage";
import ConflictosPage from "./pages/gestion/ConflictosPage";
import SociosPage from "./pages/gestion/SociosPage";
import ImportPage from "./pages/gestion/ImportPage";
import ReportesPage from "./pages/gestion/ReportesPage";
import EvaluacionPage from "./pages/gestion/EvaluacionPage";

// Layout
import Layout from "./components/Layout";
import OfflineIndicator from "./components/OfflineIndicator";

function ProtectedRoute({ children, gestionOnly = false }: { children: React.ReactNode; gestionOnly?: boolean }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (gestionOnly && !user.is_gestion) return <Navigate to="/mis-animales" replace />;
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
    <BrowserRouter>
      <OfflineIndicator />
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/reset-password" element={<PasswordResetPage />} />

        {/* Socio routes */}
        <Route
          path="/mis-animales"
          element={
            <ProtectedRoute>
              <Layout>
                <MisAnimalesPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/mis-animales/nuevo"
          element={
            <ProtectedRoute>
              <Layout>
                <AnimalFormPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/mis-animales/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <AnimalFormPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Gestion routes */}
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
