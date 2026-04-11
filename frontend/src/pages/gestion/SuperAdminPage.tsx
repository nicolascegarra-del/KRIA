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
  Settings, AlertTriangle, Wrench, ScrollText, Clock, Tag,
  MapPin, Phone, AtSign, Settings2, GripVertical, X, Eye,
  ClipboardCheck, Archive, Download, FileArchive, RefreshCw, PawPrint,
  TrendingUp, Activity, LogIn, FileText, UploadCloud, ClipboardList,
} from "lucide-react";
import type { BackupJob } from "../../types";
import type { Tenant, GestionUserCreate, GestionUser, AnillaSize, PlatformSettings, PreguntaInstalacion } from "../../types";

// ── Types ─────────────────────────────────────────────────────────────────────
interface SuperAdminStats {
  tenants: number; tenants_activos: number;
  usuarios: number;
  socios_alta: number; socios_baja: number; socios_total: number;
  animales_activos: number; animales_baja: number; animales_total: number;
  logins_24h: number; logins_7d: number; logins_30d: number;
  informes_30d: number; importaciones_30d: number; evaluaciones_30d: number; auditorias_30d: number;
  por_asociacion: {
    id: string; name: string; slug: string; is_active: boolean; max_socios: number;
    socios_alta: number; socios_baja: number; socios_total: number;
    animales_activos: number; animales_baja: number; animales_total: number;
    logins_7d: number; logins_7d_socios: number; ultimo_acceso: string | null;
    informes_30d: number; importaciones_30d: number; evaluaciones_30d: number; auditorias_30d: number;
  }[];
}

type Section = "dashboard" | "asociaciones" | "configuracion" | "gestiones_avanzadas" | "log" | "mail_log" | "backups";

interface TenantForm {
  name: string; slug: string; primary_color: string; secondary_color: string;
  is_active: boolean; max_socios: number;
  nombre_completo: string; cif: string;
  email_asociacion: string;
  domicilio: string; cod_postal: string; municipio: string; provincia: string;
  telefono1: string; telefono1_nombre: string; telefono1_cargo: string; telefono1_email: string;
  telefono2: string; telefono2_nombre: string; telefono2_cargo: string; telefono2_email: string;
  granjas_enabled: boolean;
  importaciones_enabled: boolean;
  auditorias_enabled: boolean;
  anilla_sizes: AnillaSize[];
  smtp_host: string; smtp_port: number; smtp_user: string; smtp_password: string;
  smtp_from_email: string; smtp_from_name: string; smtp_use_tls: boolean; smtp_use_ssl: boolean;
}

const TENANT_DEFAULTS: TenantForm = {
  name: "", slug: "", primary_color: "#051937", secondary_color: "#2E6DB4",
  is_active: true, max_socios: 50,
  nombre_completo: "", cif: "", email_asociacion: "",
  domicilio: "", cod_postal: "", municipio: "", provincia: "",
  telefono1: "", telefono1_nombre: "", telefono1_cargo: "", telefono1_email: "",
  telefono2: "", telefono2_nombre: "", telefono2_cargo: "", telefono2_email: "",
  granjas_enabled: true, importaciones_enabled: true, auditorias_enabled: true, anilla_sizes: [],
  smtp_host: "", smtp_port: 587, smtp_user: "", smtp_password: "",
  smtp_from_email: "", smtp_from_name: "", smtp_use_tls: true, smtp_use_ssl: false,
};

// ── Tenant column definitions (for the configurable table) ────────────────────
const LS_TENANTS_COLS = "tenants_table_cols";

interface TenantColDef {
  id: string;
  label: string;
  render: (t: Tenant) => React.ReactNode;
}

const TENANT_ALL_COLS: TenantColDef[] = [
  { id: "nombre_completo", label: "Nombre completo", render: (t) => <span className="text-sm text-gray-600 truncate max-w-[200px] block">{t.nombre_completo || <span className="text-gray-300">—</span>}</span> },
  { id: "cif", label: "CIF", render: (t) => <span className="font-mono text-sm text-gray-600">{t.cif || <span className="text-gray-300">—</span>}</span> },
  { id: "email", label: "Email", render: (t) => <span className="text-sm text-gray-600">{t.email_asociacion || <span className="text-gray-300">—</span>}</span> },
  { id: "municipio", label: "Municipio", render: (t) => <span className="text-sm text-gray-600">{t.municipio || <span className="text-gray-300">—</span>}</span> },
  { id: "provincia", label: "Provincia", render: (t) => <span className="text-sm text-gray-600">{t.provincia || <span className="text-gray-300">—</span>}</span> },
  { id: "socios", label: "Socios", render: (t) => {
    const pct = (t.max_socios ?? 0) > 0 ? Math.min(((t.socios_count ?? 0) / (t.max_socios ?? 1)) * 100, 100) : 0;
    const bar = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-400" : "bg-green-500";
    return (
      <div className="flex items-center gap-2 min-w-[100px]">
        {(t.max_socios ?? 0) > 0 && <div className="w-16 bg-gray-100 rounded-full h-1.5 shrink-0"><div className={`h-1.5 rounded-full ${bar}`} style={{ width: `${pct}%` }} /></div>}
        <span className="text-xs text-gray-500 whitespace-nowrap">{t.socios_count ?? 0}{(t.max_socios ?? 0) > 0 ? `/${t.max_socios}` : ""}</span>
      </div>
    );
  }},
  { id: "estado", label: "Estado", render: (t) => (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
      {t.is_active ? "Activa" : "Suspendida"}
    </span>
  )},
  { id: "created_at", label: "Fecha alta", render: (t) => t.created_at ? <span className="text-sm text-gray-500">{new Date(t.created_at).toLocaleDateString("es-ES")}</span> : <span className="text-gray-300">—</span> },
];

const TENANT_DEFAULT_VISIBLE = ["cif", "email", "socios", "estado"];

interface TenantColState { id: string; visible: boolean; }

function loadTenantColState(): TenantColState[] {
  try {
    const raw = localStorage.getItem(LS_TENANTS_COLS);
    if (raw) {
      const saved: TenantColState[] = JSON.parse(raw);
      const ids = new Set(saved.map((c) => c.id));
      const merged = [...saved];
      TENANT_ALL_COLS.forEach((c) => { if (!ids.has(c.id)) merged.push({ id: c.id, visible: false }); });
      return merged;
    }
  } catch {}
  return TENANT_ALL_COLS.map((c) => ({ id: c.id, visible: TENANT_DEFAULT_VISIBLE.includes(c.id) }));
}

