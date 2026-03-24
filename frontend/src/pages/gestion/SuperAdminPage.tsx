import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { superadminApi } from "../../api/superadmin";
import { useAuthStore } from "../../store/authStore";
import { useTenantStore } from "../../store/tenantStore";
import Modal from "../../components/Modal";
import ErrorAlert from "../../components/ErrorAlert";
import SuccessToast from "../../components/SuccessToast";
import { useAutoCloseError } from "../../hooks/useAutoCloseError";
import {
  Shield, Plus, Edit2, Users, Building, Loader2, Upload,
  Trash2, PauseCircle, PlayCircle, UserCheck, BarChart2,
  UserPlus, Pencil, ChevronRight, Mail, CheckCircle2, XCircle,
  Settings, AlertTriangle, Wrench,
} from "lucide-react";
import type { Tenant, GestionUserCreate, GestionUser, AnillaSize, PlatformSettings } from "../../types";

// ── Types ─────────────────────────────────────────────────────────────────────
interface SuperAdminStats {
  tenants: number;
  usuarios: number;
  socios: number;
  animales: number;
  por_asociacion: { id: string; name: string; slug: string; is_active: boolean; max_socios: number; socios_count: number }[];
}

type Section = "dashboard" | "asociaciones" | "configuracion" | "gestiones_avanzadas";

interface TenantForm {
  name: string; slug: string; primary_color: string; secondary_color: string;
  is_active: boolean; max_socios: number;
  nombre_completo: string; cif: string; domicilio: string; email_asociacion: string;
  telefono1: string; telefono1_nombre: string; telefono1_cargo: string;
  telefono2: string; telefono2_nombre: string; telefono2_cargo: string;
  granjas_enabled: boolean;
  anilla_sizes: AnillaSize[];
  email_notificaciones: string;
  smtp_host: string; smtp_port: number; smtp_user: string; smtp_password: string;
  smtp_from_email: string; smtp_from_name: string; smtp_use_tls: boolean; smtp_use_ssl: boolean;
}

const TENANT_DEFAULTS: TenantForm = {
  name: "", slug: "", primary_color: "#1565C0", secondary_color: "#FBC02D",
  is_active: true, max_socios: 50,
  nombre_completo: "", cif: "", domicilio: "", email_asociacion: "",
  telefono1: "", telefono1_nombre: "", telefono1_cargo: "",
  telefono2: "", telefono2_nombre: "", telefono2_cargo: "",
  granjas_enabled: true, anilla_sizes: [], email_notificaciones: "",
  smtp_host: "", smtp_port: 587, smtp_user: "", smtp_password: "",
  smtp_from_email: "", smtp_from_name: "", smtp_use_tls: true, smtp_use_ssl: false,
};

const USER_DEFAULTS: GestionUserCreate = { email: "", first_name: "", last_name: "", password: "" };

interface UserEditForm { email: string; first_name: string; last_name: string; password: string; }

