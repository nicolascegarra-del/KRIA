import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useTenantStore } from "../store/tenantStore";
import {
  Bird,
  LayoutDashboard,
  Users,
  CheckSquare,
  AlertTriangle,
  Upload,
  FileText,
  Building,
  Building2,
  Layers,
  LogOut,
  Menu,
  X,
  FolderOpen,
  RefreshCw,
  Shield,
  Tag,
  BookOpen,
  User,
} from "lucide-react";
import clsx from "clsx";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  gestionOnly?: boolean;
  socioOnly?: boolean;
  superadminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  // Gestión
  { to: "/dashboard",                label: "Dashboard",             icon: <LayoutDashboard size={18} />, gestionOnly: true },
  { to: "/validaciones",             label: "Validaciones",          icon: <CheckSquare size={18} />,     gestionOnly: true },
  { to: "/reproductores/candidatos", label: "Candidatos Reprod.",    icon: <Bird size={18} />,            gestionOnly: true },
  { to: "/reproductores/catalogo",   label: "Catálogo Reprod.",      icon: <BookOpen size={18} />,        gestionOnly: true },
  { to: "/conflictos",               label: "Conflictos",            icon: <AlertTriangle size={18} />,   gestionOnly: true },
  { to: "/solicitudes-realta",       label: "Re-altas",              icon: <RefreshCw size={18} />,       gestionOnly: true },
  { to: "/socios",                   label: "Socios",                icon: <Users size={18} />,           gestionOnly: true },
  { to: "/granjas",                  label: "Granjas",               icon: <Building2 size={18} />,       gestionOnly: true },
  { to: "/anillas",                  label: "Anillas",               icon: <Tag size={18} />,             gestionOnly: true },
  { to: "/documentos",               label: "Documentos",            icon: <FolderOpen size={18} />,      gestionOnly: true },
  { to: "/importar",                 label: "Importar",              icon: <Upload size={18} />,          gestionOnly: true },
  { to: "/reportes",                 label: "Reportes",              icon: <FileText size={18} />,        gestionOnly: true },
  { to: "/superadmin",               label: "Super Admin",           icon: <Shield size={18} />,          superadminOnly: true },
  // Socio
  { to: "/mis-animales",             label: "Mis Animales",          icon: <Bird size={18} />,            socioOnly: true },
  { to: "/mis-granjas",              label: "Mis Granjas",           icon: <Building size={18} />,        socioOnly: true },
  { to: "/mis-lotes",                label: "Mis Lotes",             icon: <Layers size={18} />,          socioOnly: true },
  { to: "/mis-documentos",           label: "Mis Documentos",        icon: <FolderOpen size={18} />,      socioOnly: true },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, clearAuth } = useAuthStore();
  const { branding } = useTenantStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isGestion = user?.is_gestion ?? false;
  const isSuperadmin = user?.is_superadmin ?? false;

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.superadminOnly && !isSuperadmin) return false;
    if (item.gestionOnly && !isGestion) return false;
    if (item.socioOnly && isGestion) return false;
    return true;
  });

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  const primaryColor = branding?.primary_color ?? "#1565C0";

  return (
    <div className="h-full flex bg-gray-50">
      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
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
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
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
            <div className="font-bold text-sm leading-tight">{branding?.name ?? "AGAMUR"}</div>
            {user?.is_gestion && (
              <div className="text-xs text-white/60">Panel Gestión</div>
            )}
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
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Navegación principal">
          {visibleItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                location.pathname.startsWith(item.to)
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
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

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>
          <span className="font-semibold text-gray-800">{branding?.name ?? "AGAMUR"}</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