function TenantColConfigPanel({ cols, onChange, onClose }: { cols: TenantColState[]; onChange: (cols: TenantColState[]) => void; onClose: () => void; }) {
  const [local, setLocal] = useState<TenantColState[]>(cols);
  const dragIdx = useRef<number | null>(null);

  const toggleVisible = (id: string) => setLocal((prev) => prev.map((c) => c.id === id ? { ...c, visible: !c.visible } : c));
  const handleDragStart = (idx: number) => { dragIdx.current = idx; };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    const next = [...local];
    const [moved] = next.splice(dragIdx.current, 1);
    next.splice(idx, 0, moved);
    dragIdx.current = idx;
    setLocal(next);
  };
  const handleDrop = () => { dragIdx.current = null; };
  const save = () => { onChange(local); onClose(); };
  const reset = () => setLocal(TENANT_ALL_COLS.map((c) => ({ id: c.id, visible: TENANT_DEFAULT_VISIBLE.includes(c.id) })));

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-72 max-w-[calc(100vw-2rem)] bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="font-semibold text-gray-800 text-sm">Configurar columnas</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <p className="text-xs text-gray-500 px-4 pt-2 pb-1">Arrastra para reordenar · Marca para mostrar</p>
        <ul className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {local.map((cs, idx) => {
            const def = TENANT_ALL_COLS.find((c) => c.id === cs.id)!;
            if (!def) return null;
            return (
              <li key={cs.id} draggable onDragStart={() => handleDragStart(idx)} onDragOver={(e) => handleDragOver(e, idx)} onDrop={handleDrop}
                className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-gray-50 cursor-grab active:cursor-grabbing select-none">
                <GripVertical size={14} className="text-gray-300 shrink-0" />
                <input type="checkbox" checked={cs.visible} onChange={() => toggleVisible(cs.id)} className="accent-violet-600" />
                <span className="text-sm text-gray-700">{def.label}</span>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-gray-200 px-4 py-3 flex gap-2">
          <button onClick={reset} className="btn-secondary text-xs flex-1">Restablecer</button>
          <button onClick={save} className="btn-primary text-xs flex-1">Aplicar</button>
        </div>
      </div>
    </div>
  );
}

const USER_DEFAULTS: GestionUserCreate = { email: "", first_name: "", last_name: "", password: "" };

interface UserEditForm {
  email: string; first_name: string; last_name: string; password: string;
  notif_nueva_asociacion: boolean;
  notif_asociacion_suspendida: boolean;
  notif_asociacion_activada: boolean;
  notif_asociacion_eliminada: boolean;
  notif_propuesta_mejora: boolean;
  notif_health_check: boolean;
}

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
    : location.pathname.includes("/mail-log")
    ? "mail_log"
    : location.pathname.includes("/log")
    ? "log"
    : location.pathname.includes("backups")
    ? "backups"
    : "dashboard";

  // ── Tenant modal state ─────────────────────────────────────────────────────
  const [tenantModalOpen, setTenantModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [tenantForm, setTenantForm] = useState<TenantForm>(TENANT_DEFAULTS);
  const [newUserForm, setNewUserForm] = useState<GestionUserCreate>(USER_DEFAULTS);
  const [deleteModalTenant, setDeleteModalTenant] = useState<Tenant | null>(null);
  const [deleteTenantPassword, setDeleteTenantPassword] = useState("");
  const [deleteTenantPasswordError, setDeleteTenantPasswordError] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // ── Users-per-tenant modal state ───────────────────────────────────────────
  const [usersModalTenant, setUsersModalTenant] = useState<Tenant | null>(null);
  const [addingUser, setAddingUser] = useState(false);
  const [addUserForm, setAddUserForm] = useState<GestionUserCreate>(USER_DEFAULTS);
  const [editingUser, setEditingUser] = useState<GestionUser | null>(null);
  const [editUserForm, setEditUserForm] = useState<UserEditForm>({ email: "", first_name: "", last_name: "", password: "", notif_nueva_asociacion: false, notif_asociacion_suspendida: false, notif_asociacion_activada: false, notif_asociacion_eliminada: false, notif_propuesta_mejora: false, notif_health_check: false });
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  // ── Audit config modal state ───────────────────────────────────────────────
  const [auditConfigTenant, setAuditConfigTenant] = useState<Tenant | null>(null);

  // ── Gestiones avanzadas — selector de asociación por acción ───────────────
  const [advancedTenant, setAdvancedTenant] = useState<Record<string, string>>({});

  // ── SuperAdmin modal state ─────────────────────────────────────────────────
  const [saModalOpen, setSaModalOpen] = useState(false);
  const [editingSa, setEditingSa] = useState<GestionUser | null>(null);
  const [saForm, setSaForm] = useState<UserEditForm>({ email: "", first_name: "", last_name: "", password: "", notif_nueva_asociacion: false, notif_asociacion_suspendida: false, notif_asociacion_activada: false, notif_asociacion_eliminada: false, notif_propuesta_mejora: false, notif_health_check: false });
  const [deleteSaId, setDeleteSaId] = useState<string | null>(null);

  const [error, setError, clearError] = useAutoCloseError();
  const [userError, setUserError, clearUserError] = useAutoCloseError();
  const [saError, setSaError, clearSaError] = useAutoCloseError();

  // ── Tenant table column state ──────────────────────────────────────────────
  const [tenantColState, setTenantColState] = useState<TenantColState[]>(loadTenantColState);
  const [showTenantColPanel, setShowTenantColPanel] = useState(false);
  useEffect(() => { localStorage.setItem(LS_TENANTS_COLS, JSON.stringify(tenantColState)); }, [tenantColState]);

  // ── Log state ─────────────────────────────────────────────────────────────
  const [logTenantFilter, setLogTenantFilter] = useState("");
  const [logRoleFilter, setLogRoleFilter] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [logDateFrom, setLogDateFrom] = useState("");
  const [logDateTo, setLogDateTo] = useState("");
  const [logPage, setLogPage] = useState(1);

  // ── Mail Log state ─────────────────────────────────────────────────────────
  const [mailLogTipoFilter, setMailLogTipoFilter] = useState("");
  const [mailLogSuccessFilter, setMailLogSuccessFilter] = useState("");
  const [mailLogSearch, setMailLogSearch] = useState("");
  const [mailLogDateFrom, setMailLogDateFrom] = useState("");
  const [mailLogDateTo, setMailLogDateTo] = useState("");
  const [mailLogPage, setMailLogPage] = useState(1);
  const [mailLogDetail, setMailLogDetail] = useState<{ asunto: string; cuerpo: string; error: string; destinatarios: string } | null>(null);

  // ── Clear log modals ──────────────────────────────────────────────────────
  const [clearLogModal, setClearLogModal] = useState<"access" | "mail" | null>(null);
  const [clearLogPassword, setClearLogPassword] = useState("");
  const [clearLogError, setClearLogError] = useState("");

  // ── Gestiones Avanzadas state ──────────────────────────────────────────────
  const [deleteSociosTarget, setDeleteSociosTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteSociosConfirm, setDeleteSociosConfirm] = useState("");
  const [deleteAnimalesTarget, setDeleteAnimalesTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteAnimalesConfirm, setDeleteAnimalesConfirm] = useState("");
  const [deleteAnillasTarget, setDeleteAnillasTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteAnillasConfirm, setDeleteAnillasConfirm] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // ── Platform SMTP state ────────────────────────────────────────────────────
  const [platformSmtpForm, setPlatformSmtpForm] = useState<PlatformSettings>({
    smtp_host: "", smtp_port: 587, smtp_user: "", smtp_password: "",
    smtp_from_email: "", smtp_from_name: "", smtp_use_tls: true, smtp_use_ssl: false,
    inactivity_timeout_minutes: 30,
  });
  const [platformSmtpTestResult, setPlatformSmtpTestResult] = useState<string | null>(null);
  const [platformSmtpTesting, setPlatformSmtpTesting] = useState(false);
  const [tenantSmtpTestResult, setTenantSmtpTestResult] = useState<string | null>(null);
  const [tenantSmtpTesting, setTenantSmtpTesting] = useState(false);

  // ── Backup state ──────────────────────────────────────────────────────────
  const [backupImportFile, setBackupImportFile] = useState<File | null>(null);
  const [backupImportError, setBackupImportError] = useState("");
  const backupImportRef = useRef<HTMLInputElement>(null);
  const [showClearBackupJobs, setShowClearBackupJobs] = useState(false);

  const { data: backupJobs = [], refetch: refetchBackupJobs } = useQuery<BackupJob[]>({
    queryKey: ["backup-jobs"],
    queryFn: () => superadminApi.backups.listJobs(),
    enabled: section === "backups",
    refetchInterval: (query) => {
      const jobs = query.state.data ?? [];
      const hasPending = jobs.some((j) => j.status === "PENDING" || j.status === "RUNNING");
      return hasPending ? 3000 : false;
    },
  });

  const exportMutation = useMutation({
    mutationFn: (tenantId: string) => superadminApi.backups.exportTenant(tenantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backup-jobs"] });
      setSuccessMsg("Exportación iniciada. Consulta el historial en Copias de Seguridad.");
    },
    onError: (e: any) => setError(e?.response?.data?.detail ?? "Error al iniciar la exportación."),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => superadminApi.backups.importBackup(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backup-jobs"] });
      setBackupImportFile(null);
      setBackupImportError("");
      setSuccessMsg("Importación iniciada. Consulta el historial para ver el progreso.");
    },
    onError: (e: any) => setBackupImportError(e?.response?.data?.detail ?? "Error al iniciar la importación."),
  });

  const clearBackupJobsMutation = useMutation({
    mutationFn: () => superadminApi.backups.clearJobs(),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["backup-jobs"] });
      setShowClearBackupJobs(false);
      setSuccessMsg(data.detail);
    },
    onError: () => setError("Error al limpiar el historial."),
  });

  const handleBackupDownload = async (job: BackupJob) => {
    try {
      const { url, filename } = await superadminApi.backups.getDownloadUrl(job.id);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
    } catch {
      setError("Error al obtener la URL de descarga.");
    }
  };

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = useQuery<SuperAdminStats>({
    queryKey: ["superadmin-stats"],
    queryFn: superadminApi.stats,
  });
  const { data: tenantsData, isLoading: loadingTenants } = useQuery({
    queryKey: ["superadmin-tenants"],
    queryFn: () => superadminApi.listTenants(),
    enabled: section === "asociaciones" || section === "dashboard" || section === "gestiones_avanzadas",
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
  const { data: logsData, isLoading: loadingLogs } = useQuery({
    queryKey: ["superadmin-logs", logTenantFilter, logRoleFilter, logSearch, logDateFrom, logDateTo, logPage],
    queryFn: () => superadminApi.getLogs({
      tenant_id: logTenantFilter || undefined,
      role: logRoleFilter || undefined,
      search: logSearch || undefined,
      date_from: logDateFrom || undefined,
      date_to: logDateTo || undefined,
      page: logPage,
    }),
    enabled: section === "log",
  });

  const { data: mailLogData, isLoading: loadingMailLog } = useQuery({
    queryKey: ["superadmin-mail-log", mailLogTipoFilter, mailLogSuccessFilter, mailLogSearch, mailLogDateFrom, mailLogDateTo, mailLogPage],
    queryFn: () => superadminApi.getMailLog({
      tipo: mailLogTipoFilter || undefined,
      success: mailLogSuccessFilter || undefined,
      search: mailLogSearch || undefined,
      date_from: mailLogDateFrom || undefined,
      date_to: mailLogDateTo || undefined,
      page: mailLogPage,
    }),
    enabled: section === "mail_log",
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
      const flattenErrors = (v: any): string => {
        if (Array.isArray(v)) return v.join(" ");
        if (v && typeof v === "object") return Object.entries(v).map(([fk, fv]) => `${fk}: ${flattenErrors(fv)}`).join(", ");
        return String(v);
      };
      const msgs = Object.entries(d).map(([k, v]) => `${k}: ${flattenErrors(v)}`).join(" | ");
      setError(msgs || "Error al crear.");
    },
  });
  const updateTenantMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Tenant> }) => superadminApi.updateTenant(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-tenants"] }); closeTenantModal(); setSuccessMsg("Asociación actualizada."); },
    onError: (e: any) => setError(e?.response?.data?.detail ?? "Error al actualizar."),
  });
  const deleteTenantMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => superadminApi.deleteTenant(id, password),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-tenants"] }); qc.invalidateQueries({ queryKey: ["superadmin-stats"] }); setDeleteModalTenant(null); setDeleteTenantPassword(""); setDeleteTenantPasswordError(""); setSuccessMsg("Asociación eliminada definitivamente."); },
    onError: (e: any) => setDeleteTenantPasswordError(e?.response?.data?.detail ?? "Error al eliminar."),
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

  const [healthCheckResults, setHealthCheckResults] = useState<string[] | null>(null);
  const runHealthCheckMutation = useMutation({
    mutationFn: superadminApi.runHealthCheck,
    onSuccess: (data) => setHealthCheckResults(data.results),
    onError: (e: any) => setSaError(e?.response?.data?.detail ?? "Error al enviar el informe."),
  });

  // ── Platform settings mutations ────────────────────────────────────────────
  const deleteAnimalesMutation = useMutation({
    mutationFn: (id: string) => superadminApi.deleteTenantAnimales(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["superadmin-tenants"] });
      qc.invalidateQueries({ queryKey: ["superadmin-stats"] });
      setDeleteAnimalesTarget(null);
      setDeleteAnimalesConfirm("");
      setSuccessMsg(data.detail);
    },
    onError: (e: any) => setError(e?.response?.data?.detail ?? "Error al eliminar animales."),
  });

  const deleteAnillasMutation = useMutation({
    mutationFn: (id: string) => superadminApi.deleteTenantAnillas(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["superadmin-tenants"] });
      setDeleteAnillasTarget(null);
      setDeleteAnillasConfirm("");
      setSuccessMsg(data.detail);
    },
  });

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

  const clearAccessLogMutation = useMutation({
    mutationFn: (password: string) => superadminApi.clearAccessLog(password),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["superadmin-logs"] });
      setClearLogModal(null); setClearLogPassword(""); setClearLogError("");
      setSuccessMsg(data.detail);
    },
    onError: (e: any) => setClearLogError(e?.response?.data?.detail ?? "Error al limpiar."),
  });
  const clearMailLogMutation = useMutation({
    mutationFn: (password: string) => superadminApi.clearMailLog(password),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["superadmin-mail-log"] });
      setClearLogModal(null); setClearLogPassword(""); setClearLogError("");
      setSuccessMsg(data.detail);
    },
    onError: (e: any) => setClearLogError(e?.response?.data?.detail ?? "Error al limpiar."),
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
      nombre_completo: t.nombre_completo ?? "", cif: t.cif ?? "",
      email_asociacion: t.email_asociacion || t.email_notificaciones || "",
      domicilio: t.domicilio ?? "", cod_postal: t.cod_postal ?? "",
      municipio: t.municipio ?? "", provincia: t.provincia ?? "",
      telefono1: t.telefono1 ?? "", telefono1_nombre: t.telefono1_nombre ?? "",
      telefono1_cargo: t.telefono1_cargo ?? "", telefono1_email: t.telefono1_email ?? "",
      telefono2: t.telefono2 ?? "", telefono2_nombre: t.telefono2_nombre ?? "",
      telefono2_cargo: t.telefono2_cargo ?? "", telefono2_email: t.telefono2_email ?? "",
      granjas_enabled: t.granjas_enabled ?? true,
      importaciones_enabled: t.importaciones_enabled ?? true,
      auditorias_enabled: t.auditorias_enabled ?? true,
      anilla_sizes: t.anilla_sizes ?? [],
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
  const handleLogoDelete = async () => {
    if (!editingTenant) return;
    setLogoUploading(true);
    try {
      await superadminApi.deleteLogo(editingTenant.id);
      setLogoPreview(null);
      qc.invalidateQueries({ queryKey: ["superadmin-tenants"] });
      setSuccessMsg("Logo eliminado.");
    } catch { setError("Error al eliminar el logo."); }
    finally { setLogoUploading(false); }
  };

  // ── SA helpers ─────────────────────────────────────────────────────────────
  const closeSaModal = () => { setSaModalOpen(false); setEditingSa(null); setSaForm({ email: "", first_name: "", last_name: "", password: "", notif_nueva_asociacion: false, notif_asociacion_suspendida: false, notif_asociacion_activada: false, notif_asociacion_eliminada: false, notif_propuesta_mejora: false, notif_health_check: false }); setHealthCheckResults(null); clearSaError(); };
  const openCreateSa = () => { setEditingSa(null); setSaForm({ email: "", first_name: "", last_name: "", password: "", notif_nueva_asociacion: false, notif_asociacion_suspendida: false, notif_asociacion_activada: false, notif_asociacion_eliminada: false, notif_propuesta_mejora: false, notif_health_check: false }); clearSaError(); setSaModalOpen(true); };
  const openEditSa = (u: GestionUser) => { setEditingSa(u); setSaForm({ email: u.email, first_name: u.first_name, last_name: u.last_name, password: "", notif_nueva_asociacion: u.notif_nueva_asociacion ?? false, notif_asociacion_suspendida: u.notif_asociacion_suspendida ?? false, notif_asociacion_activada: u.notif_asociacion_activada ?? false, notif_asociacion_eliminada: u.notif_asociacion_eliminada ?? false, notif_propuesta_mejora: u.notif_propuesta_mejora ?? false, notif_health_check: u.notif_health_check ?? false }); clearSaError(); setSaModalOpen(true); };
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
    <div className="space-y-6">
      <SuccessToast message={successMsg} onDismiss={() => setSuccessMsg("")} />

        {/* ════════════════ DASHBOARD ════════════════════════════════════════ */}
        {section === "dashboard" && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-violet-100 flex items-center justify-center shrink-0">
                    <BarChart2 size={20} className="text-violet-600" />
                  </div>
                  Cuadro de Mandos
                </h1>
                <p className="text-sm text-gray-400 mt-0.5 ml-[52px]">Visión global de la plataforma en tiempo real</p>
              </div>
              <button
                onClick={() => qc.invalidateQueries({ queryKey: ["superadmin-stats"] })}
                className="btn-ghost flex items-center gap-2 text-sm px-3 py-2"
                title="Actualizar datos"
              >
                <RefreshCw size={14} className={statsLoading ? "animate-spin" : ""} />
                Actualizar
              </button>
            </div>

            {/* Skeleton while loading */}
            {statsLoading && !stats && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1,2,3,4].map(i => <div key={i} className="h-36 bg-gray-100 rounded-2xl animate-pulse" />)}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[1,2,3,4,5,6].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
                </div>
                <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
              </div>
            )}

            {stats && (
              <>
                {/* ── Fila 1: Hero KPIs ────────────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

                  {/* Asociaciones */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
                    <div className="flex items-start justify-between">
                      <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center">
                        <Building size={20} className="text-violet-600" />
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${stats.tenants_activos === stats.tenants ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                        {stats.tenants_activos} / {stats.tenants}
                      </span>
                    </div>
                    <div>
                      <div className="text-4xl font-bold text-gray-900 leading-none">{stats.tenants_activos}</div>
                      <div className="text-sm font-medium text-gray-500 mt-1">Asociaciones activas</div>
                    </div>
                    <div className="pt-3 border-t border-gray-50 flex items-center gap-2 text-xs text-gray-400">
                      <Users size={12} />
                      {stats.usuarios} admin{stats.usuarios !== 1 ? "s" : ""} de gestión
                    </div>
                  </div>

                  {/* Socios */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
                    <div className="flex items-start justify-between">
                      <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center">
                        <UserCheck size={20} className="text-emerald-600" />
                      </div>
                      <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">{stats.socios_total} total</span>
                    </div>
                    <div>
                      <div className="text-4xl font-bold text-gray-900 leading-none">{stats.socios_alta}</div>
                      <div className="text-sm font-medium text-gray-500 mt-1">Socios en alta</div>
                    </div>
                    <div className="pt-3 border-t border-gray-50 flex items-center justify-between text-xs">
                      <span className="text-gray-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                        {stats.socios_baja} en baja
                      </span>
                      {stats.socios_total > 0 && (
                        <span className="text-emerald-600 font-semibold">
                          {Math.round((stats.socios_alta / stats.socios_total) * 100)}% activos
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Animales */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
                    <div className="flex items-start justify-between">
                      <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center">
                        <PawPrint size={20} className="text-amber-600" />
                      </div>
                      <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">{stats.animales_total} total</span>
                    </div>
                    <div>
                      <div className="text-4xl font-bold text-gray-900 leading-none">{stats.animales_activos}</div>
                      <div className="text-sm font-medium text-gray-500 mt-1">Animales activos</div>
                    </div>
                    <div className="pt-3 border-t border-gray-50 flex items-center justify-between text-xs">
                      <span className="text-gray-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
                        {stats.animales_baja} en baja
                      </span>
                      {stats.animales_total > 0 && (
                        <span className="text-amber-600 font-semibold">
                          {Math.round((stats.animales_activos / stats.animales_total) * 100)}% activos
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Accesos */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
                    <div className="flex items-start justify-between">
                      <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
                        <LogIn size={20} className="text-blue-600" />
                      </div>
                      <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">Últimas 24h</span>
                    </div>
                    <div>
                      <div className="text-4xl font-bold text-gray-900 leading-none">{stats.logins_24h}</div>
                      <div className="text-sm font-medium text-gray-500 mt-1">Accesos hoy</div>
                    </div>
                    <div className="pt-3 border-t border-gray-50 flex items-center gap-2 text-xs text-gray-400">
                      <Activity size={12} />
                      {stats.logins_7d} accesos esta semana
                    </div>
                  </div>

                </div>

                {/* ── Fila 2: Actividad 30 días ────────────────────────────── */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Actividad — últimos 30 días</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {([
                      { label: "Accesos 7d",     value: stats.logins_7d,         icon: <Activity size={15} />,       color: "text-blue-600",    bg: "bg-blue-50" },
                      { label: "Accesos 30d",     value: stats.logins_30d,        icon: <TrendingUp size={15} />,     color: "text-violet-600",  bg: "bg-violet-50" },
                      { label: "Informes",        value: stats.informes_30d,      icon: <FileText size={15} />,       color: "text-emerald-600", bg: "bg-emerald-50" },
                      { label: "Importaciones",   value: stats.importaciones_30d, icon: <UploadCloud size={15} />,    color: "text-cyan-600",    bg: "bg-cyan-50" },
                      { label: "Evaluaciones",    value: stats.evaluaciones_30d,  icon: <ClipboardList size={15} />,  color: "text-orange-600",  bg: "bg-orange-50" },
                      { label: "Auditorías",      value: stats.auditorias_30d,    icon: <ClipboardCheck size={15} />, color: "text-pink-600",    bg: "bg-pink-50" },
                    ] as const).map((k) => (
                      <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg ${k.bg} flex items-center justify-center shrink-0`}>
                          <span className={k.color}>{k.icon}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-2xl font-bold text-gray-900 leading-none">{k.value}</div>
                          <div className="text-xs text-gray-400 mt-0.5 leading-tight">{k.label}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Fila 3: Tabla por asociación ─────────────────────────── */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Detalle por asociación</p>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          {/* Grupos de columnas */}
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th colSpan={2} className="py-2 px-4 text-left" />
                            <th colSpan={2} className="py-2 px-3 text-center border-l border-gray-100">
                              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Socios</span>
                            </th>
                            <th colSpan={1} className="py-2 px-3 text-center border-l border-gray-100">
                              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Animales</span>
                            </th>
                            <th colSpan={2} className="py-2 px-3 text-center border-l border-gray-100">
                              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Accesos</span>
                            </th>
                            <th colSpan={4} className="py-2 px-3 text-center border-l border-gray-100">
                              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Operaciones 30d</span>
                            </th>
                            <th className="border-l border-gray-100 py-2 px-4" />
                          </tr>
                          {/* Cabeceras de columna */}
                          <tr className="border-b border-gray-100 text-xs font-medium text-gray-400">
                            <th className="text-left py-3 px-4 w-full">Asociación</th>
                            <th className="text-left py-3 px-3 whitespace-nowrap w-px">Estado</th>
                            <th className="text-right py-3 px-3 whitespace-nowrap w-px border-l border-gray-50">Alta</th>
                            <th className="text-right py-3 px-3 whitespace-nowrap w-px">Baja</th>
                            <th className="text-right py-3 px-3 whitespace-nowrap w-px border-l border-gray-50">Activos</th>
                            <th className="text-right py-3 px-3 whitespace-nowrap w-px border-l border-gray-50" title="Accesos admin + socios últimos 7 días">7 días</th>
                            <th className="text-right py-3 px-3 whitespace-nowrap w-px" title="Accesos de socios últimos 7 días">Socios</th>
                            <th className="text-right py-3 px-3 whitespace-nowrap w-px border-l border-gray-50" title="Informes generados">Inf.</th>
                            <th className="text-right py-3 px-3 whitespace-nowrap w-px" title="Importaciones">Imp.</th>
                            <th className="text-right py-3 px-3 whitespace-nowrap w-px" title="Evaluaciones">Eval.</th>
                            <th className="text-right py-3 px-3 whitespace-nowrap w-px" title="Auditorías">Aud.</th>
                            <th className="text-right py-3 px-4 whitespace-nowrap w-px border-l border-gray-50">Último acceso</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {stats.por_asociacion.map((a) => {
                            const pct = a.max_socios > 0 ? Math.min((a.socios_alta / a.max_socios) * 100, 100) : 0;
                            const barColor = pct >= 90 ? "bg-red-400" : pct >= 70 ? "bg-amber-400" : "bg-emerald-400";
                            const sinActividad = a.logins_7d === 0 && a.is_active;
                            const ultimoAcceso = a.ultimo_acceso
                              ? new Date(a.ultimo_acceso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Madrid" })
                              : "—";
                            return (
                              <tr key={a.id} className={`hover:bg-violet-50/20 transition-colors ${!a.is_active ? "opacity-50" : ""}`}>
                                <td className="py-4 px-4">
                                  <div className="font-semibold text-gray-900 text-sm leading-tight">{a.name}</div>
                                  {a.max_socios > 0 && (
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <div className="w-24 bg-gray-100 rounded-full h-1.5 shrink-0">
                                        <div className={`h-1.5 rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                                      </div>
                                      <span className="text-xs text-gray-400">{a.socios_alta} / {a.max_socios}</span>
                                    </div>
                                  )}
                                </td>
                                <td className="py-4 px-3 whitespace-nowrap">
                                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${a.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.is_active ? "bg-green-500" : "bg-red-500"}`} />
                                    {a.is_active ? "Activa" : "Suspendida"}
                                  </span>
                                </td>
                                <td className="py-4 px-3 text-right whitespace-nowrap border-l border-gray-50">
                                  <span className="font-bold text-gray-900">{a.socios_alta}</span>
                                </td>
                                <td className="py-4 px-3 text-right whitespace-nowrap">
                                  {a.socios_baja > 0
                                    ? <span className="text-red-500 text-xs font-medium">{a.socios_baja}</span>
                                    : <span className="text-gray-200 text-xs">—</span>}
                                </td>
                                <td className="py-4 px-3 text-right whitespace-nowrap border-l border-gray-50">
                                  <span className="font-bold text-gray-900">{a.animales_activos}</span>
                                  {a.animales_baja > 0 && (
                                    <span className="text-gray-400 text-xs ml-1.5">+{a.animales_baja}↓</span>
                                  )}
                                </td>
                                <td className="py-4 px-3 text-right whitespace-nowrap border-l border-gray-50">
                                  {sinActividad
                                    ? <span className="inline-flex items-center gap-1 text-red-400 font-bold text-sm">
                                        <AlertTriangle size={11} /> {a.logins_7d}
                                      </span>
                                    : <span className="font-bold text-gray-900">{a.logins_7d}</span>}
                                </td>
                                <td className="py-4 px-3 text-right whitespace-nowrap text-gray-500 text-xs">{a.logins_7d_socios}</td>
                                <td className="py-4 px-3 text-right whitespace-nowrap border-l border-gray-50">
                                  {a.informes_30d > 0 ? <span className="font-medium text-gray-700">{a.informes_30d}</span> : <span className="text-gray-200">—</span>}
                                </td>
                                <td className="py-4 px-3 text-right whitespace-nowrap">
                                  {a.importaciones_30d > 0 ? <span className="font-medium text-gray-700">{a.importaciones_30d}</span> : <span className="text-gray-200">—</span>}
                                </td>
                                <td className="py-4 px-3 text-right whitespace-nowrap">
                                  {a.evaluaciones_30d > 0 ? <span className="font-medium text-gray-700">{a.evaluaciones_30d}</span> : <span className="text-gray-200">—</span>}
                                </td>
                                <td className="py-4 px-3 text-right whitespace-nowrap">
                                  {a.auditorias_30d > 0 ? <span className="font-medium text-gray-700">{a.auditorias_30d}</span> : <span className="text-gray-200">—</span>}
                                </td>
                                <td className="py-4 px-4 text-right whitespace-nowrap border-l border-gray-50 text-xs text-gray-400">{ultimoAcceso}</td>
                              </tr>
                            );
                          })}
                          {stats.por_asociacion.length === 0 && (
                            <tr>
                              <td colSpan={12} className="py-16 text-center text-sm text-gray-400">
                                No hay asociaciones registradas.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ════════════════ ASOCIACIONES ═════════════════════════════════════ */}
        {section === "asociaciones" && (
          <>
            {showTenantColPanel && (
              <TenantColConfigPanel cols={tenantColState} onChange={setTenantColState} onClose={() => setShowTenantColPanel(false)} />
            )}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Building size={22} className="text-violet-600" /> Asociaciones
                </h1>
                <p className="text-sm text-gray-500">{tenants.length > 0 ? `${tenants.length} asociaciones registradas` : "Gestión de asociaciones registradas"}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowTenantColPanel(true)} className="btn-ghost gap-1.5 flex items-center text-sm" title="Configurar columnas">
                  <Settings2 size={15} /> Columnas
                </button>
                <button onClick={openCreateTenant} className="btn-primary gap-2 flex items-center">
                  <Plus size={16} /> Nueva Asociación
                </button>
              </div>
            </div>

            <ErrorAlert message={error} onDismiss={clearError} />

            {loadingTenants ? (
              <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
            ) : tenants.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No hay asociaciones.</p>
            ) : (() => {
              const visibleCols = tenantColState
                .filter((cs) => cs.visible)
                .map((cs) => TENANT_ALL_COLS.find((c) => c.id === cs.id)!)
                .filter(Boolean);
              return (
                <div className="card overflow-x-auto p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide w-full">Asociación</th>
                        {visibleCols.map((col) => (
                          <th key={col.id} className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap w-px">{col.label}</th>
                        ))}
                        <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap w-px">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {tenants.map((t) => (
                        <tr key={t.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center overflow-hidden" style={{ background: t.primary_color }}>
                                {t.logo_url ? <img src={t.logo_url} alt="" className="w-full h-full object-cover" /> : <Building size={14} className="text-white" />}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 leading-tight">{t.name}</p>
                                <p className="text-xs text-gray-400 font-mono leading-tight">{t.slug}</p>
                              </div>
                            </div>
                          </td>
                          {visibleCols.map((col) => (
                            <td key={col.id} className="py-3 px-3 whitespace-nowrap">{col.render(t)}</td>
                          ))}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center justify-end gap-0.5">
                              <button title="Gestionar usuarios admin" className="btn-ghost p-1.5" onClick={() => setUsersModalTenant(t)}><Users size={14} /></button>
                              <button title="Editar" className="btn-ghost p-1.5" onClick={() => openEditTenant(t)}><Edit2 size={14} /></button>
                              <button title={t.is_active ? "Suspender" : "Activar"} className="btn-ghost p-1.5"
                                onClick={() => t.is_active ? suspendTenantMutation.mutate(t.id) : activateTenantMutation.mutate(t.id)}>
                                {t.is_active ? <PauseCircle size={14} className="text-amber-500" /> : <PlayCircle size={14} className="text-green-600" />}
                              </button>
                              <button title="Acceder como admin" className="btn-ghost p-1.5" onClick={() => impersonateMutation.mutate(t.id)} disabled={!t.is_active}>
                                <Eye size={14} className="text-violet-600" />
                              </button>
                              <button title="Exportar copia de seguridad" className="btn-ghost p-1.5" onClick={() => exportMutation.mutate(t.id)}
                                disabled={exportMutation.isPending}>
                                <Archive size={14} className="text-emerald-600" />
                              </button>
                              <button title="Eliminar" className="btn-ghost p-1.5" onClick={() => setDeleteModalTenant(t)}><Trash2 size={14} className="text-red-500" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </>
        )}

        {/* ════════════════ CONFIGURACIÓN ════════════════════════════════════ */}
        {section === "configuracion" && (
          <>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Settings size={22} className="text-violet-600" /> Configuración
              </h1>
              <p className="text-sm text-gray-500">Parámetros globales de la plataforma</p>
            </div>

            {/* ── Seguridad ── */}
            <div className="card space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                <div className="w-1 h-4 bg-violet-400 rounded-full" />
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Clock size={14} /> Seguridad</h2>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cierre de sesión por inactividad</label>
                <p className="text-xs text-gray-400 mb-2">Aplica a todos los usuarios de la plataforma. <span className="font-medium">0 = desactivado.</span></p>
                <div className="flex items-center gap-3">
                  <input
                    type="number" min={0} max={480}
                    className="input-field w-28"
                    value={platformSmtpForm.inactivity_timeout_minutes}
                    onChange={(e) => setPlatformSmtpForm({ ...platformSmtpForm, inactivity_timeout_minutes: parseInt(e.target.value) || 0 })}
                  />
                  <span className="text-sm text-gray-500">minutos</span>
                  <button
                    className="btn-primary text-sm ml-auto"
                    onClick={() => updatePlatformSmtpMutation.mutate({ inactivity_timeout_minutes: platformSmtpForm.inactivity_timeout_minutes })}
                    disabled={updatePlatformSmtpMutation.isPending}
                  >
                    {updatePlatformSmtpMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Guardar"}
                  </button>
                </div>
              </div>
            </div>

            {/* ── SMTP Global ── */}
            <div className="card space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                <div className="w-1 h-4 bg-violet-400 rounded-full" />
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Mail size={14} /> Correo electrónico global</h2>
                <span className="text-xs text-gray-400 ml-1">— usado para enviar comunicaciones a las asociaciones</span>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); updatePlatformSmtpMutation.mutate(platformSmtpForm); }} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Servidor SMTP</label>
                    <input className="input-field" placeholder="smtp.gmail.com" value={platformSmtpForm.smtp_host} onChange={(e) => setPlatformSmtpForm({ ...platformSmtpForm, smtp_host: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Puerto</label>
                    <input className="input-field" type="number" value={platformSmtpForm.smtp_port} onChange={(e) => setPlatformSmtpForm({ ...platformSmtpForm, smtp_port: parseInt(e.target.value) || 587 })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Usuario</label>
                    <input className="input-field" value={platformSmtpForm.smtp_user} onChange={(e) => setPlatformSmtpForm({ ...platformSmtpForm, smtp_user: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña</label>
                    <input className="input-field" type="password" value={platformSmtpForm.smtp_password} onChange={(e) => setPlatformSmtpForm({ ...platformSmtpForm, smtp_password: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email remitente</label>
                    <input className="input-field" type="email" value={platformSmtpForm.smtp_from_email} onChange={(e) => setPlatformSmtpForm({ ...platformSmtpForm, smtp_from_email: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nombre remitente <span className="text-gray-400 font-normal">(opcional, ej: KRIA Notificaciones)</span></label>
                    <input className="input-field" placeholder="KRIA Notificaciones" value={platformSmtpForm.smtp_from_name} onChange={(e) => setPlatformSmtpForm({ ...platformSmtpForm, smtp_from_name: e.target.value })} />
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-wrap pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
                    <input type="checkbox" checked={platformSmtpForm.smtp_use_tls} onChange={(e) => setPlatformSmtpForm({ ...platformSmtpForm, smtp_use_tls: e.target.checked, smtp_use_ssl: e.target.checked ? false : platformSmtpForm.smtp_use_ssl })} className="rounded" />
                    STARTTLS
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
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
                    <button type="submit" className="btn-primary text-sm" disabled={updatePlatformSmtpMutation.isPending}>
                      {updatePlatformSmtpMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Guardar"}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* ── SuperAdmins ── */}
            <div className="card space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-violet-400 rounded-full" />
                  <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Shield size={14} /> SuperAdmins</h2>
                </div>
                <button onClick={openCreateSa} className="btn-primary gap-1.5 flex items-center text-xs">
                  <Plus size={13} /> Nuevo superadmin
                </button>
              </div>

              <ErrorAlert message={saError} onDismiss={clearSaError} />

              {loadingSa ? (
                <div className="space-y-2">{[1,2].map((i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
              ) : superAdmins.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No hay superadmins registrados.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 uppercase tracking-wide">
                      <th className="pb-2 text-left font-semibold">Nombre</th>
                      <th className="pb-2 text-left font-semibold">Email</th>
                      <th className="pb-2 text-left font-semibold">Alta</th>
                      <th className="pb-2 text-right font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {superAdmins.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50/50">
                        <td className="py-2.5 pr-4 font-medium text-gray-800">{u.first_name} {u.last_name || ""}</td>
                        <td className="py-2.5 pr-4 text-gray-500">{u.email}</td>
                        <td className="py-2.5 pr-4 text-gray-400 text-xs">{new Date(u.date_joined).toLocaleDateString("es-ES")}</td>
                        <td className="py-2.5">
                          <div className="flex gap-1 justify-end">
                            <button title="Editar" className="btn-ghost p-1.5" onClick={() => openEditSa(u)}><Pencil size={13} /></button>
                            <button title="Eliminar" className="btn-ghost p-1.5" onClick={() => setDeleteSaId(u.id)}><Trash2 size={13} className="text-red-500" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Crear / Editar Asociación
      ══════════════════════════════════════════════════════════════════════ */}
      {tenantModalOpen && <Modal onClose={closeTenantModal} title={editingTenant ? `Editar — ${editingTenant.name}` : "Nueva asociación"} maxWidth="max-w-3xl">
        <form onSubmit={handleTenantSubmit} className="space-y-6">
          <ErrorAlert message={error} onDismiss={clearError} />

          {/* ── IDENTIFICACIÓN ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
              <div className="w-1 h-4 bg-violet-400 rounded-full shrink-0" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Identificación</span>
            </div>
            <div className="flex gap-4">
              {/* Logo */}
              <div className="shrink-0">
                {editingTenant ? (
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-20 h-20 rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50" style={{ background: logoPreview ? undefined : tenantForm.primary_color }}>
                      {logoPreview
                        ? <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-1" />
                        : <Building size={22} className="text-white" />}
                    </div>
                    <button type="button" className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}>
                      {logoUploading ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                      {logoPreview ? "Cambiar" : "Subir logo"}
                    </button>
                    {logoPreview && (
                      <button type="button" className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1" onClick={handleLogoDelete} disabled={logoUploading}>
                        <Trash2 size={10} /> Quitar
                      </button>
                    )}
                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center bg-gray-50 gap-1">
                    <Upload size={18} className="text-gray-300" />
                    <span className="text-xs text-gray-300 text-center leading-tight">Logo tras<br/>crear</span>
                  </div>
                )}
              </div>
              {/* Fields right of logo */}
              <div className="flex-1 space-y-2.5 min-w-0">
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nombre corto *</label>
                    <input className="input-field" placeholder="APACA" required value={tenantForm.name}
                      onChange={(e) => { const name = e.target.value; setTenantForm((prev) => ({ ...prev, name, slug: editingTenant ? prev.slug : toSlug(name) })); }} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo</label>
                    <input className="input-field" placeholder="Asociación de Productores Avícolas de Castilla" value={tenantForm.nombre_completo} onChange={(e) => setTenantForm({ ...tenantForm, nombre_completo: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">CIF</label>
                    <input className="input-field font-mono" placeholder="G12345678" value={tenantForm.cif} onChange={(e) => setTenantForm({ ...tenantForm, cif: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email de contacto</label>
                    <input className="input-field" type="email" placeholder="info@asociacion.es" value={tenantForm.email_asociacion} onChange={(e) => setTenantForm({ ...tenantForm, email_asociacion: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Color primario</label>
                    <div className="flex gap-1.5 items-center">
                      <input type="color" className="w-8 h-8 rounded cursor-pointer border border-gray-200 p-0.5" value={tenantForm.primary_color} onChange={(e) => setTenantForm({ ...tenantForm, primary_color: e.target.value })} />
                      <input className="input-field font-mono text-xs" value={tenantForm.primary_color} onChange={(e) => setTenantForm({ ...tenantForm, primary_color: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Color secundario</label>
                    <div className="flex gap-1.5 items-center">
                      <input type="color" className="w-8 h-8 rounded cursor-pointer border border-gray-200 p-0.5" value={tenantForm.secondary_color} onChange={(e) => setTenantForm({ ...tenantForm, secondary_color: e.target.value })} />
                      <input className="input-field font-mono text-xs" value={tenantForm.secondary_color} onChange={(e) => setTenantForm({ ...tenantForm, secondary_color: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Límite socios <span className="font-normal text-gray-400">(0 = ∞)</span></label>
                    <input className="input-field" type="number" min="0" value={tenantForm.max_socios} onChange={(e) => setTenantForm({ ...tenantForm, max_socios: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="space-y-3 pt-0.5">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                      <input type="checkbox" checked={tenantForm.is_active} onChange={(e) => setTenantForm({ ...tenantForm, is_active: e.target.checked })} className="rounded" />
                      Asociación activa
                    </label>
                    {editingTenant && (
                      <span className="text-xs text-gray-400 ml-auto font-mono">slug: {tenantForm.slug}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── SEDE ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
              <div className="w-1 h-4 bg-blue-400 rounded-full shrink-0" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><MapPin size={11} /> Sede</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Domicilio</label>
              <input className="input-field" placeholder="Calle Mayor, 1" value={tenantForm.domicilio} onChange={(e) => setTenantForm({ ...tenantForm, domicilio: e.target.value })} />
            </div>
            <div className="grid grid-cols-4 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cód. postal</label>
                <input className="input-field font-mono" placeholder="28001" value={tenantForm.cod_postal} onChange={(e) => setTenantForm({ ...tenantForm, cod_postal: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Municipio</label>
                <input className="input-field" placeholder="Madrid" value={tenantForm.municipio} onChange={(e) => setTenantForm({ ...tenantForm, municipio: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Provincia</label>
                <input className="input-field" placeholder="Madrid" value={tenantForm.provincia} onChange={(e) => setTenantForm({ ...tenantForm, provincia: e.target.value })} />
              </div>
            </div>
          </div>

          {/* ── DATOS DE CONTACTO ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
              <div className="w-1 h-4 bg-green-400 rounded-full shrink-0" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><Phone size={11} /> Datos de contacto</span>
            </div>
            {[
              { label: "Contacto 1", nombre: "telefono1_nombre", cargo: "telefono1_cargo", tel: "telefono1", email: "telefono1_email",
                vNombre: tenantForm.telefono1_nombre, vCargo: tenantForm.telefono1_cargo, vTel: tenantForm.telefono1, vEmail: tenantForm.telefono1_email },
              { label: "Contacto 2", nombre: "telefono2_nombre", cargo: "telefono2_cargo", tel: "telefono2", email: "telefono2_email",
                vNombre: tenantForm.telefono2_nombre, vCargo: tenantForm.telefono2_cargo, vTel: tenantForm.telefono2, vEmail: tenantForm.telefono2_email },
            ].map(({ label, nombre, cargo, tel, email, vNombre, vCargo, vTel, vEmail }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-3 space-y-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                    <input className="input-field" placeholder="Juan García" value={vNombre} onChange={(e) => setTenantForm({ ...tenantForm, [nombre]: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Cargo</label>
                    <input className="input-field" placeholder="Presidente" value={vCargo} onChange={(e) => setTenantForm({ ...tenantForm, [cargo]: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1"><Phone size={9} /> Teléfono</label>
                    <input className="input-field" placeholder="+34 600 000 000" value={vTel} onChange={(e) => setTenantForm({ ...tenantForm, [tel]: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1"><AtSign size={9} /> Email</label>
                    <input className="input-field" type="email" placeholder="contacto@asoc.es" value={vEmail} onChange={(e) => setTenantForm({ ...tenantForm, [email]: e.target.value })} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── TAMAÑOS DE ANILLA ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
              <div className="w-1 h-4 bg-amber-400 rounded-full shrink-0" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><Tag size={11} /> Tamaños de anilla</span>
            </div>
            <p className="text-xs text-gray-400">Diámetros disponibles y sexo asociado para esta asociación.</p>
            <div className="space-y-2">
              {tenantForm.anilla_sizes.length > 0 && (
                <div className="grid grid-cols-[90px_130px_32px] gap-2 px-1">
                  <span className="text-xs text-gray-400 font-medium">Diámetro (mm)</span>
                  <span className="text-xs text-gray-400 font-medium">Sexo</span>
                </div>
              )}
              {tenantForm.anilla_sizes.map((sz, idx) => (
                <div key={idx} className="grid grid-cols-[90px_130px_32px] gap-2 items-center">
                  <input className="input-field text-sm font-mono" placeholder="18" value={sz.mm}
                    onChange={(e) => { const s = [...tenantForm.anilla_sizes]; s[idx] = { ...s[idx], mm: e.target.value }; setTenantForm({ ...tenantForm, anilla_sizes: s }); }} />
                  <select className="input-field text-sm" value={sz.sexo ?? ""}
                    onChange={(e) => { const s = [...tenantForm.anilla_sizes]; s[idx] = { ...s[idx], sexo: e.target.value as "M" | "H" | "" }; setTenantForm({ ...tenantForm, anilla_sizes: s }); }}>
                    <option value="">Sin asignar</option>
                    <option value="M">♂ Macho</option>
                    <option value="H">♀ Hembra</option>
                  </select>
                  <button type="button" className="btn-ghost p-1.5 text-red-400 hover:text-red-600"
                    onClick={() => setTenantForm({ ...tenantForm, anilla_sizes: tenantForm.anilla_sizes.filter((_, i) => i !== idx) })}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button type="button" className="btn-ghost text-xs gap-1 flex items-center"
                onClick={() => setTenantForm({ ...tenantForm, anilla_sizes: [...tenantForm.anilla_sizes, { mm: "", sexo: "" }] })}>
                <Plus size={12} /> Añadir tamaño
              </button>
            </div>
          </div>

          {/* ── SMTP ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
              <div className="w-1 h-4 bg-gray-400 rounded-full shrink-0" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><Mail size={11} /> SMTP de la asociación</span>
              <span className="text-xs text-gray-400">— para enviar emails a sus socios</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Servidor SMTP</label>
                <input className="input-field" placeholder="smtp.gmail.com" value={tenantForm.smtp_host} onChange={(e) => setTenantForm({ ...tenantForm, smtp_host: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Puerto</label>
                <input className="input-field" type="number" placeholder="587" value={tenantForm.smtp_port} onChange={(e) => setTenantForm({ ...tenantForm, smtp_port: parseInt(e.target.value) || 587 })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Usuario</label>
                <input className="input-field" placeholder="user@gmail.com" value={tenantForm.smtp_user} onChange={(e) => setTenantForm({ ...tenantForm, smtp_user: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña</label>
                <input className="input-field" type="password" value={tenantForm.smtp_password} onChange={(e) => setTenantForm({ ...tenantForm, smtp_password: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email remitente</label>
                <input className="input-field" type="email" placeholder="noreply@asociacion.es" value={tenantForm.smtp_from_email} onChange={(e) => setTenantForm({ ...tenantForm, smtp_from_email: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre remitente</label>
                <input className="input-field" placeholder="Asociación APACA (opcional, nombre visible)" value={tenantForm.smtp_from_name} onChange={(e) => setTenantForm({ ...tenantForm, smtp_from_name: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
                <input type="checkbox" checked={tenantForm.smtp_use_tls} onChange={(e) => setTenantForm({ ...tenantForm, smtp_use_tls: e.target.checked, smtp_use_ssl: e.target.checked ? false : tenantForm.smtp_use_ssl })} className="rounded" />
                STARTTLS
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
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
                    <span className={`text-xs font-medium flex items-center gap-1 ${tenantSmtpTestResult.startsWith("✓") ? "text-green-600" : "text-red-600"}`}>
                      {tenantSmtpTestResult.startsWith("✓") ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                      {tenantSmtpTestResult.slice(2)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── OPCIONES / VERTICALES ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
              <div className="w-1 h-4 bg-purple-400 rounded-full shrink-0" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><Settings2 size={11} /> Opciones / Verticales</span>
              <span className="text-xs text-gray-400">— módulos disponibles para esta asociación</span>
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={tenantForm.granjas_enabled} onChange={(e) => setTenantForm({ ...tenantForm, granjas_enabled: e.target.checked })} className="rounded" />
                Módulo Granjas
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={tenantForm.importaciones_enabled} onChange={(e) => setTenantForm({ ...tenantForm, importaciones_enabled: e.target.checked })} className="rounded" />
                Módulo Importaciones
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={tenantForm.auditorias_enabled} onChange={(e) => setTenantForm({ ...tenantForm, auditorias_enabled: e.target.checked })} className="rounded" />
                Módulo Auditorías
              </label>
            </div>
          </div>

          {/* ── USUARIO ADMIN INICIAL (solo creación) ── */}
          {!editingTenant && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
                <div className="w-1 h-4 bg-indigo-400 rounded-full shrink-0" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><UserPlus size={11} /> Usuario admin inicial</span>
                <span className="text-xs text-gray-400">— opcional</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input className="input-field" type="email" value={newUserForm.email} onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña</label>
                  <input className="input-field" type="password" value={newUserForm.password} onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
                  <input className="input-field" value={newUserForm.first_name} onChange={(e) => setNewUserForm({ ...newUserForm, first_name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Apellidos</label>
                  <input className="input-field" value={newUserForm.last_name} onChange={(e) => setNewUserForm({ ...newUserForm, last_name: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button type="button" className="btn-ghost" onClick={closeTenantModal}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={tenantSaving}>
              {tenantSaving ? <Loader2 size={14} className="animate-spin" /> : (editingTenant ? "Guardar cambios" : "Crear asociación")}
            </button>
          </div>
        </form>
      </Modal>}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Configurar plantilla de auditorías para un tenant
      ══════════════════════════════════════════════════════════════════════ */}
      {!!auditConfigTenant && (
        <AuditConfigModal
          tenant={auditConfigTenant}
          onClose={() => setAuditConfigTenant(null)}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Eliminar asociación
      ══════════════════════════════════════════════════════════════════════ */}
      {!!deleteModalTenant && <Modal onClose={() => { setDeleteModalTenant(null); setDeleteTenantPassword(""); setDeleteTenantPasswordError(""); }} title="Eliminar asociación">
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">
              Se eliminará definitivamente <strong>{deleteModalTenant.name}</strong> y todos sus datos. Esta acción es irreversible.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirma con tu contraseña</label>
            <input
              type="password"
              className="input-field"
              placeholder="Contraseña"
              value={deleteTenantPassword}
              onChange={(e) => { setDeleteTenantPassword(e.target.value); setDeleteTenantPasswordError(""); }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && deleteTenantPassword)
                  deleteTenantMutation.mutate({ id: deleteModalTenant.id, password: deleteTenantPassword });
              }}
            />
            {deleteTenantPasswordError && <p className="text-xs text-red-600 mt-1">{deleteTenantPasswordError}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => { setDeleteModalTenant(null); setDeleteTenantPassword(""); setDeleteTenantPasswordError(""); }}>Cancelar</button>
            <button
              className="btn-danger"
              disabled={!deleteTenantPassword || deleteTenantMutation.isPending}
              onClick={() => deleteTenantMutation.mutate({ id: deleteModalTenant.id, password: deleteTenantPassword })}
            >
              {deleteTenantMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Eliminar definitivamente"}
            </button>
          </div>
        </div>
      </Modal>}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Usuarios de gestión de un tenant
      ══════════════════════════════════════════════════════════════════════ */}
      {!!usersModalTenant && <Modal onClose={() => { setUsersModalTenant(null); setAddingUser(false); setEditingUser(null); setDeleteUserId(null); clearUserError(); }} title={`Usuarios admin — ${usersModalTenant?.name}`} maxWidth="max-w-2xl">
        <div className="space-y-4">
          <ErrorAlert message={userError} onDismiss={clearUserError} />

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
                          <button className="btn-ghost p-1" title="Editar / cambiar contraseña" onClick={() => { setEditingUser(u); setAddingUser(false); setEditUserForm({ email: u.email, first_name: u.first_name, last_name: u.last_name, password: "", notif_nueva_asociacion: false, notif_asociacion_suspendida: false, notif_asociacion_activada: false, notif_asociacion_eliminada: false, notif_propuesta_mejora: false, notif_health_check: false }); }}>
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
          <ErrorAlert message={saError} onDismiss={clearSaError} />
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
          {/* Notificaciones por email */}
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <p className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1.5">
              <Mail size={13} />
              Notificaciones por email
            </p>
            <div className="space-y-2">
              {([
                { key: "notif_nueva_asociacion",      label: "Alta de nueva asociación" },
                { key: "notif_asociacion_suspendida", label: "Asociación suspendida" },
                { key: "notif_asociacion_activada",   label: "Asociación reactivada" },
                { key: "notif_asociacion_eliminada",  label: "Asociación eliminada" },
                { key: "notif_propuesta_mejora",      label: "Propuestas de mejora" },
              ] as { key: keyof typeof saForm; label: string }[]).map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saForm[key] as boolean}
                    onChange={(e) => setSaForm({ ...saForm, [key]: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
              {/* Informe de estado: checkbox + botón enviar ahora */}
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saForm.notif_health_check}
                    onChange={(e) => setSaForm({ ...saForm, notif_health_check: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Informe de estado (7:30 y 19:30)</span>
                </label>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded px-2 py-1 transition-colors shrink-0"
                  title="Enviar informe ahora"
                  disabled={runHealthCheckMutation.isPending}
                  onClick={() => { setHealthCheckResults(null); runHealthCheckMutation.mutate(); }}
                >
                  {runHealthCheckMutation.isPending
                    ? <Loader2 size={12} className="animate-spin" />
                    : <RefreshCw size={12} />}
                  Enviar ahora
                </button>
              </div>
              {healthCheckResults && (
                <div className="mt-1 rounded-lg border border-gray-200 bg-white p-2 space-y-0.5">
                  {healthCheckResults.map((line, i) => (
                    <p key={i} className="text-xs font-mono text-gray-700">{line}</p>
                  ))}
                </div>
              )}
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
            <p className="text-sm text-gray-500">Operaciones por asociación — selecciona la asociación y ejecuta la acción</p>
          </div>

          {loadingTenants ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => <div key={i} className="card h-44 animate-pulse bg-gray-50" />)}
            </div>
          ) : !tenants.length ? (
            <p className="text-center text-gray-400 py-10">No hay asociaciones registradas.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

              {/* ── Plantillas de Auditoría ─────────────────────────────────── */}
              <div className="card flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <ClipboardCheck size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">Plantillas de Auditoría</p>
                    <p className="text-xs text-gray-500 mt-0.5">Configura criterios de evaluación y preguntas de instalación.</p>
                  </div>
                </div>
                <select
                  className="input-field text-sm"
                  value={advancedTenant["auditoria"] ?? ""}
                  onChange={(e) => setAdvancedTenant(p => ({ ...p, auditoria: e.target.value }))}
                >
                  <option value="">— Seleccionar asociación —</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <button
                  className="btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                  disabled={!advancedTenant["auditoria"]}
                  onClick={() => {
                    const t = tenants.find(t => t.id === advancedTenant["auditoria"]);
                    if (t) setAuditConfigTenant(t);
                  }}
                >
                  <ClipboardCheck size={14} /> Configurar plantilla
                </button>
              </div>

              {/* ── Eliminar Socios ──────────────────────────────────────────── */}
              <div className="card flex flex-col gap-3 border-red-100">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                    <Users size={18} className="text-red-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">Eliminar Socios</p>
                    <p className="text-xs text-gray-500 mt-0.5">Elimina <strong>todos</strong> los socios, animales y datos de la asociación.</p>
                  </div>
                </div>
                <select
                  className="input-field text-sm"
                  value={advancedTenant["socios"] ?? ""}
                  onChange={(e) => setAdvancedTenant(p => ({ ...p, socios: e.target.value }))}
                >
                  <option value="">— Seleccionar asociación —</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.name}{t.socios_count != null ? ` (${t.socios_count} socios)` : ""}</option>
                  ))}
                </select>
                <button
                  className="btn-danger text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                  disabled={!advancedTenant["socios"]}
                  onClick={() => {
                    const t = tenants.find(t => t.id === advancedTenant["socios"]);
                    if (t) { setDeleteSociosTarget({ id: t.id, name: t.name }); setDeleteSociosConfirm(""); }
                  }}
                >
                  <Trash2 size={14} /> Eliminar todos los socios
                </button>
              </div>

              {/* ── Eliminar Animales ────────────────────────────────────────── */}
              <div className="card flex flex-col gap-3 border-red-100">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                    <PawPrint size={18} className="text-red-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">Eliminar Animales</p>
                    <p className="text-xs text-gray-500 mt-0.5">Elimina <strong>todos</strong> los animales y sus evaluaciones. Los socios permanecen.</p>
                  </div>
                </div>
                <select
                  className="input-field text-sm"
                  value={advancedTenant["animales"] ?? ""}
                  onChange={(e) => setAdvancedTenant(p => ({ ...p, animales: e.target.value }))}
                >
                  <option value="">— Seleccionar asociación —</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <button
                  className="btn-danger text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                  disabled={!advancedTenant["animales"]}
                  onClick={() => {
                    const t = tenants.find(t => t.id === advancedTenant["animales"]);
                    if (t) { setDeleteAnimalesTarget({ id: t.id, name: t.name }); setDeleteAnimalesConfirm(""); }
                  }}
                >
                  <Trash2 size={14} /> Eliminar todos los animales
                </button>
              </div>

              {/* ── Eliminar Anillas ─────────────────────────────────────────── */}
              <div className="card flex flex-col gap-3 border-orange-100">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                    <Tag size={18} className="text-orange-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">Eliminar Anillas</p>
                    <p className="text-xs text-gray-500 mt-0.5">Elimina todas las entregas de anillas. Los animales no se ven afectados.</p>
                  </div>
                </div>
                <select
                  className="input-field text-sm"
                  value={advancedTenant["anillas"] ?? ""}
                  onChange={(e) => setAdvancedTenant(p => ({ ...p, anillas: e.target.value }))}
                >
                  <option value="">— Seleccionar asociación —</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <button
                  className="btn-danger text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                  disabled={!advancedTenant["anillas"]}
                  onClick={() => {
                    const t = tenants.find(t => t.id === advancedTenant["anillas"]);
                    if (t) { setDeleteAnillasTarget({ id: t.id, name: t.name }); setDeleteAnillasConfirm(""); }
                  }}
                >
                  <Trash2 size={14} /> Eliminar todas las anillas
                </button>
              </div>

            </div>
          )}
        </>
      )}

      {/* ════════════════ LOG DE ACCESOS ═══════════════════════════════════ */}
      {section === "log" && (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <ScrollText size={22} className="text-indigo-600" /> Log de Accesos
              </h1>
              <p className="text-sm text-gray-500">Registro de todos los inicios de sesión en la plataforma</p>
            </div>
            <button
              onClick={() => { setClearLogModal("access"); setClearLogPassword(""); setClearLogError(""); }}
              className="flex items-center gap-1.5 text-sm border border-red-300 text-red-600 hover:bg-red-50 rounded-lg px-3 py-2 transition-colors shrink-0"
            >
              <Trash2 size={14} /> Eliminar Log
            </button>
          </div>

          {/* Filtros */}
          <div className="card">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Asociación</label>
                <select
                  className="input-field text-sm"
                  value={logTenantFilter}
                  onChange={(e) => { setLogTenantFilter(e.target.value); setLogPage(1); }}
                >
                  <option value="">Todas</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Rol</label>
                <select
                  className="input-field text-sm"
                  value={logRoleFilter}
                  onChange={(e) => { setLogRoleFilter(e.target.value); setLogPage(1); }}
                >
                  <option value="">Todos</option>
                  <option value="superadmin">SuperAdmin</option>
                  <option value="gestion">Gestión</option>
                  <option value="socio">Socio</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Buscar email</label>
                <input
                  type="text"
                  className="input-field text-sm"
                  placeholder="email@..."
                  value={logSearch}
                  onChange={(e) => { setLogSearch(e.target.value); setLogPage(1); }}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Desde</label>
                <input type="date" className="input-field text-sm" value={logDateFrom}
                  onChange={(e) => { setLogDateFrom(e.target.value); setLogPage(1); }} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Hasta</label>
                <input type="date" className="input-field text-sm" value={logDateTo}
                  onChange={(e) => { setLogDateTo(e.target.value); setLogPage(1); }} />
              </div>
            </div>
          </div>

          {/* Tabla */}
          <div className="card overflow-x-auto">
            {loadingLogs ? (
              <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-indigo-600" /></div>
            ) : !logsData?.results.length ? (
              <p className="text-center text-gray-400 py-8">No hay registros con los filtros seleccionados.</p>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                      <th className="text-left py-2 pr-4">Fecha y hora</th>
                      <th className="text-left py-2 pr-4">Email</th>
                      <th className="text-left py-2 pr-4">Rol</th>
                      <th className="text-left py-2 pr-4">Asociación</th>
                      <th className="text-left py-2">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {logsData.results.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="py-2 pr-4 text-gray-600 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Madrid" })}
                        </td>
                        <td className="py-2 pr-4 font-mono text-gray-800">{log.user_email}</td>
                        <td className="py-2 pr-4">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            log.user_role === "superadmin" ? "bg-violet-100 text-violet-700"
                            : log.user_role === "gestion" ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-600"
                          }`}>
                            {log.user_role === "superadmin" ? "SuperAdmin" : log.user_role === "gestion" ? "Gestión" : "Socio"}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-gray-600">{log.tenant_name || "—"}</td>
                        <td className="py-2 text-xs text-gray-400 font-mono">{log.ip_address || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Paginación */}
                {(logsData.count > 50) && (
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-3">
                    <span className="text-xs text-gray-500">{logsData.count} registros en total</span>
                    <div className="flex gap-2">
                      <button
                        disabled={!logsData.previous}
                        onClick={() => setLogPage((p) => p - 1)}
                        className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
                      >Anterior</button>
                      <span className="text-xs text-gray-500 self-center">Pág. {logPage}</span>
                      <button
                        disabled={!logsData.next}
                        onClick={() => setLogPage((p) => p + 1)}
                        className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
                      >Siguiente</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* ════════════════ LOG DE MAIL ════════════════════════════════════ */}
      {section === "mail_log" && (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Mail size={22} className="text-indigo-600" /> Log de Mail
              </h1>
              <p className="text-sm text-gray-500">Historial de todos los correos enviados por la plataforma</p>
            </div>
            <button
              onClick={() => { setClearLogModal("mail"); setClearLogPassword(""); setClearLogError(""); }}
              className="flex items-center gap-1.5 text-sm border border-red-300 text-red-600 hover:bg-red-50 rounded-lg px-3 py-2 transition-colors shrink-0"
            >
              <Trash2 size={14} /> Eliminar Log
            </button>
          </div>

          {/* Filtros */}
          <div className="card">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                <select
                  className="input-field text-sm"
                  value={mailLogTipoFilter}
                  onChange={(e) => { setMailLogTipoFilter(e.target.value); setMailLogPage(1); }}
                >
                  <option value="">Todos</option>
                  <option value="NUEVA_ASOCIACION">Nueva asociación</option>
                  <option value="ALTA_SOCIO">Alta de socio</option>
                  <option value="RESET_PASSWORD">Reset de contraseña</option>
                  <option value="HEALTH_CHECK">Health Check</option>
                  <option value="GENERAL">General</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Estado</label>
                <select
                  className="input-field text-sm"
                  value={mailLogSuccessFilter}
                  onChange={(e) => { setMailLogSuccessFilter(e.target.value); setMailLogPage(1); }}
                >
                  <option value="">Todos</option>
                  <option value="true">Enviado</option>
                  <option value="false">Error</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Buscar asunto / destinatario</label>
                <input
                  type="text"
                  className="input-field text-sm"
                  placeholder="Buscar..."
                  value={mailLogSearch}
                  onChange={(e) => { setMailLogSearch(e.target.value); setMailLogPage(1); }}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Desde</label>
                <input type="date" className="input-field text-sm" value={mailLogDateFrom}
                  onChange={(e) => { setMailLogDateFrom(e.target.value); setMailLogPage(1); }} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Hasta</label>
                <input type="date" className="input-field text-sm" value={mailLogDateTo}
                  onChange={(e) => { setMailLogDateTo(e.target.value); setMailLogPage(1); }} />
              </div>
            </div>
          </div>

          {/* Tabla */}
          <div className="card overflow-x-auto">
            {loadingMailLog ? (
              <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-indigo-600" /></div>
            ) : !mailLogData?.results.length ? (
              <p className="text-center text-gray-400 py-8">No hay registros con los filtros seleccionados.</p>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                      <th className="text-left py-2 pr-4 whitespace-nowrap">Fecha y hora</th>
                      <th className="text-left py-2 pr-4">Tipo</th>
                      <th className="text-left py-2 pr-4">Destinatario/s</th>
                      <th className="text-left py-2 pr-4">Asunto</th>
                      <th className="text-left py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mailLogData.results.map((entry) => (
                      <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-2 pr-4 text-gray-500 whitespace-nowrap text-xs">
                          {new Date(entry.sent_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Madrid" })}
                        </td>
                        <td className="py-2 pr-4">
                          <span className="text-xs bg-indigo-50 text-indigo-700 font-mono px-1.5 py-0.5 rounded">
                            {entry.tipo}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-gray-700 text-xs max-w-[180px] truncate">{entry.destinatarios}</td>
                        <td className="py-2 pr-4 text-gray-700 text-xs max-w-[200px] truncate">{entry.asunto}</td>
                        <td className="py-2">
                          {entry.success ? (
                            <button
                              type="button"
                              className="flex items-center gap-1 text-green-600 text-xs hover:underline"
                              onClick={() => setMailLogDetail({ asunto: entry.asunto, cuerpo: entry.cuerpo, error: entry.error, destinatarios: entry.destinatarios })}
                            >
                              <CheckCircle2 size={13} /> Enviado
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="flex items-center gap-1 text-red-500 text-xs hover:underline"
                              onClick={() => setMailLogDetail({ asunto: entry.asunto, cuerpo: entry.cuerpo, error: entry.error, destinatarios: entry.destinatarios })}
                            >
                              <XCircle size={13} /> Error
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(mailLogData.count > 50) && (
                  <div className="flex items-center justify-between pt-3">
                    <span className="text-xs text-gray-500">{mailLogData.count} registros en total</span>
                    <div className="flex gap-2">
                      <button
                        disabled={!mailLogData.previous}
                        onClick={() => setMailLogPage((p) => p - 1)}
                        className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
                      >Anterior</button>
                      <span className="text-xs text-gray-500 self-center">Pág. {mailLogPage}</span>
                      <button
                        disabled={!mailLogData.next}
                        onClick={() => setMailLogPage((p) => p + 1)}
                        className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
                      >Siguiente</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* ════════════════ COPIAS DE SEGURIDAD ═══════════════════════════════ */}
      {section === "backups" && (
        <>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Archive size={22} className="text-violet-600" /> Copias de Seguridad
            </h1>
            <p className="text-sm text-gray-500">Exporta e importa asociaciones completas (datos + archivos)</p>
          </div>

          {/* ── Importar ── */}
          <div className="card space-y-4">
            <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
              <div className="w-1 h-4 bg-violet-400 rounded-full shrink-0" />
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Upload size={14} /> Importar asociación
              </h2>
            </div>
            <p className="text-sm text-gray-500">
              Sube un archivo <span className="font-mono bg-gray-100 px-1 rounded">.zip</span> generado por KRIA.
              La asociación <strong>no debe existir</strong> en el sistema (ni por UUID ni por slug).
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                ref={backupImportRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setBackupImportFile(f);
                  setBackupImportError("");
                  if (backupImportRef.current) backupImportRef.current.value = "";
                }}
              />
              <button
                type="button"
                className="btn-secondary flex items-center gap-2"
                onClick={() => backupImportRef.current?.click()}
              >
                <FileArchive size={15} />
                {backupImportFile ? backupImportFile.name : "Seleccionar archivo .zip"}
              </button>
              {backupImportFile && (
                <button
                  type="button"
                  className="btn-primary flex items-center gap-2"
                  disabled={importMutation.isPending}
                  onClick={() => importMutation.mutate(backupImportFile)}
                >
                  {importMutation.isPending
                    ? <><Loader2 size={14} className="animate-spin" /> Procesando...</>
                    : <><Upload size={14} /> Importar</>
                  }
                </button>
              )}
            </div>
            {backupImportError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {backupImportError}
              </p>
            )}
          </div>

          {/* ── Historial de trabajos ── */}
          <div className="card">
            <div className="flex items-center justify-between pb-1.5 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-violet-400 rounded-full shrink-0" />
                <h2 className="text-sm font-semibold text-gray-700">Historial de trabajos</h2>
              </div>
              <div className="flex items-center gap-1">
                {backupJobs.some(j => j.status === "COMPLETED" || j.status === "FAILED") && (
                  <button
                    className="btn-ghost p-1.5 text-red-500"
                    title="Limpiar historial"
                    onClick={() => setShowClearBackupJobs(true)}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <button
                  className="btn-ghost p-1.5"
                  title="Actualizar"
                  onClick={() => refetchBackupJobs()}
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>
            {backupJobs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No hay trabajos de backup aún.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase border-b border-gray-100">
                      <th scope="col" className="text-left pb-2 pr-4">Asociación</th>
                      <th scope="col" className="text-left pb-2 pr-4">Tipo</th>
                      <th scope="col" className="text-left pb-2 pr-4">Estado</th>
                      <th scope="col" className="text-left pb-2 pr-4">Fecha</th>
                      <th scope="col" className="text-left pb-2 pr-4">Tamaño</th>
                      <th scope="col" className="text-right pb-2">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {backupJobs.map((job) => (
                      <tr key={job.id} className="hover:bg-gray-50/60">
                        <td className="py-2.5 pr-4">
                          <p className="font-medium text-gray-900">{job.tenant_name_snapshot}</p>
                          <p className="text-xs text-gray-400 font-mono">{job.tenant_slug_snapshot}</p>
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            job.job_type === "EXPORT"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }`}>
                            {job.job_type === "EXPORT" ? "Exportación" : "Importación"}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4">
                          {job.status === "PENDING" && (
                            <span className="flex items-center gap-1 text-xs text-amber-600">
                              <Loader2 size={12} className="animate-spin" /> Pendiente
                            </span>
                          )}
                          {job.status === "RUNNING" && (
                            <span className="flex items-center gap-1 text-xs text-blue-600">
                              <Loader2 size={12} className="animate-spin" /> En proceso
                            </span>
                          )}
                          {job.status === "COMPLETED" && (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle2 size={12} /> Completado
                            </span>
                          )}
                          {job.status === "FAILED" && (
                            <span className="flex items-center gap-1 text-xs text-red-600" title={job.error_message}>
                              <XCircle size={12} /> Error
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(job.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Madrid" })}
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-gray-500">
                          {job.file_size_bytes
                            ? job.file_size_bytes > 1_048_576
                              ? `${(job.file_size_bytes / 1_048_576).toFixed(1)} MB`
                              : `${(job.file_size_bytes / 1024).toFixed(0)} KB`
                            : "—"}
                        </td>
                        <td className="py-2.5 text-right">
                          {job.status === "COMPLETED" && job.job_type === "EXPORT" && (
                            <button
                              className="btn-ghost p-1.5 text-blue-600"
                              title="Descargar backup"
                              onClick={() => handleBackupDownload(job)}
                            >
                              <Download size={14} />
                            </button>
                          )}
                          {job.status === "COMPLETED" && job.job_type === "IMPORT" && (
                            <span className="text-xs text-gray-400">
                              {Object.values(job.result_summary).reduce((a, b) => a + b, 0)} objetos
                            </span>
                          )}
                          {job.status === "FAILED" && (
                            <span className="text-xs text-red-500 truncate max-w-[150px] block text-right" title={job.error_message}>
                              {job.error_message.slice(0, 60)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Modal limpiar historial ── */}
          {showClearBackupJobs && (
            <Modal onClose={() => setShowClearBackupJobs(false)} title="Limpiar historial de backups">
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Se eliminarán todos los trabajos <strong>completados</strong> y <strong>fallidos</strong> del historial.
                  Los trabajos en curso no se verán afectados.
                </p>
                <div className="flex justify-end gap-2">
                  <button className="btn-secondary" onClick={() => setShowClearBackupJobs(false)}>
                    Cancelar
                  </button>
                  <button
                    className="btn-danger flex items-center gap-2"
                    disabled={clearBackupJobsMutation.isPending}
                    onClick={() => clearBackupJobsMutation.mutate()}
                  >
                    {clearBackupJobsMutation.isPending
                      ? <><Loader2 size={14} className="animate-spin" /> Limpiando...</>
                      : <><Trash2 size={14} /> Limpiar historial</>
                    }
                  </button>
                </div>
              </div>
            </Modal>
          )}
        </>
      )}

      {/* ── Modal confirmación eliminar anillas ─────────────────────────── */}
      {deleteAnillasTarget && (
        <Modal onClose={() => setDeleteAnillasTarget(null)} title="Eliminar todas las anillas">
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-lg p-3">
              <AlertTriangle size={18} className="text-orange-600 shrink-0 mt-0.5" />
              <div className="text-sm text-orange-800">
                <p className="font-semibold mb-1">Acción irreversible</p>
                <p>Se eliminarán <strong>todas las entregas de anillas</strong> de <strong>{deleteAnillasTarget.name}</strong>. Los animales y socios no se verán afectados.</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Escribe el nombre de la asociación para confirmar:
              </label>
              <p className="text-xs font-mono bg-gray-100 rounded px-2 py-1 mb-2 select-all">{deleteAnillasTarget.name}</p>
              <input
                className="input-field"
                placeholder={deleteAnillasTarget.name}
                value={deleteAnillasConfirm}
                onChange={e => setDeleteAnillasConfirm(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button className="btn-secondary flex-1" onClick={() => setDeleteAnillasTarget(null)}>Cancelar</button>
              <button
                className="btn-danger flex-1"
                disabled={deleteAnillasConfirm !== deleteAnillasTarget.name || deleteAnillasMutation.isPending}
                onClick={() => deleteAnillasMutation.mutate(deleteAnillasTarget.id)}
              >
                {deleteAnillasMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Confirmar eliminación"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal confirmación eliminar animales ─────────────────────────── */}
      {deleteAnimalesTarget && (
        <Modal onClose={() => setDeleteAnimalesTarget(null)} title="Eliminar todos los animales">
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">
                <p className="font-semibold mb-1">Acción irreversible</p>
                <p>Se eliminarán <strong>todos los animales y sus evaluaciones</strong> de <strong>{deleteAnimalesTarget.name}</strong>. Los socios y usuarios permanecerán.</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Escribe el nombre de la asociación para confirmar:
              </label>
              <p className="text-xs font-mono bg-gray-100 rounded px-2 py-1 mb-2 select-all">{deleteAnimalesTarget.name}</p>
              <input
                className="input-field"
                placeholder={deleteAnimalesTarget.name}
                value={deleteAnimalesConfirm}
                onChange={e => setDeleteAnimalesConfirm(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button className="btn-secondary flex-1" onClick={() => setDeleteAnimalesTarget(null)}>Cancelar</button>
              <button
                className="btn-danger flex-1"
                disabled={deleteAnimalesConfirm !== deleteAnimalesTarget.name || deleteAnimalesMutation.isPending}
                onClick={() => deleteAnimalesMutation.mutate(deleteAnimalesTarget.id)}
              >
                {deleteAnimalesMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Eliminar todos los animales"}
              </button>
            </div>
          </div>
        </Modal>
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
      {/* ── Modal: limpiar log con contraseña ─────────────────────────── */}
      {mailLogDetail && (
        <Modal onClose={() => setMailLogDetail(null)} title="Detalle del correo">
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Asunto</p>
              <p className="font-medium text-gray-800">{mailLogDetail.asunto}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Destinatarios</p>
              <p className="text-gray-700">{mailLogDetail.destinatarios}</p>
            </div>
            {mailLogDetail.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-medium text-red-700 mb-1">Error de envío</p>
                <p className="text-xs font-mono text-red-800 whitespace-pre-wrap">{mailLogDetail.error}</p>
              </div>
            )}
            {mailLogDetail.cuerpo && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Contenido</p>
                <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 whitespace-pre-wrap font-mono text-gray-700 max-h-72 overflow-y-auto">{mailLogDetail.cuerpo}</pre>
              </div>
            )}
          </div>
        </Modal>
      )}

      {clearLogModal && (
        <Modal
          onClose={() => { setClearLogModal(null); setClearLogPassword(""); setClearLogError(""); }}
          title={clearLogModal === "access" ? "Limpiar Log de Accesos" : "Limpiar Log de Mail"}
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">
                Se eliminarán <strong>todos los registros</strong> del {clearLogModal === "access" ? "log de accesos" : "log de mail"}. Esta acción no se puede deshacer.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirma con tu contraseña</label>
              <input
                type="password"
                className="input-field"
                placeholder="Contraseña"
                value={clearLogPassword}
                onChange={(e) => { setClearLogPassword(e.target.value); setClearLogError(""); }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && clearLogPassword) {
                    clearLogModal === "access"
                      ? clearAccessLogMutation.mutate(clearLogPassword)
                      : clearMailLogMutation.mutate(clearLogPassword);
                  }
                }}
              />
              {clearLogError && <p className="text-xs text-red-600 mt-1">{clearLogError}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => { setClearLogModal(null); setClearLogPassword(""); setClearLogError(""); }}>Cancelar</button>
              <button
                className="btn-danger"
                disabled={!clearLogPassword || clearAccessLogMutation.isPending || clearMailLogMutation.isPending}
                onClick={() => clearLogModal === "access"
                  ? clearAccessLogMutation.mutate(clearLogPassword)
                  : clearMailLogMutation.mutate(clearLogPassword)
                }
              >
                {(clearAccessLogMutation.isPending || clearMailLogMutation.isPending)
                  ? <Loader2 size={14} className="animate-spin" />
                  : "Eliminar todos los registros"
                }
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── AuditConfigModal ──────────────────────────────────────────────────────────

function AuditConfigModal({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"criterios" | "preguntas">("criterios");

  // ── Criterios ──────────────────────────────────────────────────────────────
  const { data: criterios = [], isLoading: loadCrit, isError: critError } = useQuery({
    queryKey: ["audit-criterios", tenant.id],
    queryFn: () => superadminApi.auditConfig.listCriterios(tenant.id),
    retry: 1,
  });
  const [newCriterio, setNewCriterio] = useState({ nombre: "", descripcion: "", multiplicador: "1.00", is_active: true, orden: 0 });
  const [showNewCrit, setShowNewCrit] = useState(false);

  const createCrit = useMutation({
    mutationFn: () => superadminApi.auditConfig.createCriterio(tenant.id, { ...newCriterio, orden: criterios.length }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["audit-criterios", tenant.id] }); setShowNewCrit(false); setNewCriterio({ nombre: "", descripcion: "", multiplicador: "1.00", is_active: true, orden: 0 }); },
  });
  const deleteCrit = useMutation({
    mutationFn: (id: string) => superadminApi.auditConfig.deleteCriterio(tenant.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audit-criterios", tenant.id] }),
  });
  const toggleCrit = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      superadminApi.auditConfig.updateCriterio(tenant.id, id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audit-criterios", tenant.id] }),
  });

  const maxScore = criterios
    .filter(c => c.is_active)
    .reduce((sum, c) => sum + parseFloat(c.multiplicador) * 10, 0);

  // ── Preguntas ──────────────────────────────────────────────────────────────
  const { data: preguntas = [], isLoading: loadPregunta, isError: preguntaError } = useQuery({
    queryKey: ["audit-preguntas", tenant.id],
    queryFn: () => superadminApi.auditConfig.listPreguntas(tenant.id),
    retry: 1,
  });
  const [newPregunta, setNewPregunta] = useState<Omit<PreguntaInstalacion, "id">>({ texto: "", tipo: "SINO", is_active: true, orden: 0 });
  const [showNewPregunta, setShowNewPregunta] = useState(false);

  const createPregunta = useMutation({
    mutationFn: () => superadminApi.auditConfig.createPregunta(tenant.id, { ...newPregunta, orden: preguntas.length }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["audit-preguntas", tenant.id] }); setShowNewPregunta(false); setNewPregunta({ texto: "", tipo: "SINO", is_active: true, orden: 0 }); },
  });
  const deletePregunta = useMutation({
    mutationFn: (id: string) => superadminApi.auditConfig.deletePregunta(tenant.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audit-preguntas", tenant.id] }),
  });
  const togglePregunta = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      superadminApi.auditConfig.updatePregunta(tenant.id, id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audit-preguntas", tenant.id] }),
  });

  return (
    <Modal onClose={onClose} title={`Plantilla de Auditorías — ${tenant.name}`} maxWidth="max-w-2xl">
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {(["criterios", "preguntas"] as const).map(tabKey => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setTab(tabKey)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors min-h-0 ${
                tab === tabKey
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tabKey === "criterios" ? "Criterios de Evaluación" : "Preguntas de Instalaciones"}
            </button>
          ))}
        </div>

        {/* ── Criterios ── */}
        {tab === "criterios" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Cada criterio: puntuación 0–10 × multiplicador.
                Puntuación máxima posible: <strong>{maxScore.toFixed(1)}</strong>
                {Math.abs(maxScore - 100) > 0.1 && (
                  <span className="text-amber-600 ml-1">(recomendado: 100)</span>
                )}
              </p>
              <button type="button" onClick={() => setShowNewCrit(true)} className="btn-secondary text-xs flex items-center gap-1 min-h-0 py-1.5 px-2.5">
                <Plus size={12} /> Añadir
              </button>
            </div>

            {critError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                Error al cargar los criterios. Comprueba la consola del navegador.
              </div>
            )}
            {loadCrit ? <div className="h-20 bg-gray-100 rounded animate-pulse" /> : (
              <div className="space-y-2">
                {criterios.map(c => (
                  <div key={c.id} className={`flex items-center gap-3 p-2.5 rounded-lg border ${c.is_active ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"}`}>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm text-gray-900">{c.nombre}</span>
                      {c.descripcion && <p className="text-xs text-gray-500 truncate">{c.descripcion}</p>}
                    </div>
                    <div className="text-xs text-gray-500 shrink-0">
                      ×{c.multiplicador} → max <strong>{(parseFloat(c.multiplicador) * 10).toFixed(1)}</strong> pts
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleCrit.mutate({ id: c.id, is_active: !c.is_active })}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors min-h-0 ${c.is_active ? "border-green-300 text-green-700 hover:bg-green-50" : "border-gray-300 text-gray-500 hover:bg-gray-100"}`}
                    >
                      {c.is_active ? "Activo" : "Inactivo"}
                    </button>
                    <button type="button" onClick={() => deleteCrit.mutate(c.id)} className="text-red-400 hover:text-red-600 min-h-0 p-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {criterios.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">Sin criterios configurados</p>
                )}
              </div>
            )}

            {showNewCrit && (
              <div className="border border-blue-200 bg-blue-50 rounded-xl p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="label text-xs">Nombre *</label>
                    <input
                      className="input-field text-sm"
                      placeholder="Ej: Conformación general"
                      value={newCriterio.nombre}
                      onChange={e => setNewCriterio(n => ({ ...n, nombre: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Multiplicador *</label>
                    <input
                      className="input-field text-sm"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={newCriterio.multiplicador}
                      onChange={e => setNewCriterio(n => ({ ...n, multiplicador: e.target.value }))}
                    />
                    <p className="text-xs text-gray-400 mt-0.5">Aporta {(parseFloat(newCriterio.multiplicador || "0") * 10).toFixed(1)} pts al total</p>
                  </div>
                  <div>
                    <label className="label text-xs">Descripción (opcional)</label>
                    <input
                      className="input-field text-sm"
                      value={newCriterio.descripcion}
                      onChange={e => setNewCriterio(n => ({ ...n, descripcion: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setShowNewCrit(false)} className="btn-ghost min-h-0 py-1.5 px-3 text-xs">Cancelar</button>
                  <button
                    type="button"
                    onClick={() => createCrit.mutate()}
                    disabled={!newCriterio.nombre || createCrit.isPending}
                    className="btn-primary text-xs disabled:opacity-50 min-h-0 py-1.5 px-3"
                  >
                    {createCrit.isPending ? <Loader2 size={12} className="animate-spin" /> : "Guardar criterio"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Preguntas ── */}
        {tab === "preguntas" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">{preguntas.length} pregunta{preguntas.length !== 1 ? "s" : ""} configurada{preguntas.length !== 1 ? "s" : ""}</p>
              <button type="button" onClick={() => setShowNewPregunta(true)} className="btn-secondary text-xs flex items-center gap-1 min-h-0 py-1.5 px-2.5">
                <Plus size={12} /> Añadir
              </button>
            </div>

            {preguntaError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                Error al cargar las preguntas. Comprueba la consola del navegador.
              </div>
            )}
            {loadPregunta ? <div className="h-20 bg-gray-100 rounded animate-pulse" /> : (
              <div className="space-y-2">
                {preguntas.map(p => (
                  <div key={p.id} className={`flex items-start gap-3 p-2.5 rounded-lg border ${p.is_active ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{p.texto}</p>
                      <span className="text-xs text-gray-400">
                        {p.tipo === "SINO" ? "Sí/No" : p.tipo === "TEXTO" ? "Texto libre" : "Puntuación 0-10"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => togglePregunta.mutate({ id: p.id, is_active: !p.is_active })}
                      className={`text-xs px-2 py-0.5 rounded border shrink-0 transition-colors min-h-0 ${p.is_active ? "border-green-300 text-green-700 hover:bg-green-50" : "border-gray-300 text-gray-500 hover:bg-gray-100"}`}
                    >
                      {p.is_active ? "Activa" : "Inactiva"}
                    </button>
                    <button type="button" onClick={() => deletePregunta.mutate(p.id)} className="text-red-400 hover:text-red-600 shrink-0 min-h-0 p-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {preguntas.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">Sin preguntas configuradas</p>
                )}
              </div>
            )}

            {showNewPregunta && (
              <div className="border border-blue-200 bg-blue-50 rounded-xl p-3 space-y-2">
                <div>
                  <label className="label text-xs">Texto de la pregunta *</label>
                  <input
                    className="input-field text-sm"
                    placeholder="Ej: ¿Las instalaciones disponen de luz natural?"
                    value={newPregunta.texto}
                    onChange={e => setNewPregunta(n => ({ ...n, texto: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label text-xs">Tipo de respuesta</label>
                  <select
                    className="input-field text-sm"
                    value={newPregunta.tipo}
                    onChange={e => setNewPregunta(n => ({ ...n, tipo: e.target.value as PreguntaInstalacion["tipo"] }))}
                  >
                    <option value="SINO">Sí / No</option>
                    <option value="TEXTO">Texto libre</option>
                    <option value="PUNTUACION">Puntuación (0–10)</option>
                  </select>
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setShowNewPregunta(false)} className="btn-ghost min-h-0 py-1.5 px-3 text-xs">Cancelar</button>
                  <button
                    type="button"
                    onClick={() => createPregunta.mutate()}
                    disabled={!newPregunta.texto || createPregunta.isPending}
                    className="btn-primary text-xs disabled:opacity-50 min-h-0 py-1.5 px-3"
                  >
                    {createPregunta.isPending ? <Loader2 size={12} className="animate-spin" /> : "Guardar pregunta"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end border-t border-gray-100 pt-3">
          <button type="button" onClick={onClose} className="btn-secondary text-sm min-h-0 py-2 px-4">Cerrar</button>
        </div>
      </div>
    </Modal>
  );
}
