import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import { useTenantStore } from "../store/tenantStore";
import { notificacionesApi } from "../api/notificaciones";
import { perfilSocioApi } from "../api/perfilSocio";
import type { Notificacion } from "../types";
import {
  Bird,
  LayoutDashboard,
  Users,
  CheckSquare,
  Upload,
  FileText,
  Building,
  Building2,
  Layers,
  LogOut,
  Menu,
  X,
  Tag,
  BookOpen,
  User,
  UserX,
  Settings,
  Wrench,
  ScrollText,
  Bell,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Star,
  ClipboardCheck,
  AlertCircle,
  Mail,
  Lightbulb,
} from "lucide-react";
import clsx from "clsx";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  gestionOnly?: boolean;
  socioOnly?: boolean;
  superadminOnly?: boolean;
  exact?: boolean;  // usar coincidencia exacta de ruta para el estado activo
  requiresGranjas?: boolean;  // ocultar si granjas_enabled === false
  subtle?: boolean;  // estilo tenue, para items secundarios
}

const NAV_ITEMS: NavItem[] = [
  // Gestión
  { to: "/dashboard",                label: "Dashboard",             icon: <LayoutDashboard size={18} />, gestionOnly: true },
  { to: "/validaciones",             label: "Validaciones",          icon: <CheckSquare size={18} />,     gestionOnly: true },
  { to: "/reproductores/catalogo",   label: "Catálogo Reprod.",      icon: <BookOpen size={18} />,        gestionOnly: true },
{ to: "/socios",                   label: "Socios",                icon: <Users size={18} />,           gestionOnly: true },
  { to: "/granjas",                  label: "Granjas",               icon: <Building2 size={18} />,       gestionOnly: true, requiresGranjas: true },
  { to: "/anillas",                  label: "Anillas",               icon: <Tag size={18} />,             gestionOnly: true },
  { to: "/importar",                 label: "Importar socios",       icon: <Upload size={18} />,          gestionOnly: true },
  { to: "/importar-animales",        label: "Importar animales",     icon: <Upload size={18} />,          gestionOnly: true },
  { to: "/reportes",                 label: "Reportes",              icon: <FileText size={18} />,        gestionOnly: true },
  { to: "/auditorias",              label: "Auditorías",            icon: <ClipboardCheck size={18} />,  gestionOnly: true },
  // SuperAdmin
  { to: "/superadmin",               label: "Dashboard",             icon: <LayoutDashboard size={18} />, superadminOnly: true, exact: true },
  { to: "/superadmin/asociaciones",  label: "Asociaciones",          icon: <Building size={18} />,        superadminOnly: true },
  { to: "/superadmin/configuracion",        label: "Configuración",          icon: <Settings size={18} />,  superadminOnly: true },
  { to: "/superadmin/gestiones-avanzadas", label: "Gestiones Avanzadas",    icon: <Wrench size={18} />,    superadminOnly: true },
  { to: "/superadmin/log",               label: "Log de Accesos",          icon: <ScrollText size={18} />, superadminOnly: true },
  { to: "/superadmin/mail-log",          label: "Log de Mail",             icon: <Mail size={18} />,       superadminOnly: true },
  // Socio
  { to: "/mis-animales",             label: "Mis Animales",          icon: <Bird size={18} />,            socioOnly: true },
  { to: "/mis-granjas",              label: "Mis Granjas",           icon: <Building size={18} />,        socioOnly: true, requiresGranjas: true },
  { to: "/mis-lotes",                label: "Mis Lotes",             icon: <Layers size={18} />,          socioOnly: true },
  { to: "/mis-anillas",              label: "Mis Anillas",           icon: <Tag size={18} />,             socioOnly: true },
  { to: "/mis-auditorias",           label: "Mis Auditorías",        icon: <ClipboardCheck size={18} />,  socioOnly: true },
];

