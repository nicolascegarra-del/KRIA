import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import {
  CheckSquare,
  AlertTriangle,
  Upload,
  TrendingUp,
  Bird,
  RefreshCw,
  Bell,
  FolderOpen,
} from "lucide-react";
import type { DashboardStats } from "../../types";

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const { data } = await apiClient.get("/dashboard/tareas-pendientes/");
      return data;
    },
    refetchInterval: 30000,
  });

  const tiles = [
    {
      label: "Pendientes de Aprobación",
      value: stats?.pendientes_aprobacion ?? 0,
      icon: <CheckSquare size={22} />,
      color: "bg-blue-700",
      href: "/validaciones",
    },
    {
      label: "Conflictos Pendientes",
      value: stats?.conflictos_pendientes ?? 0,
      icon: <AlertTriangle size={22} />,
      color: "bg-amber-500",
      href: "/conflictos",
    },
    {
      label: "Candidatos Reproductor",
      value: stats?.candidatos_reproductor ?? 0,
      icon: <Bird size={22} />,
      color: "bg-emerald-600",
      href: "/reproductores/candidatos",
    },
    {
      label: "Solicitudes Re-alta",
      value: stats?.solicitudes_realta ?? 0,
      icon: <RefreshCw size={22} />,
      color: "bg-violet-600",
      href: "/solicitudes-realta",
    },
    {
      label: "Alertas de Anilla",
      value: stats?.alertas_anilla ?? 0,
      icon: <Bell size={22} />,
      color: "bg-rose-600",
      href: "/validaciones",
    },
    {
      label: "Imports en Proceso",
      value: stats?.imports_pendientes ?? 0,
      icon: <Upload size={22} />,
      color: "bg-sky-600",
      href: "/importar",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard Gestión</h1>
        <p className="text-sm text-gray-500">Resumen de tareas pendientes</p>
      </div>

      {/* Stats tiles — 6 contadores */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            to={tile.href}
            className="card hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className={`${tile.color} text-white p-2.5 rounded-xl shrink-0`}>
                {tile.icon}
              </div>
              <div className="min-w-0">
                {isLoading ? (
                  <div className="h-7 w-10 bg-gray-100 rounded animate-pulse mb-1" />
                ) : (
                  <div className="text-2xl font-bold text-gray-900 leading-tight">
                    {tile.value}
                  </div>
                )}
                <div className="text-xs text-gray-500 leading-tight">{tile.label}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Acciones Rápidas</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Link to="/validaciones" className="btn-secondary justify-start gap-2 text-sm">
            <CheckSquare size={16} /> Validar animales
          </Link>
          <Link to="/reproductores/candidatos" className="btn-secondary justify-start gap-2 text-sm">
            <Bird size={16} /> Candidatos reproductor
          </Link>
          <Link to="/solicitudes-realta" className="btn-secondary justify-start gap-2 text-sm">
            <RefreshCw size={16} /> Solicitudes re-alta
          </Link>
          <Link to="/conflictos" className="btn-secondary justify-start gap-2 text-sm">
            <AlertTriangle size={16} /> Resolver conflictos
          </Link>
          <Link to="/documentos" className="btn-secondary justify-start gap-2 text-sm">
            <FolderOpen size={16} /> Gestor documental
          </Link>
          <Link to="/importar" className="btn-secondary justify-start gap-2 text-sm">
            <Upload size={16} /> Importar socios
          </Link>
          <Link to="/reportes" className="btn-secondary justify-start gap-2 text-sm">
            <TrendingUp size={16} /> Generar reportes
          </Link>
          <Link to="/socios" className="btn-secondary justify-start gap-2 text-sm">
            <CheckSquare size={16} /> Gestionar socios
          </Link>
          <Link to="/evaluaciones/nuevo" className="btn-secondary justify-start gap-2 text-sm">
            <TrendingUp size={16} /> Nueva evaluación
          </Link>
        </div>
      </div>
    </div>
  );
}
