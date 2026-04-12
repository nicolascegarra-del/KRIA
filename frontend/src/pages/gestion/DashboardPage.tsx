import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import {
  CheckSquare, AlertTriangle, Upload, Bird, RefreshCw, Bell,
  Users, Tag, CheckCircle, Clock, XCircle, TrendingUp,
} from "lucide-react";
import type { DashboardStats } from "../../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, color, href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ReactNode;
  color: string;
  href?: string;
}) {
  const inner = (
    <div className="card flex items-start gap-4 hover:shadow-md transition-shadow h-full">
      <div className={`${color} text-white p-3 rounded-2xl shrink-0`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-2xl font-bold text-gray-900 leading-tight">{value}</div>
        <div className="text-xs text-gray-500 mt-0.5">{label}</div>
        {sub && <div className="mt-1">{sub}</div>}
      </div>
    </div>
  );
  return href ? <Link to={href} className="block h-full">{inner}</Link> : <div className="h-full">{inner}</div>;
}

function SkeletonCard() {
  return (
    <div className="card flex items-start gap-4">
      <div className="w-12 h-12 bg-gray-100 rounded-2xl animate-pulse shrink-0" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-7 w-12 bg-gray-100 rounded animate-pulse" />
        <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
      </div>
    </div>
  );
}

function TaskTile({
  label, value, icon, color, href,
}: {
  label: string; value: number; icon: React.ReactNode; color: string; href: string;
}) {
  return (
    <Link to={href} className="card hover:shadow-md transition-shadow flex items-center gap-3">
      <div className={`${color} text-white p-2.5 rounded-xl shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-gray-900 leading-tight">{value}</div>
        <div className="text-xs text-gray-500 leading-tight">{label}</div>
      </div>
    </Link>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const { data } = await apiClient.get("/dashboard/tareas-pendientes/");
      return data;
    },
    refetchInterval: 30000,
  });

  const socios_alta   = stats?.socios_alta ?? 0;
  const socios_baja   = stats?.socios_baja ?? 0;
  const cuota         = stats?.cuota_corriente ?? 0;
  const cuota_year    = stats?.cuota_year ?? new Date().getFullYear();
  const sin_cuota_pct = socios_alta > 0 ? Math.round(((socios_alta - cuota) / socios_alta) * 100) : 0;

  const aprobados  = stats?.animales_aprobados  ?? 0;
  const pendientes = stats?.animales_pendientes ?? 0;
  const rechazados = stats?.animales_rechazados ?? 0;
  const baja_anim  = stats?.animales_baja       ?? 0;
  const total_anim = stats?.animales_total       ?? 0;

  const pct = (n: number) => total_anim > 0 ? Math.round((n / total_anim) * 100) : 0;

  const portalTotal = (stats?.portal_active ?? 0) + (stats?.portal_pending ?? 0) + (stats?.portal_none ?? 0);

  const taskTiles = [
    { label: "Pendientes aprobación", value: stats?.pendientes_aprobacion ?? 0, icon: <CheckSquare size={20} />,  color: "bg-blue-600",    href: "/validaciones" },
    { label: "Conflictos",            value: stats?.conflictos_pendientes  ?? 0, icon: <AlertTriangle size={20} />, color: "bg-amber-500",  href: "/validaciones" },
    { label: "Solicitudes re-alta",   value: stats?.solicitudes_realta     ?? 0, icon: <RefreshCw size={20} />,    color: "bg-violet-600", href: "/validaciones" },
    { label: "Candidatos reproductor",value: stats?.candidatos_reproductor ?? 0, icon: <Bird size={20} />,         color: "bg-emerald-600",href: "/validaciones" },
    { label: "Alertas de anilla",     value: stats?.alertas_anilla         ?? 0, icon: <Bell size={20} />,         color: "bg-rose-600",   href: "/validaciones" },
    { label: "Imports en proceso",    value: stats?.imports_pendientes      ?? 0, icon: <Upload size={20} />,       color: "bg-sky-600",    href: "/importar" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">Resumen de la asociación</p>
      </div>

      {/* ── Bloque 1: KPIs ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {isLoading ? (
          [1,2,3,4].map((i) => <SkeletonCard key={i} />)
        ) : (
          <>
            {/* Socios */}
            <StatCard
              label="Socios en alta"
              value={socios_alta}
              sub={<span className="text-xs text-gray-400">{socios_baja} en baja</span>}
              icon={<Users size={22} />}
              color="bg-primary"
              href="/socios"
            />

            {/* Animales */}
            <StatCard
              label="Animales activos"
              value={stats?.animales_activos ?? 0}
              sub={<span className="text-xs text-gray-400">{baja_anim} dados de baja</span>}
              icon={<Bird size={22} />}
              color="bg-emerald-600"
              href="/animales"
            />

            {/* Cuota corriente */}
            <StatCard
              label={`Cuota ${cuota_year} al día`}
              value={cuota}
              sub={
                <div className="space-y-1">
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        sin_cuota_pct > 30 ? "bg-rose-500" : sin_cuota_pct > 10 ? "bg-amber-400" : "bg-green-500"
                      }`}
                      style={{ width: socios_alta > 0 ? `${Math.round((cuota / socios_alta) * 100)}%` : "0%" }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{socios_alta - cuota} pendientes de pago</span>
                </div>
              }
              icon={<Tag size={22} />}
              color="bg-amber-500"
              href="/socios"
            />

            {/* Acceso portal */}
            <StatCard
              label="Acceso al portal"
              value={stats?.portal_active ?? 0}
              sub={
                <div className="flex flex-wrap gap-2 mt-1">
                  <span className="flex items-center gap-1 text-xs text-green-700">
                    <CheckCircle size={11} /> {stats?.portal_active ?? 0} activos
                  </span>
                  <span className="flex items-center gap-1 text-xs text-amber-600">
                    <Clock size={11} /> {stats?.portal_pending ?? 0} pendientes
                  </span>
                  <span className="flex items-center gap-1 text-xs text-red-500">
                    <XCircle size={11} /> {stats?.portal_none ?? 0} sin acceso
                  </span>
                </div>
              }
              icon={<CheckCircle size={22} />}
              color="bg-blue-600"
              href="/socios"
            />
          </>
        )}
      </div>

      {/* ── Bloque 2: Tareas pendientes ────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Tareas pendientes</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {isLoading
            ? [1,2,3,4,5,6].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)
            : taskTiles.map((t) => <TaskTile key={t.label} {...t} />)
          }
        </div>
      </div>

      {/* ── Bloque 3: Estado del libro genealógico ─────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">Estado del libro genealógico</h2>
          {!isLoading && <span className="ml-auto text-xs text-gray-400">{total_anim} animales en total</span>}
        </div>

        {isLoading ? (
          <div className="h-6 bg-gray-100 rounded-full animate-pulse" />
        ) : total_anim === 0 ? (
          <p className="text-sm text-gray-400 text-center py-2">Sin animales registrados aún.</p>
        ) : (
          <div className="space-y-3">
            {/* Barra apilada */}
            <div className="flex h-5 rounded-full overflow-hidden gap-px">
              {aprobados  > 0 && <div className="bg-green-500"  style={{ width: `${pct(aprobados)}%`  }} title={`Aprobados/Evaluados: ${aprobados}`} />}
              {pendientes > 0 && <div className="bg-blue-400"   style={{ width: `${pct(pendientes)}%` }} title={`Pendientes: ${pendientes}`} />}
              {rechazados > 0 && <div className="bg-rose-400"   style={{ width: `${pct(rechazados)}%` }} title={`Rechazados: ${rechazados}`} />}
              {baja_anim  > 0 && <div className="bg-gray-300"   style={{ width: `${pct(baja_anim)}%`  }} title={`Baja: ${baja_anim}`} />}
            </div>
            {/* Leyenda */}
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {[
                { label: "Aprobados / Evaluados", count: aprobados,  dot: "bg-green-500" },
                { label: "Pendientes aprobación", count: pendientes, dot: "bg-blue-400"  },
                { label: "Rechazados",            count: rechazados, dot: "bg-rose-400"  },
                { label: "Baja",                  count: baja_anim,  dot: "bg-gray-300"  },
              ].map(({ label, count, dot }) => (
                <span key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
                  {label} <span className="font-semibold text-gray-700">{count}</span>
                  <span className="text-gray-300">({pct(count)}%)</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Bloque 4: Socios sin cuota ─────────────────────────────────────── */}
      {!isLoading && (stats?.socios_sin_cuota?.length ?? 0) > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-500" />
              Socios sin cuota {cuota_year}
              <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {socios_alta - cuota}
              </span>
            </h2>
            <Link to="/socios" className="text-xs text-primary hover:underline">Ver todos</Link>
          </div>
          <ul className="divide-y divide-gray-100">
            {stats!.socios_sin_cuota.map((s) => (
              <li key={s.id} className="py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-gray-400 font-mono shrink-0">#{s.numero_socio || "—"}</span>
                  <span className="text-sm text-gray-700 truncate">{s.nombre_razon_social}</span>
                </div>
                <Link
                  to={`/socios/${s.id}`}
                  className="text-xs text-primary hover:underline shrink-0"
                >
                  Ver ficha
                </Link>
              </li>
            ))}
          </ul>
          {(socios_alta - cuota) > 10 && (
            <p className="text-xs text-gray-400 mt-2 text-center">
              Mostrando 10 de {socios_alta - cuota}. <Link to="/socios" className="text-primary hover:underline">Ver todos</Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