// Bottom nav items for socios (mobile)
const SOCIO_BOTTOM_NAV_BASE = [
  { to: "/mis-animales",  label: "Animales",   icon: (size: number) => <Bird size={size} />,    requiresGranjas: false },
  { to: "/mis-granjas",   label: "Granjas",    icon: (size: number) => <Building size={size} />, requiresGranjas: true },
  { to: "/mis-lotes",     label: "Lotes",      icon: (size: number) => <Layers size={size} />,  requiresGranjas: false },
  { to: "/perfil",        label: "Perfil",     icon: (size: number) => <User size={size} />,    requiresGranjas: false },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Ahora mismo";
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs} h`;
  return `Hace ${Math.floor(hrs / 24)} días`;
}

function NotificationDropdown({
  notifications,
  onClose,
  onNavigate,
  onDelete,
  primaryColor,
  upward = false,
}: {
  notifications: Notificacion[];
  onClose: () => void;
  onNavigate: (animalId: string) => void;
  onDelete: (id: string) => void;
  primaryColor: string;
  upward?: boolean;
}) {
  return (
    <>
      {/* Overlay to close on outside click */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className={clsx(
          "absolute right-0 z-50 w-72 sm:w-80 max-w-[calc(100vw-1rem)] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden",
          upward ? "bottom-full mb-2" : "top-full mt-2"
        )}
      >
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ background: primaryColor }}
        >
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <Bell size={15} />
            Notificaciones
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">
            No hay notificaciones
          </div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={clsx(
                  "flex items-start gap-2 px-4 py-3 transition-colors",
                  n.tipo === "CUOTA_PENDIENTE"
                    ? "bg-amber-50"
                    : !n.leida
                    ? "bg-blue-50/50"
                    : "hover:bg-gray-50"
                )}
              >
                {/* Icon */}
                <div className="mt-0.5 shrink-0">
                  {n.tipo === "CUOTA_PENDIENTE" ? (
                    <AlertCircle size={18} className="text-amber-500" />
                  ) : n.tipo === "ANIMAL_APROBADO" ? (
                    <CheckCircle2 size={18} className="text-green-500" />
                  ) : n.tipo === "REALTA_APROBADA" ? (
                    <RotateCcw size={18} className="text-green-500" />
                  ) : n.tipo === "REPRODUCTOR_APROBADO" ? (
                    <Star size={18} className="text-emerald-500" />
                  ) : n.tipo === "CAMBIO_DATOS_APROBADO" ? (
                    <ClipboardCheck size={18} className="text-sky-500" />
                  ) : n.tipo === "CAMBIO_DATOS_DENEGADO" ? (
                    <ClipboardCheck size={18} className="text-red-400" />
                  ) : (
                    <XCircle size={18} className="text-red-500" />
                  )}
                </div>

                {/* Text (clickable for animals) */}
                <button
                  onClick={() => n.tipo !== "CUOTA_PENDIENTE" && n.animal_id ? onNavigate(n.animal_id) : undefined}
                  className={clsx(
                    "flex-1 min-w-0 text-left",
                    n.tipo !== "CUOTA_PENDIENTE" && n.animal_id ? "cursor-pointer" : "cursor-default"
                  )}
                >
                  <p className={`text-sm ${n.tipo === "CUOTA_PENDIENTE" ? "text-amber-800 font-medium" : !n.leida ? "text-gray-900 font-medium" : "text-gray-700"}`}>
                    {n.mensaje}
                  </p>
                  {n.tipo !== "CUOTA_PENDIENTE" && (
                    <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
                  )}
                </button>

                {/* Dismiss button (only for real DB notifications) */}
                {n.id !== "cuota-pendiente" && (
                  <button
                    onClick={() => onDelete(n.id)}
                    className="shrink-0 p-1 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                    aria-label="Eliminar notificación"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, clearAuth, impersonatingTenant, endImpersonation } = useAuthStore();
  const { branding } = useTenantStore();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  const isGestion = !!impersonatingTenant || (user?.is_gestion ?? false);
  const isSuperadmin = user?.is_superadmin ?? false;
  const isSocio = !isGestion && !isSuperadmin;

  const { data: socioData } = useQuery({
    queryKey: ["socio-me"],
    queryFn: perfilSocioApi.getMe,
    enabled: isSocio,
  });

  // ── Notifications (socios only) ──────────────────────────────────────────
  const { data: notifData } = useQuery({
    queryKey: ["notificaciones"],
    queryFn: notificacionesApi.list,
    enabled: isSocio,
    refetchInterval: 60_000,
  });
  const markReadMutation = useMutation({
    mutationFn: notificacionesApi.marcarLeidas,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificaciones"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: notificacionesApi.eliminar,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificaciones"] }),
  });
  const unreadCount = notifData?.count ?? 0;
  const notifications: Notificacion[] = notifData?.results ?? [];

  const handleBellClick = () => {
    if (!bellOpen && unreadCount > 0) {
      markReadMutation.mutate();
    }
    setBellOpen((v) => !v);
  };

  const handleEndImpersonation = () => {
    endImpersonation();
    navigate("/superadmin");
  };

  const granjasEnabled = branding?.granjas_enabled !== false; // default true when not yet loaded

  const visibleItems = NAV_ITEMS.filter((item) => {
    // Superadmin sin impersonar: solo ve items superadminOnly
    if (isSuperadmin && !impersonatingTenant) {
      return !!item.superadminOnly;
    }
    if (item.superadminOnly) return false;
    if (item.gestionOnly && !isGestion) return false;
    if (item.socioOnly && isGestion) return false;
    if (item.requiresGranjas && !granjasEnabled) return false;
    return true;
  });

  const SOCIO_BOTTOM_NAV = SOCIO_BOTTOM_NAV_BASE.filter(
    (item) => !item.requiresGranjas || granjasEnabled
  );

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  const primaryColor = branding?.primary_color ?? "#051937";

  return (
    <div className="h-full flex bg-gray-50">
      {/* Sidebar overlay (mobile) — solo gestión */}
      {sidebarOpen && !isSocio && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          "fixed lg:static inset-y-0 left-0 z-30 w-64 flex flex-col",
          "text-white transition-transform duration-200",
          // Socios en mobile: sidebar oculto (solo desktop)
          // Gestión en mobile: sidebar como drawer
          isSocio
            ? "-translate-x-full lg:translate-x-0"
            : sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        style={{ background: primaryColor }}
      >
        {/* Logo / Brand */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/20">
          {branding?.logo_url && (!isSuperadmin || impersonatingTenant) ? (
            <img src={branding.logo_url} alt="Logo" className="w-8 h-8 object-contain" style={{ filter: "brightness(0) invert(1)" }} />
          ) : (
            <Bird size={28} className="text-white shrink-0" />
          )}
          <div>
            <div className="font-bold text-sm leading-tight">
              {isSuperadmin && !impersonatingTenant ? "KRIA" : (branding?.name ?? "KRIA")}
            </div>
            {user?.is_superadmin && !impersonatingTenant
              ? <div className="text-xs text-white/60">Super Admin</div>
              : user?.is_gestion && <div className="text-xs text-white/60">Panel Gestión</div>
            }
          </div>
          <button
            className="ml-auto lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto" aria-label="Navegación principal">
          {/* Sección Administración */}
          {visibleItems.some((i) => i.gestionOnly) && (
            <>
              <p className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-white/40 select-none">
                Administración
              </p>
              <div className="space-y-1">
                {visibleItems.filter((i) => i.gestionOnly).map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      item.subtle && !(item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to))
                        ? "text-white/35 hover:bg-white/10 hover:text-white/60"
                        : (item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to))
                          ? "bg-white/20 text-white"
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* Sección Socio */}
          {visibleItems.some((i) => i.socioOnly) && (
            <>
              {visibleItems.some((i) => i.gestionOnly) && (
                <div className="border-t border-white/10 my-3" />
              )}
              <p className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-white/40 select-none">
                Mi cuenta
              </p>
              <div className="space-y-1">
                {visibleItems.filter((i) => i.socioOnly).map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      item.subtle && !(item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to))
                        ? "text-white/35 hover:bg-white/10 hover:text-white/60"
                        : (item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to))
                          ? "bg-white/20 text-white"
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* Sección Super Admin */}
          {visibleItems.some((i) => i.superadminOnly) && (
            <div className="space-y-1">
              {visibleItems.filter((i) => i.superadminOnly).map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    (item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to))
                      ? "bg-white/20 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </nav>

        {/* Propuestas de Mejora — encima del separador */}
        {!(isSuperadmin && !impersonatingTenant) && (
          <div className="px-4 pb-2">
            <Link
              to="/propuestas-mejora"
              onClick={() => setSidebarOpen(false)}
              className={clsx(
                "flex items-center gap-1.5 text-[11px] transition-colors",
                location.pathname === "/propuestas-mejora"
                  ? "text-white/80"
                  : "text-white/30 hover:text-white/60"
              )}
            >
              <Lightbulb size={12} />
              Propuestas de Mejora
            </Link>
          </div>
        )}

        {/* User footer */}
        <div className="px-4 py-4 border-t border-white/20">
          {isSocio && socioData ? (
            <>
              <div className="text-sm font-medium text-white truncate">{socioData.nombre_razon_social}</div>
              <div className="text-xs text-white/60 truncate">{user?.email}</div>
              {socioData.numero_socio && (
                <div className="text-xs text-white/40 mt-0.5">Socio Nº {socioData.numero_socio}</div>
              )}
            </>
          ) : (
            <>
              <div className="text-sm font-medium text-white truncate">{user?.full_name}</div>
              <div className="text-xs text-white/60 truncate">{user?.email}</div>
            </>
          )}
        </div>
      </aside>

      {/* Impersonation banner */}
      {impersonatingTenant && (
        <div className="fixed top-0 inset-x-0 z-50 bg-amber-400 text-amber-900 text-sm font-medium px-4 py-2 flex items-center justify-between gap-3">
          <span>
            Operando como gestor de <strong>{impersonatingTenant.name}</strong>
          </span>
          <button
            onClick={handleEndImpersonation}
            className="flex items-center gap-1.5 text-amber-900 hover:text-amber-700 font-semibold underline"
          >
            <UserX size={15} />
            Salir
          </button>
        </div>
      )}

      {/* Main content */}
      <div className={clsx("flex-1 flex flex-col min-w-0 overflow-hidden", impersonatingTenant && "mt-10")}>
        {/* Top bar — always visible */}
        <header
          className="bg-white border-b border-gray-200 px-4 h-14 flex items-center gap-2 shrink-0"
          style={{ borderBottomColor: `${primaryColor}20` }}
        >
          {/* Left: hamburger (gestión mobile) + logo + name */}
          {!isSocio && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Abrir menú"
            >
              <Menu size={20} />
            </button>
          )}
          {branding?.logo_url && (!isSuperadmin || impersonatingTenant) ? (
            <img src={branding.logo_url} alt="Logo" className="w-7 h-7 object-contain shrink-0" />
          ) : (
            <Bird size={22} className="text-gray-600 shrink-0" />
          )}
          <span className="font-semibold text-gray-800 flex-1 min-w-0 truncate">
            {isSuperadmin && !impersonatingTenant ? "KRIA" : (branding?.name ?? "KRIA")}
          </span>

          {/* Right: bell (socios) + perfil + logout */}
          <div className="flex items-center gap-1 shrink-0">
            {isSocio && (
              <div className="relative">
                <button
                  onClick={handleBellClick}
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center relative"
                  aria-label="Notificaciones"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
                {bellOpen && (
                  <NotificationDropdown
                    notifications={notifications}
                    onClose={() => setBellOpen(false)}
                    onNavigate={(animalId) => { setBellOpen(false); navigate(`/mis-animales/${animalId}`); }}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    primaryColor={primaryColor}
                  />
                )}
              </div>
            )}
            {!(isSuperadmin && !impersonatingTenant) && (
              <button
                onClick={() => { navigate("/perfil"); setSidebarOpen(false); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 min-h-[44px] transition-colors"
                aria-label="Mi perfil"
              >
                <User size={16} />
                <span className="hidden sm:inline">Mi Perfil</span>
              </button>
            )}
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Page content — socios en mobile necesitan padding inferior para la bottom nav */}
        <main className={clsx(
          "flex-1 overflow-y-auto p-4 lg:p-6",
          isSocio && "pb-24 lg:pb-6"
        )}>
          {children}
        </main>
      </div>

      {/* ── Bottom Navigation Bar — socios mobile únicamente ── */}
      {isSocio && (
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 flex"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          aria-label="Navegación principal"
        >
          {SOCIO_BOTTOM_NAV.map((item) => {
            const isActive = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px] transition-colors"
                style={{ color: isActive ? primaryColor : "#9CA3AF" }}
                aria-current={isActive ? "page" : undefined}
              >
                {item.icon(isActive ? 22 : 20)}
                <span className={clsx("text-[10px] font-medium leading-tight", isActive ? "font-semibold" : "")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