// ── Component ─────────────────────────────────────────────────────────────────
export default function SuperAdminPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { startImpersonation } = useAuthStore();
  const { setSlug } = useTenantStore();

  const section: Section = location.pathname.includes("gestiones-avanzadas")
    ? "gestiones_avanzadas"
    : location.pathname.includes("asociaciones")
    ? "asociaciones"
    : location.pathname.includes("configuracion")
    ? "configuracion"
    : "dashboard";

  // ── Tenant modal state ─────────────────────────────────────────────────────
  const [tenantModalOpen, setTenantModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [tenantForm, setTenantForm] = useState<TenantForm>(TENANT_DEFAULTS);
  const [newUserForm, setNewUserForm] = useState<GestionUserCreate>(USER_DEFAULTS);
  const [deleteModalTenant, setDeleteModalTenant] = useState<Tenant | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // ── Users-per-tenant modal state ───────────────────────────────────────────
  const [usersModalTenant, setUsersModalTenant] = useState<Tenant | null>(null);
  const [addingUser, setAddingUser] = useState(false);
  const [addUserForm, setAddUserForm] = useState<GestionUserCreate>(USER_DEFAULTS);
  const [editingUser, setEditingUser] = useState<GestionUser | null>(null);
  const [editUserForm, setEditUserForm] = useState<UserEditForm>({ email: "", first_name: "", last_name: "", password: "" });
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  // ── SuperAdmin modal state ─────────────────────────────────────────────────
  const [saModalOpen, setSaModalOpen] = useState(false);
  const [editingSa, setEditingSa] = useState<GestionUser | null>(null);
  const [saForm, setSaForm] = useState<UserEditForm>({ email: "", first_name: "", last_name: "", password: "" });
  const [deleteSaId, setDeleteSaId] = useState<string | null>(null);

  const [error, setError, clearError] = useAutoCloseError();
  const [userError, setUserError, clearUserError] = useAutoCloseError();
  const [saError, setSaError, clearSaError] = useAutoCloseError();

  // ── Gestiones Avanzadas state ──────────────────────────────────────────────
  const [deleteSociosTarget, setDeleteSociosTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteSociosConfirm, setDeleteSociosConfirm] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // ── Platform SMTP state ────────────────────────────────────────────────────
  const [platformSmtpForm, setPlatformSmtpForm] = useState<PlatformSettings>({
    smtp_host: "", smtp_port: 587, smtp_user: "", smtp_password: "",
    smtp_from_email: "", smtp_from_name: "", smtp_use_tls: true, smtp_use_ssl: false,
  });
  const [platformSmtpTestResult, setPlatformSmtpTestResult] = useState<string | null>(null);
  const [platformSmtpTesting, setPlatformSmtpTesting] = useState(false);
  const [tenantSmtpTestResult, setTenantSmtpTestResult] = useState<string | null>(null);
  const [tenantSmtpTesting, setTenantSmtpTesting] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: stats } = useQuery<SuperAdminStats>({
    queryKey: ["superadmin-stats"],
    queryFn: superadminApi.stats,
  });
  const { data: tenantsData, isLoading: loadingTenants } = useQuery({
    queryKey: ["superadmin-tenants"],
    queryFn: () => superadminApi.listTenants(),
    enabled: section === "asociaciones" || section === "dashboard",
  });
  const { data: tenantUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["superadmin-users", usersModalTenant?.id],
    queryFn: () => superadminApi.listUsers(usersModalTenant!.id),
    enabled: !!usersModalTenant,
  });
  const { data: superAdmins = [], isLoading: loadingSa } = useQuery({
    queryKey: ["superadmin-superadmins"],
    queryFn: superadminApi.listSuperAdmins,
    enabled: section === "configuracion",
  });
  const { data: platformSettings } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: superadminApi.getPlatformSettings,
    enabled: section === "configuracion",
  });

  // Sync platform settings to form when loaded
  useEffect(() => {
    if (platformSettings) {
      setPlatformSmtpForm(platformSettings);
    }
  }, [platformSettings]);

  // ── Tenant mutations ───────────────────────────────────────────────────────
  const createTenantMutation = useMutation({
    mutationFn: superadminApi.createTenant,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-tenants"] }); qc.invalidateQueries({ queryKey: ["superadmin-stats"] }); closeTenantModal(); setSuccessMsg("Asociación creada correctamente."); },
    onError: (e: any) => {
      const d = e?.response?.data;
      if (!d) { setError("Error al crear."); return; }
      if (d.detail) { setError(d.detail); return; }
      const msgs = Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : v}`).join(" | ");
      setError(msgs || "Error al crear.");
    },
  });
  const updateTenantMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Tenant> }) => superadminApi.updateTenant(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-tenants"] }); closeTenantModal(); setSuccessMsg("Asociación actualizada."); },
    onError: (e: any) => setError(e?.response?.data?.detail ?? "Error al actualizar."),
  });
  const deleteTenantMutation = useMutation({
    mutationFn: (id: string) => superadminApi.deleteTenant(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-tenants"] }); qc.invalidateQueries({ queryKey: ["superadmin-stats"] }); setDeleteModalTenant(null); setSuccessMsg("Asociación eliminada definitivamente."); },
    onError: (e: any) => setError(e?.response?.data?.detail ?? "Error al eliminar."),
  });
  const suspendTenantMutation = useMutation({
    mutationFn: (id: string) => superadminApi.suspendTenant(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-tenants"] }); setSuccessMsg("Asociación suspendida."); },
    onError: (e: any) => setError(e?.response?.data?.detail ?? "Error."),
  });
  const activateTenantMutation = useMutation({
    mutationFn: (id: string) => superadminApi.activateTenant(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-tenants"] }); setSuccessMsg("Asociación activada."); },
    onError: (e: any) => setError(e?.response?.data?.detail ?? "Error."),
  });
  const impersonateMutation = useMutation({
    mutationFn: (id: string) => superadminApi.impersonate(id),
    onSuccess: (data) => { startImpersonation(data.access, data.tenant); setSlug(data.tenant.slug); navigate("/dashboard"); },
    onError: (e: any) => setError(e?.response?.data?.detail ?? "Error al impersonar."),
  });

  // ── User-per-tenant mutations ──────────────────────────────────────────────
  const createUserMutation = useMutation({
    mutationFn: (payload: GestionUserCreate) => superadminApi.createUser(usersModalTenant!.id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-users", usersModalTenant?.id] }); qc.invalidateQueries({ queryKey: ["superadmin-stats"] }); setAddingUser(false); setAddUserForm(USER_DEFAULTS); setSuccessMsg("Usuario creado."); },
    onError: (e: any) => {
      const d = e?.response?.data;
      if (!d) { setUserError("Error al crear usuario."); return; }
      if (d.detail) { setUserError(d.detail); return; }
      // Field-level errors: {email: [...], password: [...]}
      const msgs = Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : v}`).join(" | ");
      setUserError(msgs || "Error al crear usuario.");
    },
  });
  const updateUserMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<UserEditForm> }) => superadminApi.updateUser(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-users", usersModalTenant?.id] }); setEditingUser(null); setSuccessMsg("Usuario actualizado."); },
    onError: (e: any) => setUserError(e?.response?.data?.detail ?? "Error al actualizar."),
  });
  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => superadminApi.deleteUser(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-users", usersModalTenant?.id] }); qc.invalidateQueries({ queryKey: ["superadmin-stats"] }); setDeleteUserId(null); setSuccessMsg("Usuario eliminado."); },
    onError: (e: any) => setUserError(e?.response?.data?.detail ?? "Error al eliminar."),
  });
  const suspendUserMutation = useMutation({
    mutationFn: (id: string) => superadminApi.suspendUser(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-users", usersModalTenant?.id] }); setSuccessMsg("Usuario suspendido."); },
    onError: (e: any) => setUserError(e?.response?.data?.detail ?? "Error."),
  });
  const activateUserMutation = useMutation({
    mutationFn: (id: string) => superadminApi.activateUser(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-users", usersModalTenant?.id] }); setSuccessMsg("Usuario activado."); },
    onError: (e: any) => setUserError(e?.response?.data?.detail ?? "Error."),
  });

  // ── SuperAdmin mutations ───────────────────────────────────────────────────
  const createSaMutation = useMutation({
    mutationFn: superadminApi.createSuperAdmin,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-superadmins"] }); closeSaModal(); setSuccessMsg("SuperAdmin creado."); },
    onError: (e: any) => {
      const d = e?.response?.data;
      if (!d) { setSaError("Error al crear."); return; }
      if (d.detail) { setSaError(d.detail); return; }
      const msgs = Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : v}`).join(" | ");
      setSaError(msgs || "Error al crear.");
    },
  });
  const updateSaMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<UserEditForm> }) => superadminApi.updateSuperAdmin(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-superadmins"] }); closeSaModal(); setSuccessMsg("SuperAdmin actualizado."); },
    onError: (e: any) => setSaError(e?.response?.data?.detail ?? "Error al actualizar."),
  });
  const deleteSaMutation = useMutation({
    mutationFn: (id: string) => superadminApi.deleteSuperAdmin(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-superadmins"] }); setDeleteSaId(null); setSuccessMsg("SuperAdmin eliminado."); },
    onError: (e: any) => setSaError(e?.response?.data?.detail ?? "Error al eliminar."),
  });

  // ── Platform settings mutations ────────────────────────────────────────────
  const deleteSociosMutation = useMutation({
    mutationFn: (id: string) => superadminApi.deleteTenantSocios(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["superadmin-tenants"] });
      qc.invalidateQueries({ queryKey: ["superadmin-stats"] });
      setDeleteSociosTarget(null);
      setDeleteSociosConfirm("");
      setSuccessMsg(data.detail);
    },
    onError: (e: any) => setError(e?.response?.data?.detail ?? "Error al eliminar socios."),
  });

  const updatePlatformSmtpMutation = useMutation({
    mutationFn: (payload: Partial<PlatformSettings>) => superadminApi.updatePlatformSettings(payload),
    onSuccess: (data) => { setPlatformSmtpForm(data); qc.invalidateQueries({ queryKey: ["platform-settings"] }); setSuccessMsg("Configuración SMTP global guardada."); },
    onError: (e: any) => setError(e?.response?.data?.detail ?? "Error al guardar."),
  });

  const handlePlatformSmtpTest = async () => {
    setPlatformSmtpTesting(true);
    setPlatformSmtpTestResult(null);
    try {
      const res = await superadminApi.testPlatformSmtp();
      setPlatformSmtpTestResult(`✓ ${res.detail}`);
    } catch (e: any) {
      setPlatformSmtpTestResult(`✗ ${e?.response?.data?.detail ?? "Error de conexión"}`);
    } finally {
      setPlatformSmtpTesting(false);
    }
  };

  const handleTenantSmtpTest = async () => {
    if (!editingTenant) return;
    setTenantSmtpTesting(true);
    setTenantSmtpTestResult(null);
    try {
      const res = await superadminApi.testTenantSmtp(editingTenant.id);
      setTenantSmtpTestResult(`✓ ${res.detail}`);
    } catch (e: any) {
      setTenantSmtpTestResult(`✗ ${e?.response?.data?.detail ?? "Error de conexión"}`);
    } finally {
      setTenantSmtpTesting(false);
    }
  };

  // ── Tenant helpers ─────────────────────────────────────────────────────────
  const closeTenantModal = () => { setTenantModalOpen(false); setEditingTenant(null); setTenantForm(TENANT_DEFAULTS); setNewUserForm(USER_DEFAULTS); setLogoPreview(null); setTenantSmtpTestResult(null); clearError(); };
  const openCreateTenant = () => { setEditingTenant(null); setTenantForm(TENANT_DEFAULTS); setNewUserForm(USER_DEFAULTS); setLogoPreview(null); clearError(); setTenantModalOpen(true); };
  const openEditTenant = (t: Tenant) => {
    setEditingTenant(t);
    setTenantSmtpTestResult(null);
    setTenantForm({
      name: t.name, slug: t.slug, primary_color: t.primary_color, secondary_color: t.secondary_color,
      is_active: t.is_active, max_socios: t.max_socios ?? 50,
      nombre_completo: t.nombre_completo ?? "", cif: t.cif ?? "", domicilio: t.domicilio ?? "",
      email_asociacion: t.email_asociacion ?? "",
      telefono1: t.telefono1 ?? "", telefono1_nombre: t.telefono1_nombre ?? "", telefono1_cargo: t.telefono1_cargo ?? "",
      telefono2: t.telefono2 ?? "", telefono2_nombre: t.telefono2_nombre ?? "", telefono2_cargo: t.telefono2_cargo ?? "",
      granjas_enabled: t.granjas_enabled ?? true,
      anilla_sizes: t.anilla_sizes ?? [],
      email_notificaciones: t.email_notificaciones ?? "",
      smtp_host: t.smtp_host ?? "", smtp_port: t.smtp_port ?? 587,
      smtp_user: t.smtp_user ?? "", smtp_password: t.smtp_password ?? "",
      smtp_from_email: t.smtp_from_email ?? "", smtp_from_name: t.smtp_from_name ?? "",
      smtp_use_tls: t.smtp_use_tls ?? true, smtp_use_ssl: t.smtp_use_ssl ?? false,
    });
    setLogoPreview(t.logo_url ?? null);
    clearError();
    setTenantModalOpen(true);
  };
  const handleTenantSubmit = (e: React.FormEvent) => {
    e.preventDefault(); clearError();
    if (editingTenant) updateTenantMutation.mutate({ id: editingTenant.id, payload: tenantForm });
    else createTenantMutation.mutate({ ...tenantForm, gestion_user: newUserForm.email ? newUserForm : undefined });
  };
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingTenant) return;
    setLogoUploading(true);
    try {
      const updated = await superadminApi.uploadLogo(editingTenant.id, file);
      setLogoPreview(updated.logo_url ?? null);
      qc.invalidateQueries({ queryKey: ["superadmin-tenants"] });
      setSuccessMsg("Logo actualizado.");
    } catch { setError("Error al subir el logo."); }
    finally { setLogoUploading(false); if (logoInputRef.current) logoInputRef.current.value = ""; }
  };

  // ── SA helpers ─────────────────────────────────────────────────────────────
  const closeSaModal = () => { setSaModalOpen(false); setEditingSa(null); setSaForm({ email: "", first_name: "", last_name: "", password: "" }); clearSaError(); };
  const openCreateSa = () => { setEditingSa(null); setSaForm({ email: "", first_name: "", last_name: "", password: "" }); clearSaError(); setSaModalOpen(true); };
  const openEditSa = (u: GestionUser) => { setEditingSa(u); setSaForm({ email: u.email, first_name: u.first_name, last_name: u.last_name, password: "" }); clearSaError(); setSaModalOpen(true); };
  const handleSaSubmit = (e: React.FormEvent) => {
    e.preventDefault(); clearSaError();
    const payload = { ...saForm, ...(saForm.password ? {} : { password: undefined }) };
    if (editingSa) updateSaMutation.mutate({ id: editingSa.id, payload });
    else createSaMutation.mutate(saForm);
  };

  const tenants: Tenant[] = tenantsData?.results ?? [];
  const tenantSaving = createTenantMutation.isPending || updateTenantMutation.isPending;

  const toSlug = (name: string) =>
    name.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return (
    <div className="max-w-4xl space-y-5">
      <SuccessToast message={successMsg} onDismiss={() => setSuccessMsg("")} />

        {/* ════════════════ DASHBOARD ════════════════════════════════════════ */}
        {section === "dashboard" && (
          <>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <BarChart2 size={22} className="text-violet-600" /> Dashboard
              </h1>
              <p className="text-sm text-gray-500">Estadísticas globales de la plataforma</p>
            </div>

            {stats && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Asociaciones",  value: stats.tenants,  icon: <Building size={18} />,  color: "text-violet-600" },
                    { label: "Admins gestión",value: stats.usuarios, icon: <Users size={18} />,     color: "text-blue-600" },
                    { label: "Socios activos",value: stats.socios,   icon: <UserCheck size={18} />, color: "text-green-600" },
                    { label: "Animales",      value: stats.animales, icon: <Shield size={18} />,    color: "text-amber-600" },
                  ].map((s) => (
                    <div key={s.label} className="card text-center">
                      <div className={`${s.color} flex justify-center mb-1`}>{s.icon}</div>
                      <div className="text-2xl font-bold text-gray-900">{s.value}</div>
                      <div className="text-xs text-gray-500">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="card">
                  <h2 className="text-sm font-semibold text-gray-700 mb-3">Socios por asociación</h2>
                  <div className="space-y-2">
                    {stats.por_asociacion.map((a) => {
                      const pct = a.max_socios > 0 ? Math.min((a.socios_count / a.max_socios) * 100, 100) : 0;
                      const barColor = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-400" : "bg-green-500";
                      return (
                        <div key={a.id} className="flex items-center gap-3 text-sm">
                          <span className="w-40 truncate text-gray-700 font-medium">{a.name}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            {a.max_socios > 0 && (
                              <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                            )}
                          </div>
                          <span className="text-xs text-gray-500 w-20 text-right">
                            {a.socios_count}{a.max_socios > 0 ? ` / ${a.max_socios}` : " (sin límite)"}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${a.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                            {a.is_active ? "Activa" : "Suspendida"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ════════════════ ASOCIACIONES ═════════════════════════════════════ */}
        {section === "asociaciones" && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Building size={22} className="text-violet-600" /> Asociaciones
                </h1>
                <p className="text-sm text-gray-500">Gestión de asociaciones registradas</p>
              </div>
              <button onClick={openCreateTenant} className="btn-primary gap-2 flex items-center">
                <Plus size={16} /> Nueva asociación
              </button>
            </div>

            <ErrorAlert message={error} onClose={clearError} />

            {loadingTenants ? (
              <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
            ) : tenants.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No hay asociaciones.</p>
            ) : (
              <div className="space-y-3">
                {tenants.map((t) => {
                  const pct = t.max_socios > 0 ? Math.min(((t.socios_count ?? 0) / t.max_socios) * 100, 100) : 0;
                  const barColor = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-400" : "bg-green-500";
                  return (
                    <div key={t.id} className="card flex items-center gap-4">
                      {/* Logo/color swatch */}
                      <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center overflow-hidden" style={{ background: t.primary_color }}>
                        {t.logo_url
                          ? <img src={t.logo_url} alt="" className="w-full h-full object-cover" />
                          : <Building size={18} className="text-white" />
                        }
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 truncate">{t.name}</span>
                          <span className="text-xs text-gray-400 font-mono">{t.slug}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${t.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                            {t.is_active ? "Activa" : "Suspendida"}
                          </span>
                        </div>
                        {t.nombre_completo && <p className="text-xs text-gray-500 truncate">{t.nombre_completo}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-24 bg-gray-100 rounded-full h-1.5">
                            {t.max_socios > 0 && <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />}
                          </div>
                          <span className="text-xs text-gray-400">
                            {t.socios_count ?? 0}{t.max_socios > 0 ? ` / ${t.max_socios} socios` : " socios (sin límite)"}
                          </span>
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                        <button
                          title="Gestionar usuarios admin"
                          className="btn-ghost p-1.5"
                          onClick={() => setUsersModalTenant(t)}
                        ><Users size={15} /></button>
                        <button
                          title="Editar"
                          className="btn-ghost p-1.5"
                          onClick={() => openEditTenant(t)}
                        ><Edit2 size={15} /></button>
                        <button
                          title={t.is_active ? "Suspender" : "Activar"}
                          className="btn-ghost p-1.5"
                          onClick={() => t.is_active ? suspendTenantMutation.mutate(t.id) : activateTenantMutation.mutate(t.id)}
                        >{t.is_active ? <PauseCircle size={15} className="text-amber-500" /> : <PlayCircle size={15} className="text-green-600" />}</button>
                        <button
                          title="Acceder como admin"
                          className="btn-ghost p-1.5"
                          onClick={() => impersonateMutation.mutate(t.id)}
                          disabled={!t.is_active}
                        ><ChevronRight size={15} className="text-violet-600" /></button>
                        <button
                          title="Eliminar"
                          className="btn-ghost p-1.5"
                          onClick={() => setDeleteModalTenant(t)}
                        ><Trash2 size={15} className="text-red-500" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ════════════════ CONFIGURACIÓN ════════════════════════════════════ */}
        {section === "configuracion" && (
          <>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Settings size={22} className="text-violet-600" /> Configuración
              </h1>
            </div>

            {/* Global SMTP */}
            <div className="card space-y-4">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Mail size={15} /> SMTP Global <span className="font-normal text-gray-400 text-xs">(la plataforma usa este servidor para enviar emails a las asociaciones)</span></h2>
              <form onSubmit={(e) => { e.preventDefault(); updatePlatformSmtpMutation.mutate(platformSmtpForm); }} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Servidor SMTP</label>
                    <input className="input-field" placeholder="smtp.gmail.com" value={platformSmtpForm.smtp_host} onChange={(e) => setPlatformSmtpForm({ ...platformSmtpForm, smtp_host: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Puerto</label>
                    <input className="input-field" type="number" value={platformSmtpForm.smtp_port} onChange={(e) => setPlatformSmtpForm({ ...platformSmtpForm, smtp_port: parseInt(e.target.value) || 587 })} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Usuario</label>
                    <input className="input-field" value={platformSmtpForm.smtp_user} onChange={(e) => setPlatformSmtpForm({ ...platformSmtpForm, smtp_user: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Contraseña</label>
                    <input className="input-field" type="password" value={platformSmtpForm.smtp_password} onChange={(e) => setPlatformSmtpForm({ ...platformSmtpForm, smtp_password: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Email remitente</label>
                    <input className="input-field" type="email" value={platformSmtpForm.smtp_from_email} onChange={(e) => setPlatformSmtpForm({ ...platformSmtpForm, smtp_from_email: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nombre remitente</label>
                    <input className="input-field" value={platformSmtpForm.smtp_from_name} onChange={(e) => setPlatformSmtpForm({ ...platformSmtpForm, smtp_from_name: e.target.value })} />
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input type="checkbox" checked={platformSmtpForm.smtp_use_tls} onChange={(e) => setPlatformSmtpForm({ ...platformSmtpForm, smtp_use_tls: e.target.checked, smtp_use_ssl: e.target.checked ? false : platformSmtpForm.smtp_use_ssl })} className="rounded" />
                    STARTTLS
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input type="checkbox" checked={platformSmtpForm.smtp_use_ssl} onChange={(e) => setPlatformSmtpForm({ ...platformSmtpForm, smtp_use_ssl: e.target.checked, smtp_use_tls: e.target.checked ? false : platformSmtpForm.smtp_use_tls })} className="rounded" />
                    SSL/TLS
                  </label>
                  <div className="flex items-center gap-2 ml-auto">
                    <button type="button" className="btn-ghost text-xs gap-1 flex items-center" onClick={handlePlatformSmtpTest} disabled={platformSmtpTesting}>
                      {platformSmtpTesting ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                      Probar conexión
                    </button>
                    {platformSmtpTestResult && (
                      <span className={`text-xs font-medium flex items-center gap-1 ${platformSmtpTestResult.startsWith("✓") ? "text-green-600" : "text-red-600"}`}>
                        {platformSmtpTestResult.startsWith("✓") ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {platformSmtpTestResult.slice(2)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="btn-primary text-sm" disabled={updatePlatformSmtpMutation.isPending}>
                    {updatePlatformSmtpMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Guardar SMTP global"}
                  </button>
                </div>
              </form>
            </div>

            {/* SuperAdmins */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Shield size={15} /> SuperAdmins</h2>
              <button onClick={openCreateSa} className="btn-primary gap-2 flex items-center text-sm">
                <Plus size={16} /> Nuevo superadmin
              </button>
            </div>

            <ErrorAlert message={saError} onClose={clearSaError} />

            {loadingSa ? (
              <div className="space-y-2">{[1,2].map((i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
            ) : superAdmins.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No hay superadmins.</p>
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                      <th className="pb-2 text-left pr-4">Nombre</th>
                      <th className="pb-2 text-left pr-4">Email</th>
                      <th className="pb-2 text-left pr-4">Alta</th>
                      <th className="pb-2 text-left">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {superAdmins.map((u) => (
                      <tr key={u.id}>
                        <td className="py-2 pr-4">{u.first_name} {u.last_name || ""}</td>
                        <td className="py-2 pr-4 text-gray-600">{u.email}</td>
                        <td className="py-2 pr-4 text-gray-400 text-xs">{new Date(u.date_joined).toLocaleDateString("es-ES")}</td>
                        <td className="py-2">
                          <div className="flex gap-1">
                            <button title="Editar" className="btn-ghost p-1" onClick={() => openEditSa(u)}><Pencil size={14} /></button>
                            <button title="Eliminar" className="btn-ghost p-1" onClick={() => setDeleteSaId(u.id)}><Trash2 size={14} className="text-red-500" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Crear / Editar Asociación
      ══════════════════════════════════════════════════════════════════════ */}
      {tenantModalOpen && <Modal onClose={closeTenantModal} title={editingTenant ? "Editar asociación" : "Nueva asociación"} maxWidth="max-w-3xl">
        <form onSubmit={handleTenantSubmit} className="space-y-4">
          <ErrorAlert message={error} onClose={clearError} />

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos básicos</legend>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre corto *</label>
              <input
                className="input-field"
                placeholder="p.ej. APACA"
                required
                value={tenantForm.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setTenantForm((prev) => ({
                    ...prev,
                    name,
                    slug: editingTenant ? prev.slug : toSlug(name),
                  }));
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo</label>
              <input className="input-field" placeholder="Asociación de Productores Avícolas de Castilla" value={tenantForm.nombre_completo} onChange={(e) => setTenantForm({ ...tenantForm, nombre_completo: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">CIF</label>
                <input className="input-field" placeholder="G12345678" value={tenantForm.cif} onChange={(e) => setTenantForm({ ...tenantForm, cif: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input className="input-field" type="email" placeholder="info@asociacion.es" value={tenantForm.email_asociacion} onChange={(e) => setTenantForm({ ...tenantForm, email_asociacion: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Domicilio</label>
              <input className="input-field" placeholder="Calle Mayor 1, 28001 Madrid" value={tenantForm.domicilio} onChange={(e) => setTenantForm({ ...tenantForm, domicilio: e.target.value })} />
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Teléfonos de contacto</legend>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Teléfono 1</label>
                <input className="input-field" placeholder="+34 600 000 000" value={tenantForm.telefono1} onChange={(e) => setTenantForm({ ...tenantForm, telefono1: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                <input className="input-field" placeholder="Juan García" value={tenantForm.telefono1_nombre} onChange={(e) => setTenantForm({ ...tenantForm, telefono1_nombre: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cargo</label>
                <input className="input-field" placeholder="Presidente" value={tenantForm.telefono1_cargo} onChange={(e) => setTenantForm({ ...tenantForm, telefono1_cargo: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Teléfono 2</label>
                <input className="input-field" placeholder="+34 600 000 001" value={tenantForm.telefono2} onChange={(e) => setTenantForm({ ...tenantForm, telefono2: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                <input className="input-field" placeholder="María López" value={tenantForm.telefono2_nombre} onChange={(e) => setTenantForm({ ...tenantForm, telefono2_nombre: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cargo</label>
                <input className="input-field" placeholder="Secretaria" value={tenantForm.telefono2_cargo} onChange={(e) => setTenantForm({ ...tenantForm, telefono2_cargo: e.target.value })} />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Apariencia y límites</legend>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Color primario</label>
                <div className="flex gap-2 items-center">
                  <input type="color" className="w-8 h-8 rounded cursor-pointer border" value={tenantForm.primary_color} onChange={(e) => setTenantForm({ ...tenantForm, primary_color: e.target.value })} />
                  <input className="input-field font-mono text-xs" value={tenantForm.primary_color} onChange={(e) => setTenantForm({ ...tenantForm, primary_color: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Color secundario</label>
                <div className="flex gap-2 items-center">
                  <input type="color" className="w-8 h-8 rounded cursor-pointer border" value={tenantForm.secondary_color} onChange={(e) => setTenantForm({ ...tenantForm, secondary_color: e.target.value })} />
                  <input className="input-field font-mono text-xs" value={tenantForm.secondary_color} onChange={(e) => setTenantForm({ ...tenantForm, secondary_color: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Límite socios <span className="font-normal">(0 = sin límite)</span></label>
                <input className="input-field" type="number" min="0" value={tenantForm.max_socios} onChange={(e) => setTenantForm({ ...tenantForm, max_socios: parseInt(e.target.value) || 0 })} />
              </div>
            </div>

            {/* Logo (solo en edición) */}
            {editingTenant && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Logo</label>
                <div className="flex items-center gap-3">
                  {logoPreview && <img src={logoPreview} alt="Logo" className="w-12 h-12 object-contain rounded border" />}
                  <button type="button" className="btn-ghost text-xs gap-1 flex items-center" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}>
                    {logoUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    {logoUploading ? "Subiendo..." : "Subir logo"}
                  </button>
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={tenantForm.is_active} onChange={(e) => setTenantForm({ ...tenantForm, is_active: e.target.checked })} className="rounded" />
              <span className="text-sm text-gray-700">Asociación activa</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={tenantForm.granjas_enabled} onChange={(e) => setTenantForm({ ...tenantForm, granjas_enabled: e.target.checked })} className="rounded" />
              <span className="text-sm text-gray-700">Módulo Granjas activo</span>
            </label>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tamaños de anilla</legend>
            <p className="text-xs text-gray-400">Define los tamaños disponibles para esta asociación. Se mostrará al registrar animales.</p>
            <div className="space-y-2">
              {tenantForm.anilla_sizes.map((sz, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    className="input-field w-20 text-sm"
                    placeholder="mm"
                    value={sz.mm}
                    onChange={(e) => {
                      const sizes = [...tenantForm.anilla_sizes];
                      sizes[idx] = { ...sizes[idx], mm: e.target.value };
                      setTenantForm({ ...tenantForm, anilla_sizes: sizes });
                    }}
                  />
                  <button type="button" className="btn-ghost p-1.5 text-red-500" onClick={() => setTenantForm({ ...tenantForm, anilla_sizes: tenantForm.anilla_sizes.filter((_, i) => i !== idx) })}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button type="button" className="btn-ghost text-xs gap-1 flex items-center" onClick={() => setTenantForm({ ...tenantForm, anilla_sizes: [...tenantForm.anilla_sizes, { mm: "" }] })}>
                <Plus size={12} /> Añadir tamaño
              </button>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notificaciones</legend>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email de notificaciones <span className="font-normal text-gray-400">(la plataforma envía aquí avisos a la asociación)</span></label>
              <input className="input-field" type="email" placeholder="notificaciones@asociacion.es" value={tenantForm.email_notificaciones} onChange={(e) => setTenantForm({ ...tenantForm, email_notificaciones: e.target.value })} />
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide">SMTP de la asociación <span className="font-normal text-gray-400">(para enviar emails a sus socios)</span></legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Servidor SMTP</label>
                <input className="input-field" placeholder="smtp.gmail.com" value={tenantForm.smtp_host} onChange={(e) => setTenantForm({ ...tenantForm, smtp_host: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Puerto</label>
                <input className="input-field" type="number" placeholder="587" value={tenantForm.smtp_port} onChange={(e) => setTenantForm({ ...tenantForm, smtp_port: parseInt(e.target.value) || 587 })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Usuario</label>
                <input className="input-field" placeholder="user@gmail.com" value={tenantForm.smtp_user} onChange={(e) => setTenantForm({ ...tenantForm, smtp_user: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Contraseña</label>
                <input className="input-field" type="password" value={tenantForm.smtp_password} onChange={(e) => setTenantForm({ ...tenantForm, smtp_password: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email remitente</label>
                <input className="input-field" type="email" placeholder="noreply@asociacion.es" value={tenantForm.smtp_from_email} onChange={(e) => setTenantForm({ ...tenantForm, smtp_from_email: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre remitente</label>
                <input className="input-field" placeholder="Asociación APACA" value={tenantForm.smtp_from_name} onChange={(e) => setTenantForm({ ...tenantForm, smtp_from_name: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={tenantForm.smtp_use_tls} onChange={(e) => setTenantForm({ ...tenantForm, smtp_use_tls: e.target.checked, smtp_use_ssl: e.target.checked ? false : tenantForm.smtp_use_ssl })} className="rounded" />
                STARTTLS
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={tenantForm.smtp_use_ssl} onChange={(e) => setTenantForm({ ...tenantForm, smtp_use_ssl: e.target.checked, smtp_use_tls: e.target.checked ? false : tenantForm.smtp_use_tls })} className="rounded" />
                SSL/TLS
              </label>
              {editingTenant && (
                <div className="flex items-center gap-2 ml-auto">
                  <button type="button" className="btn-ghost text-xs gap-1 flex items-center" onClick={handleTenantSmtpTest} disabled={tenantSmtpTesting}>
                    {tenantSmtpTesting ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                    Probar conexión
                  </button>
                  {tenantSmtpTestResult && (
                    <span className={`text-xs font-medium ${tenantSmtpTestResult.startsWith("✓") ? "text-green-600" : "text-red-600"}`}>
                      {tenantSmtpTestResult}
                    </span>
                  )}
                </div>
              )}
            </div>
          </fieldset>

          {/* Initial admin user (only on create) */}
          {!editingTenant && (
            <fieldset className="space-y-3 border-t pt-4">
              <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Usuario admin inicial (opcional)</legend>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Email</label>
                  <input className="input-field" type="email" value={newUserForm.email} onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Contraseña</label>
                  <input className="input-field" type="password" value={newUserForm.password} onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                  <input className="input-field" value={newUserForm.first_name} onChange={(e) => setNewUserForm({ ...newUserForm, first_name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Apellidos</label>
                  <input className="input-field" value={newUserForm.last_name} onChange={(e) => setNewUserForm({ ...newUserForm, last_name: e.target.value })} />
                </div>
              </div>
            </fieldset>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={closeTenantModal}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={tenantSaving}>
              {tenantSaving ? <Loader2 size={14} className="animate-spin" /> : (editingTenant ? "Guardar cambios" : "Crear asociación")}
            </button>
          </div>
        </form>
      </Modal>}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Confirmar eliminar asociación
      ══════════════════════════════════════════════════════════════════════ */}
      {!!deleteModalTenant && <Modal onClose={() => setDeleteModalTenant(null)} title="Eliminar asociación">
        <p className="text-sm text-gray-600 mb-4">
          ¿Eliminar definitivamente <strong>{deleteModalTenant?.name}</strong> y todos sus datos? Esta acción es irreversible.
        </p>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setDeleteModalTenant(null)}>Cancelar</button>
          <button className="btn-danger" onClick={() => deleteModalTenant && deleteTenantMutation.mutate(deleteModalTenant.id)} disabled={deleteTenantMutation.isPending}>
            {deleteTenantMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Eliminar"}
          </button>
        </div>
      </Modal>}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Usuarios de gestión de un tenant
      ══════════════════════════════════════════════════════════════════════ */}
      {!!usersModalTenant && <Modal onClose={() => { setUsersModalTenant(null); setAddingUser(false); setEditingUser(null); setDeleteUserId(null); clearUserError(); }} title={`Usuarios admin — ${usersModalTenant?.name}`} maxWidth="max-w-2xl">
        <div className="space-y-4">
          <ErrorAlert message={userError} onClose={clearUserError} />

          {/* ── Lista de usuarios ── */}
          {loadingUsers ? (
            <div className="space-y-2">{[1,2].map((i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : tenantUsers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No hay usuarios admin aún.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-xs text-gray-500 uppercase">
                    <th className="px-3 py-2 text-left">Nombre</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Alta</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                    <th className="px-3 py-2 text-left">Contraseña</th>
                    <th className="px-3 py-2 text-left">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tenantUsers.map((u) => (
                    <tr key={u.id} className={editingUser?.id === u.id ? "bg-blue-50" : "hover:bg-gray-50"}>
                      <td className="px-3 py-2 font-medium text-gray-800">{u.first_name} {u.last_name || <span className="text-gray-400 font-normal">—</span>}</td>
                      <td className="px-3 py-2 text-gray-600">{u.email}</td>
                      <td className="px-3 py-2 text-gray-400 text-xs">{new Date(u.date_joined).toLocaleDateString("es-ES")}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                          {u.is_active ? "Activo" : "Suspendido"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400 italic">cifrada</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button className="btn-ghost p-1" title="Editar / cambiar contraseña" onClick={() => { setEditingUser(u); setAddingUser(false); setEditUserForm({ email: u.email, first_name: u.first_name, last_name: u.last_name, password: "" }); }}>
                            <Pencil size={13} />
                          </button>
                          {u.is_active
                            ? <button className="btn-ghost p-1" title="Suspender" onClick={() => suspendUserMutation.mutate(u.id)}><PauseCircle size={13} className="text-amber-500" /></button>
                            : <button className="btn-ghost p-1" title="Activar" onClick={() => activateUserMutation.mutate(u.id)}><PlayCircle size={13} className="text-green-600" /></button>
                          }
                          <button className="btn-ghost p-1" title="Eliminar" onClick={() => { setDeleteUserId(u.id); setEditingUser(null); }}><Trash2 size={13} className="text-red-500" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Editar usuario ── */}
          {editingUser && (
            <form onSubmit={(e) => { e.preventDefault(); updateUserMutation.mutate({ id: editingUser.id, payload: editUserForm }); }} className="border border-blue-200 rounded-lg p-4 bg-blue-50 space-y-3">
              <p className="text-sm font-semibold text-blue-800">Editar: {editingUser.email}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Nombre</label>
                  <input className="input-field" value={editUserForm.first_name} onChange={(e) => setEditUserForm({ ...editUserForm, first_name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Apellidos</label>
                  <input className="input-field" value={editUserForm.last_name} onChange={(e) => setEditUserForm({ ...editUserForm, last_name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Email</label>
                  <input className="input-field" type="email" value={editUserForm.email} onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Nueva contraseña <span className="font-normal text-gray-400">(dejar vacío = no cambiar)</span></label>
                  <input className="input-field" type="text" placeholder="••••••••" value={editUserForm.password} onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" className="btn-ghost text-sm" onClick={() => setEditingUser(null)}>Cancelar</button>
                <button type="submit" className="btn-primary text-sm" disabled={updateUserMutation.isPending}>
                  {updateUserMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Guardar cambios"}
                </button>
              </div>
            </form>
          )}

          {/* ── Nuevo usuario ── */}
          {addingUser ? (
            <form onSubmit={(e) => { e.preventDefault(); createUserMutation.mutate(addUserForm); }} className="border border-green-200 rounded-lg p-4 bg-green-50 space-y-3">
              <p className="text-sm font-semibold text-green-800">Nuevo usuario admin</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Nombre</label>
                  <input className="input-field" value={addUserForm.first_name} onChange={(e) => setAddUserForm({ ...addUserForm, first_name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Apellidos</label>
                  <input className="input-field" value={addUserForm.last_name} onChange={(e) => setAddUserForm({ ...addUserForm, last_name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Email *</label>
                  <input className="input-field" type="email" required value={addUserForm.email} onChange={(e) => setAddUserForm({ ...addUserForm, email: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Contraseña *</label>
                  <input className="input-field" type="text" required value={addUserForm.password} onChange={(e) => setAddUserForm({ ...addUserForm, password: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" className="btn-ghost text-sm" onClick={() => setAddingUser(false)}>Cancelar</button>
                <button type="submit" className="btn-primary text-sm" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Crear usuario"}
                </button>
              </div>
            </form>
          ) : (
            !editingUser && (
              <button className="btn-ghost text-sm gap-2 flex items-center" onClick={() => { setAddingUser(true); setEditingUser(null); }}>
                <UserPlus size={15} /> Añadir usuario admin
              </button>
            )
          )}

          {/* ── Confirmar eliminar ── */}
          {deleteUserId && (
            <div className="border border-red-200 bg-red-50 rounded-lg p-3 text-sm">
              <p className="text-red-700 font-medium mb-2">¿Eliminar este usuario definitivamente?</p>
              <div className="flex gap-2">
                <button className="btn-ghost text-sm" onClick={() => setDeleteUserId(null)}>Cancelar</button>
                <button className="btn-danger text-sm" onClick={() => deleteUserMutation.mutate(deleteUserId!)} disabled={deleteUserMutation.isPending}>
                  {deleteUserMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : "Eliminar"}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Crear / Editar SuperAdmin
      ══════════════════════════════════════════════════════════════════════ */}
      {saModalOpen && <Modal onClose={closeSaModal} title={editingSa ? "Editar superadmin" : "Nuevo superadmin"}>
        <form onSubmit={handleSaSubmit} className="space-y-3">
          <ErrorAlert message={saError} onClose={clearSaError} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Nombre</label>
              <input className="input-field" value={saForm.first_name} onChange={(e) => setSaForm({ ...saForm, first_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Apellidos</label>
              <input className="input-field" value={saForm.last_name} onChange={(e) => setSaForm({ ...saForm, last_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Email *</label>
              <input className="input-field" type="email" required value={saForm.email} onChange={(e) => setSaForm({ ...saForm, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">{editingSa ? "Nueva contraseña (opcional)" : "Contraseña *"}</label>
              <input className="input-field" type="password" required={!editingSa} value={saForm.password} onChange={(e) => setSaForm({ ...saForm, password: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={closeSaModal}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={createSaMutation.isPending || updateSaMutation.isPending}>
              {(createSaMutation.isPending || updateSaMutation.isPending) ? <Loader2 size={14} className="animate-spin" /> : (editingSa ? "Guardar" : "Crear")}
            </button>
          </div>
        </form>
      </Modal>}

      {/* ── Confirm delete superadmin ─────────────────────────────────────── */}
      {!!deleteSaId && <Modal onClose={() => setDeleteSaId(null)} title="Eliminar superadmin">
        <p className="text-sm text-gray-600 mb-4">¿Seguro que quieres eliminar este superadmin? Esta acción no se puede deshacer.</p>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setDeleteSaId(null)}>Cancelar</button>
          <button className="btn-danger" onClick={() => deleteSaMutation.mutate(deleteSaId!)} disabled={deleteSaMutation.isPending}>
            {deleteSaMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Eliminar"}
          </button>
        </div>
      </Modal>}

      {/* ════════════════ GESTIONES AVANZADAS ══════════════════════════════ */}
      {section === "gestiones_avanzadas" && (
        <>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Wrench size={22} className="text-orange-600" /> Gestiones Avanzadas
            </h1>
            <p className="text-sm text-gray-500">Operaciones destructivas — úsalas con precaución</p>
          </div>

          <div className="card space-y-4">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Users size={16} className="text-red-600" /> Eliminar socios por asociación
            </h2>
            <p className="text-sm text-gray-500">
              Elimina <strong>todos los socios, sus animales y datos asociados</strong> de una
              asociación. Los usuarios de gestión no se eliminan. Esta acción es irreversible.
            </p>

            {loadingTenants ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 animate-pulse rounded-lg" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {tenants.map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg px-4 py-3">
                    <div>
                      <span className="font-medium text-gray-900 text-sm">{t.name}</span>
                      <span className="text-xs text-gray-400 ml-2">({t.socios_count ?? 0} socios activos)</span>
                    </div>
                    <button
                      onClick={() => { setDeleteSociosTarget({ id: t.id, name: t.name }); setDeleteSociosConfirm(""); }}
                      className="btn-danger text-xs px-3 py-1.5 flex items-center gap-1.5"
                    >
                      <Trash2 size={13} /> Eliminar socios
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Modal confirmación eliminar socios ────────────────────────────── */}
      {deleteSociosTarget && (
        <Modal onClose={() => setDeleteSociosTarget(null)} title="Eliminar todos los socios">
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">
                <p className="font-semibold mb-1">Acción irreversible</p>
                <p>Se eliminarán <strong>todos los socios, animales, evaluaciones y datos</strong> de <strong>{deleteSociosTarget.name}</strong>. Los usuarios de gestión permanecerán.</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Escribe el nombre de la asociación para confirmar:
              </label>
              <p className="text-xs font-mono bg-gray-100 rounded px-2 py-1 mb-2 select-all">{deleteSociosTarget.name}</p>
              <input
                className="input-field"
                placeholder={deleteSociosTarget.name}
                value={deleteSociosConfirm}
                onChange={e => setDeleteSociosConfirm(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button className="btn-secondary flex-1" onClick={() => setDeleteSociosTarget(null)}>Cancelar</button>
              <button
                className="btn-danger flex-1"
                disabled={deleteSociosConfirm !== deleteSociosTarget.name || deleteSociosMutation.isPending}
                onClick={() => deleteSociosMutation.mutate(deleteSociosTarget.id)}
              >
                {deleteSociosMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Eliminar todos los socios"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
