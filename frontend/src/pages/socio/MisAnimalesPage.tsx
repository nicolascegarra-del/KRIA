import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Search, Bird, RefreshCw, Loader2 } from "lucide-react";
import { animalsApi } from "../../api/animals";
import { realtaApi } from "../../api/realta";
import AnimalCard from "../../components/AnimalCard";
import AnimalStateChip from "../../components/AnimalStateChip";
import type { AnimalEstado } from "../../types";

type Tab = "activos" | "historico";

const ACTIVO_STATES: AnimalEstado[] = ["AÑADIDO", "APROBADO", "EVALUADO"];
const HISTORICO_STATES: AnimalEstado[] = ["RECHAZADO", "SOCIO_EN_BAJA"];

export default function MisAnimalesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("activos");
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");
  const [realtaId, setRealtaId] = useState<string | null>(null);

  const realtaMutation = useMutation({
    mutationFn: realtaApi.solicitar,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["animals"] }); setRealtaId(null); },
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["animals", { search, estado: estadoFilter }],
    queryFn: () => animalsApi.list({ search, estado: estadoFilter || undefined }),
  });

  const animals = data?.results ?? [];

  // Filter by tab on the frontend (backend already filters by socio)
  const filteredAnimals = animals.filter((a) => {
    if (tab === "activos") return ACTIVO_STATES.includes(a.estado);
    return HISTORICO_STATES.includes(a.estado);
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mis Animales</h1>
          <p className="text-sm text-gray-500">{data?.count ?? 0} animales registrados</p>
        </div>
        <Link to="/mis-animales/nuevo" className="btn-primary">
          <Plus size={18} />
          Nuevo animal
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "activos"
              ? "border-blue-700 text-blue-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setTab("activos")}
        >
          Activos ({animals.filter((a) => ACTIVO_STATES.includes(a.estado)).length})
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "historico"
              ? "border-blue-700 text-blue-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setTab("historico")}
        >
          Histórico ({animals.filter((a) => HISTORICO_STATES.includes(a.estado)).length})
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por anilla..."
            className="input-field pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-field w-auto"
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="AÑADIDO">Añadido</option>
          <option value="APROBADO">Aprobado</option>
          <option value="EVALUADO">Evaluado</option>
          <option value="RECHAZADO">Rechazado</option>
          <option value="SOCIO_EN_BAJA">Socio en baja</option>
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse h-20 bg-gray-100" />
          ))}
        </div>
      ) : isError ? (
        <div className="card text-center py-8 text-red-600">
          Error al cargar los animales. Comprueba la conexión.
        </div>
      ) : filteredAnimals.length === 0 ? (
        <div className="card text-center py-12">
          <Bird size={48} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {tab === "activos" ? "No tienes animales activos" : "No hay animales en el histórico"}
          </p>
          {tab === "activos" && (
            <Link to="/mis-animales/nuevo" className="btn-primary mt-4 inline-flex">
              <Plus size={18} />
              Registrar primer animal
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredAnimals.map((animal) => (
            <div key={animal.id}>
              <AnimalCard animal={animal} />
              {animal.estado === "SOCIO_EN_BAJA" && (
                <div className="pl-2 pb-1">
                  <button
                    onClick={() => { setRealtaId(animal.id); realtaMutation.mutate(animal.id); }}
                    disabled={realtaMutation.isPending && realtaId === animal.id}
                    className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 disabled:opacity-50 mt-1"
                  >
                    {realtaMutation.isPending && realtaId === animal.id
                      ? <Loader2 size={12} className="animate-spin" />
                      : <RefreshCw size={12} />}
                    Solicitar re-alta
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
