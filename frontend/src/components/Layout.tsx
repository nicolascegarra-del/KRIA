import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useTenantStore } from "../store/tenantStore";
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
  RefreshCw,
  Tag,
  BookOpen,
  User,
  UserX,
  Settings,
  Wrench,
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
}

const NAV_ITEMS: NavItem[] = [
  // Gestión
  { to: "/dashboard",                label: "Dashboard",             icon: <LayoutDashboard size={18} />, gestionOnly: true },
  { to: "/validaciones",             label: "Validaciones",          icon: <CheckSquare size={18} />,     gestionOnly: true },
  { to: "/reproductores/catalogo",   label: "Catálogo Reprod.",      icon: <BookOpen size={18} />,        gestionOnly: true },
  { to: "/solicitudes-realta",       label: "Re-altas",              icon: <RefreshCw size={18} />,       gestionOnly: true },
  { to: "/socios",                   label: "Socios",                icon: <Users size={18} />,           gestionOnly: true },
  { to: "/granjas",                  label: "Granjas",               icon: <Building2 size={18} />,       gestionOnly: true, requiresGranjas: true },
  { to: "/anillas",                  label: "Anillas",               icon: <Tag size={18} />,             gestionOnly: true },
  { to: "/importar",                 label: "Importar",              icon: <Upload size={18} />,          gestionOnly: true },
  { to: "/reportes",                 label: "Reportes",              icon: <FileText size={18} />,        gestionOnly: true },
  // SuperAdmin
  { to: "/superadmin",               label: "Dashboard",             icon: <LayoutDashboard size={18} />, superadminOnly: true, exact: true },
  { to: "/superadmin/asociaciones",  label: "Asociaciones",          icon: <Building size={18} />,        superadminOnly: true },
  { to: "/superadmin/configuracion",        label: "Configuración",          icon: <Settings size={18} />,  superadminOnly: true },
  { to: "/superadmin/gestiones-avanzadas", label: "Gestiones Avanzadas",    icon: <Wrench size={18} />,    superadminOnly: true },
  // Socio
  { to: "/mis-animales",             label: "Mis Animales",          icon: <Bird size={18} />,            socioOnly: true },
  { to: "/mis-granjas",              label: "Mis Granjas",           icon: <Building size={18} />,        socioOnly: true, requiresGranjas: true },
  { to: "/mis-lotes",                label: "Mis Lotes",             icon: <Layers size={18} />,          socioOnly: true },
];

// Bottom nav items for socios (mobile)
const SOCIO_BOTTOM_NAV_BASE = [
  { to: "/mis-animales",  label: "Animales",   icon: (size: number) => <Bird size={size} />,    requiresGranjas: false },
  { to: "/mis-granjas",   label: "Granjas",    icon: (size: number) => <Building size={size} />, requiresGranjas: true },
  { to: "/mis-lotes",     label: "Lotes",      icon: (size: number) => <Layers size={size} />,  requiresGranjas: false },
  { to: "/perfil",        label: "Perfil",     icon: (size: number) => <User size={size} />,    requiresGranjas: false },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, clearAuth, impersonatingTenant, endImpersonation } = useAuthStore();
  const { branding } = useTenantStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isGestion = !!impersonatingTenant || (user?.is_gestion ?? false);
  const isSuperadmin = user?.is_superadmin ?? false;
  const isSocio = !isGestion && !isSuperadmin;

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

  const primaryColor = branding?.primary_color ?? "#1565C0";

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
          {branding?.logo_url ? (
            <img src={branding.logo_url} alt="Logo" className="w-8 h-8 rounded object-cover" />
          ) : (
            <Bird size={24} className="text-white" />
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

        {/* User footer */}
        <div className="px-4 py-4 border-t border-white/20">
          <div className="text-xs text-white/60 truncate mb-0.5">{user?.email}</div>
          <div className="text-sm font-medium text-white truncate mb-3">{user?.full_name}</div>
          <div className="flex gap-2">
            <button
              onClick={() => { navigate("/perfil"); setSidebarOpen(false); }}
              className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors flex-1 min-h-[40px]"
              aria-label="Mi perfil"
            >
              <User size={15} />
              Mi perfil
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors min-h-[40px]"
              aria-label="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
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
        {/* Mobile top bar */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3"
          style={isSocio ? { borderBottomColor: `${primaryColor}30` } : undefined}
        >
          {isSocio ? (
            /* Socios: logo + nombre de la asociación, sin hamburguesa */
            <>
              {branding?.logo_url ? (
                <img src={branding.logo_url} alt="Logo" className="w-7 h-7 rounded object-cover" />
              ) : (
                <Bird size={20} style={{ color: primaryColor }} />
              )}
              <span className="font-semibold text-gray-800 flex-1">{branding?.name ?? "KRIA"}</span>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Cerrar sesión"
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            /* Gestión: hamburguesa normal */
            <>
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Abrir menú"
              >
                <Menu size={20} />
              </button>
              <span className="font-semibold text-gray-800">{branding?.name ?? "KRIA"}</span>
            </>
          )}
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
