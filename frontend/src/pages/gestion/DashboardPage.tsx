import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import { CheckSquare, AlertTriangle, Upload, TrendingUp } from "lucide-react";
import type { DashboardStats } from "../../types";

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const { data } = await apiClient.get("/dashboard/tareas-pendientes/");
      return data;
    },
    refetchInterval: 30000, // refresh every 30s
  });

  const tiles = [
    {
      label: "Pendientes de Aprobación",
      value: stats?.pendientes_aprobacion ?? 0,
      icon: <CheckSquare size={24} />,
      color: "bg-blue-700",
      href: "/validaciones",
    },
    {
      label: "Conflictos Pendientes",
      value: stats?.conflictos_pendientes ?? 0,
      icon: <AlertTriangle size={24} />,
      color: "bg-amber-500",
      href: "/conflictos",
    },
    {
      label: "Imports en Proceso",
      value: stats?.imports_pendientes ?? 0,
      icon: <Upload size={24} />,
      color: "bg-green-700",
      href: "/importar",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard Gestión</h1>
        <p className="text-sm text-gray-500">Resumen de tareas pendientes</p>
      </div>

      {/* Stats tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {tiles.map((tile) => (
          <Link key={tile.label} to={tile.href} className="card hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className={`${tile.color} text-white p-3 rounded-xl`}>
                {tile.icon}
              </div>
              <div>
                {isLoading ? (
                  <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
                ) : (
                  <div className="text-3xl font-bold text-gray-900">{tile.value}</div>
                )}
                <div className="text-sm text-gray-500">{tile.label}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Acciones Rápidas</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Link to="/validaciones" className="btn-secondary justify-start gap-2">
            <CheckSquare size={18} /> Validar animales
          </Link>
          <Link to="/conflictos" className="btn-secondary justify-start gap-2">
            <AlertTriangle size={18} /> Resolver conflictos
          </Link>
          <Link to="/importar" className="btn-secondary justify-start gap-2">
            <Upload size={18} /> Importar Excel
          </Link>
          <Link to="/reportes" className="btn-secondary justify-start gap-2">
            <TrendingUp size={18} /> Generar reportes
          </Link>
          <Link to="/socios" className="btn-secondary justify-start gap-2">
            <CheckSquare size={18} /> Gestionar socios
          </Link>
          <Link to="/evaluaciones/nuevo" className="btn-secondary justify-start gap-2">
            <TrendingUp size={18} /> Nueva evaluación
          </Link>
        </div>
      </div>
    </div>
  );
}
