import { Fragment, useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus, Search, Bird, RotateCcw, Loader2, XCircle, Pencil, Eye,
  Settings2, GripVertical, X, ArrowUpDown, ArrowUp, ArrowDown,
  MessageSquare, Star,
} from "lucide-react";
import { animalsApi } from "../../api/animals";
import { realtaApi } from "../../api/realta";
import { configuracionApi } from "../../api/configuracion";
import AnimalStateChip from "../../components/AnimalStateChip";
import type { Animal, AnimalEstado } from "../../types";

// ── Tipos de tab ──────────────────────────────────────────────────────────────

type Tab = "activos" | "no_activos";

const ACTIVO_STATES: AnimalEstado[] = ["AÑADIDO", "APROBADO", "EVALUADO"];
const NO_ACTIVO_STATES: AnimalEstado[] = ["RECHAZADO", "SOCIO_EN_BAJA", "BAJA"];

// ── Columnas ──────────────────────────────────────────────────────────────────

interface ColDef {
  id: string;
  label: string;
  sortKey?: string;
  render: (a: Animal) => React.ReactNode;
}

const SEXO_LABEL: Record<string, string> = { M: "Macho", H: "Hembra" };
const VARIEDAD_LABEL: Record<string, string> = {
  SALMON: "Salmón", PLATA: "Plata", SIN_DEFINIR: "Sin definir",
};

const ALL_COLS: ColDef[] = [
  {
    id: "foto",
    label: "Foto",
    render: (a) => {
      const foto = a.fotos?.find((f) => f.tipo === "PERFIL") ?? a.fotos?.[0];
      return foto ? (
        <img src={foto.url} alt="Foto" className="w-8 h-8 rounded-lg object-cover" />
      ) : (
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
          <Bird size={14} className="text-gray-300" />
        </div>
      );
    },
  },
  {
    id: "anilla",
    label: "Anilla",
    sortKey: "numero_anilla",
    render: (a) => (
      <span className="font-mono font-semibold text-gray-900">{a.numero_anilla}</span>
    ),
  },
  {
    id: "sexo",
    label: "Sexo",
    render: (a) => {
      if (!a.sexo) return <span className="text-gray-300">—</span>;
      const isMacho = a.sexo === "M";
      return (
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            isMacho ? "bg-blue-100 text-blue-800" : "bg-pink-100 text-pink-800"
          }`}
        >
          {isMacho ? "♂ Macho" : "♀ Hembra"}
        </span>
      );
    },
  },
  {
    id: "anio",
    label: "Año nac.",
    sortKey: "fecha_nacimiento",
    render: (a) =>
      a.fecha_nacimiento ? (
        <span className="text-gray-600">{new Date(a.fecha_nacimiento).getFullYear()}</span>
      ) : (
        <span className="text-gray-300">—</span>
      ),
  },
  {
    id: "variedad",
    label: "Variedad",
    render: (a) => (
      <span className="text-gray-600">{VARIEDAD_LABEL[a.variedad] ?? a.variedad ?? "—"}</span>
    ),
  },
  {
    id: "estado",
    label: "Estado",
    render: (a) => <AnimalStateChip estado={a.estado} />,
  },
  {
    id: "granja",
    label: "Granja",
    render: (a) => (
      <span className="text-sm text-gray-600">{a.granja_nombre ?? <span className="text-gray-300">—</span>}</span>
    ),
  },
  {
    id: "padre",
    label: "Padre",
    render: (a) =>
      a.padre_anilla ? (
        <span className="font-mono text-xs text-gray-600">{a.padre_anilla}</span>
      ) : (
        <span className="text-gray-300">—</span>
      ),
  },
  {
    id: "madre",
    label: "Madre",
    render: (a) =>
      a.madre_anilla ? (
        <span className="font-mono text-xs text-gray-600">{a.madre_anilla}</span>
      ) : (
        <span className="text-gray-300">—</span>
      ),
  },
  {
    id: "candidato",
    label: "Candidato repr.",
    render: (a) =>
      a.candidato_reproductor ? (
        <span className="text-xs font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">Sí</span>
      ) : (
        <span className="text-gray-300">—</span>
      ),
  },
];

const DEFAULT_VISIBLE = ["foto", "anilla", "sexo", "anio", "variedad", "estado"];
const LS_KEY = "mis_animales_table_cols";

interface ColState { id: string; visible: boolean }

function loadColState(): ColState[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const saved: ColState[] = JSON.parse(raw);
      const ids = new Set(saved.map((c) => c.id));
      const merged = [...saved];
      ALL_COLS.forEach((c) => { if (!ids.has(c.id)) merged.push({ id: c.id, visible: false }); });
      return merged;
    }
  } catch {}
  return ALL_COLS.map((c) => ({ id: c.id, visible: DEFAULT_VISIBLE.includes(c.id) }));
}

// ── Panel de columnas ─────────────────────────────────────────────────────────

function ColConfigPanel({
  cols, onChange, onClose,
}: {
  cols: ColState[]; onChange: (cols: ColState[]) => void; onClose: () => void;
}) {
  const [local, setLocal] = useState<ColState[]>(cols);
  const dragIdx = useRef<number | null>(null);

  const toggleVisible = (id: string) =>
    setLocal((prev) => prev.map((c) => c.id === id ? { ...c, visible: !c.visible } : c));

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
  const reset = () => setLocal(ALL_COLS.map((c) => ({ id: c.id, visible: DEFAULT_VISIBLE.includes(c.id) })));

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
            const def = ALL_COLS.find((c) => c.id === cs.id)!;
            if (!def) return null;
            return (
              <li
                key={cs.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={handleDrop}
                className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-gray-50 cursor-grab active:cursor-grabbing select-none"
              >
                <GripVertical size={14} className="text-gray-300 shrink-0" />
                <input
                  type="checkbox"
                  checked={cs.visible}
                  onChange={() => toggleVisible(cs.id)}
                  className="accent-blue-600"
                />
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

// ── Página principal ──────────────────────────────────────────────────────────

export default function MisAnimalesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("activos");
  const [search, setSearch] = useState("");
  const [filterSexo, setFilterSexo] = useState("");
  const [filterVariedad, setFilterVariedad] = useState("");
  const [filterAnio, setFilterAnio] = useState("");
  const [ordering, setOrdering] = useState("numero_anilla");
  const [colState, setColState] = useState<ColState[]>(loadColState);
  const [showColPanel, setShowColPanel] = useState(false);

  // Dar de baja inline
  const [bajaAnimalId, setBajaAnimalId] = useState<string | null>(null);
  const [bajaFecha, setBajaFecha] = useState(new Date().toISOString().slice(0, 10));
  const [bajaMotivoId, setBajaMotivoId] = useState("");

  // Solicitar reactivación inline
  const [realtaOpenId, setRealtaOpenId] = useState<string | null>(null);
  const [realtaNotas, setRealtaNotas] = useState("");

  // Persist column config
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(colState));
  }, [colState]);

  // Fetch ALL animals at once (no pagination) — filtering and sorting is client-side
  const { data, isLoading, isError } = useQuery({
    queryKey: ["animals"],
    queryFn: () => animalsApi.list({ page_size: 10000 }),
  });

  const { data: motivosBaja = [] } = useQuery({
    queryKey: ["motivos-baja"],
    queryFn: configuracionApi.listMotivosBaja,
  });

  const realtaMutation = useMutation({
    mutationFn: ({ id, notas }: { id: string; notas: string }) => realtaApi.solicitar(id, notas),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["animals"] });
      setRealtaOpenId(null);
      setRealtaNotas("");
    },
  });

  const candidatoMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      animalsApi.update(id, { candidato_reproductor: value } as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["animals"] }),
  });

  const darBajaMutation = useMutation({
    mutationFn: ({ id, fecha_baja, motivo_baja }: { id: string; fecha_baja: string; motivo_baja: string }) =>
      animalsApi.darBaja(id, fecha_baja, motivo_baja),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["animals"] });
      setBajaAnimalId(null);
      setBajaMotivoId("");
    },
  });

  const animals = data?.results ?? [];

  // Opciones de filtro derivadas de los datos reales
  const availableYears = [...new Set(
    animals
      .map((a) => a.fecha_nacimiento ? new Date(a.fecha_nacimiento).getFullYear() : null)
      .filter((y): y is number => y !== null)
  )].sort((a, b) => b - a);

  const availableSexos = [...new Set(animals.map((a) => a.sexo).filter(Boolean))];
  const availableVariedades = [...new Set(animals.map((a) => a.variedad).filter(Boolean))];

  // Filtrado y ordenación cliente
  const sortedAnimals = [...animals].sort((a, b) => {
    const desc = ordering.startsWith("-");
    const key = desc ? ordering.slice(1) : ordering;
    let va: any = (a as any)[key] ?? "";
    let vb: any = (b as any)[key] ?? "";
    if (key === "fecha_nacimiento") {
      va = va ? new Date(va).getTime() : 0;
      vb = vb ? new Date(vb).getTime() : 0;
    }
    if (va < vb) return desc ? 1 : -1;
    if (va > vb) return desc ? -1 : 1;
    return 0;
  });

  const filteredAnimals = sortedAnimals.filter((a) => {
    const inTab = tab === "activos" ? ACTIVO_STATES.includes(a.estado) : NO_ACTIVO_STATES.includes(a.estado);
    if (!inTab) return false;
    if (search && !a.numero_anilla.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterSexo && a.sexo !== filterSexo) return false;
    if (filterVariedad && a.variedad !== filterVariedad) return false;
    if (filterAnio && (!a.fecha_nacimiento || new Date(a.fecha_nacimiento).getFullYear() !== Number(filterAnio))) return false;
    return true;
  });

  const activosCount = animals.filter((a) => ACTIVO_STATES.includes(a.estado)).length;
  const noActivosCount = animals.filter((a) => NO_ACTIVO_STATES.includes(a.estado)).length;

  const visibleCols = colState
    .filter((cs) => cs.visible)
    .map((cs) => ALL_COLS.find((c) => c.id === cs.id)!)
    .filter(Boolean);

  const sortIcon = (sortKey?: string) => {
    if (!sortKey) return null;
    if (ordering === sortKey) return <ArrowUp size={12} className="text-blue-600" />;
    if (ordering === `-${sortKey}`) return <ArrowDown size={12} className="text-blue-600" />;
    return <ArrowUpDown size={12} className="text-gray-300" />;
  };

  const handleSort = (sortKey?: string) => {
    if (!sortKey) return;
    setOrdering((prev) => (prev === sortKey ? `-${sortKey}` : sortKey));
  };

  const openBaja = (id: string) => {
    setBajaAnimalId(id);
    setBajaFecha(new Date().toISOString().slice(0, 10));
    setBajaMotivoId("");
  };
  const closeBaja = () => { setBajaAnimalId(null); setBajaMotivoId(""); };

  const resetFilters = () => {
    setSearch(""); setFilterSexo(""); setFilterVariedad(""); setFilterAnio("");
  };
  const hasActiveFilters = search || filterSexo || filterVariedad || filterAnio;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mis Animales</h1>
          <p className="text-sm text-gray-500">{data?.count ?? 0} animales registrados</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowColPanel(true)}
            className="btn-secondary flex items-center gap-2 text-sm"
            title="Configurar columnas"
          >
            <Settings2 size={15} /> Columnas
          </button>
          <Link to="/mis-animales/nuevo" className="btn-primary flex items-center gap-2">
            <Plus size={18} />
            Nuevo Animal
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "activos" ? "border-blue-700 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setTab("activos")}
        >
          Activos ({activosCount})
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "no_activos" ? "border-blue-700 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setTab("no_activos")}
        >
          No activos ({noActivosCount})
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por anilla..."
            className="input-field pl-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {availableSexos.length > 0 && (
          <select
            className="input-field w-auto text-sm"
            value={filterSexo}
            onChange={(e) => setFilterSexo(e.target.value)}
          >
            <option value="">Todos los sexos</option>
            {availableSexos.includes("M") && <option value="M">♂ Macho</option>}
            {availableSexos.includes("H") && <option value="H">♀ Hembra</option>}
          </select>
        )}
        {availableVariedades.length > 0 && (
          <select
            className="input-field w-auto text-sm"
            value={filterVariedad}
            onChange={(e) => setFilterVariedad(e.target.value)}
          >
            <option value="">Todas las variedades</option>
            {availableVariedades.map((v) => (
              <option key={v} value={v}>{VARIEDAD_LABEL[v] ?? v}</option>
            ))}
          </select>
        )}
        {availableYears.length > 0 && (
          <select
            className="input-field w-auto text-sm"
            value={filterAnio}
            onChange={(e) => setFilterAnio(e.target.value)}
          >
            <option value="">Todos los años</option>
            {availableYears.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        )}
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="btn-secondary text-sm flex items-center gap-1 text-gray-500"
            title="Limpiar filtros"
          >
            <X size={14} /> Limpiar
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-lg" />)}
        </div>
      ) : isError ? (
        <div className="card text-center py-8 text-red-600">
          Error al cargar los animales. Comprueba la conexión.
        </div>
      ) : filteredAnimals.length === 0 ? (
        <div className="card text-center py-12">
          <Bird size={48} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {hasActiveFilters
              ? "No hay animales que coincidan con los filtros"
              : tab === "activos"
              ? "No tienes animales activos"
              : "No hay animales no activos"}
          </p>
          {tab === "activos" && !hasActiveFilters && (
            <Link to="/mis-animales/nuevo" className="btn-primary mt-4 inline-flex">
              <Plus size={18} />
              Nuevo Animal
            </Link>
          )}
          {hasActiveFilters && (
            <button onClick={resetFilters} className="btn-secondary mt-4">
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {visibleCols.map((col) => (
                  <th
                    key={col.id}
                    className={`px-3 py-2.5 text-left font-semibold text-gray-600 text-xs whitespace-nowrap ${
                      col.sortKey ? "cursor-pointer hover:bg-gray-100 select-none" : ""
                    }`}
                    onClick={() => handleSort(col.sortKey)}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sortIcon(col.sortKey)}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600 text-xs">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredAnimals.map((animal, i) => (
                <Fragment key={animal.id}>
                  <tr
                    className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${
                      i % 2 === 0 ? "" : "bg-gray-50/40"
                    }`}
                  >
                    {visibleCols.map((col) => (
                      <td key={col.id} className="px-3 py-2 whitespace-nowrap">
                        {col.render(animal)}
                      </td>
                    ))}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1 justify-end">
                        {/* Visualizar — siempre */}
                        <button
                          onClick={() => navigate(`/mis-animales/${animal.id}?readonly=true`)}
                          className="p-2 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="Visualizar"
                        >
                          <Eye size={14} />
                        </button>
                        {/* Editar — solo activos */}
                        {ACTIVO_STATES.includes(animal.estado) && (
                          <button
                            onClick={() => navigate(`/mis-animales/${animal.id}`)}
                            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {/* Dar de baja — solo activos */}
                        {ACTIVO_STATES.includes(animal.estado) && (
                          <button
                            onClick={() => bajaAnimalId === animal.id
                              ? setBajaAnimalId(null)
                              : (setBajaAnimalId(animal.id), setBajaFecha(new Date().toISOString().slice(0, 10)), setBajaMotivoId(""))
                            }
                            className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                            title="Dar de baja"
                          >
                            <XCircle size={14} />
                          </button>
                        )}
                        {/* Proponer candidato a reproductor — solo APROBADO */}
                        {animal.estado === "APROBADO" && (
                          <button
                            onClick={() => candidatoMutation.mutate({ id: animal.id, value: !animal.candidato_reproductor })}
                            disabled={candidatoMutation.isPending}
                            className={`p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors ${
                              animal.candidato_reproductor
                                ? "text-violet-700 bg-violet-50 hover:bg-violet-100"
                                : "text-gray-400 hover:bg-violet-50 hover:text-violet-600"
                            }`}
                            title={animal.candidato_reproductor ? "Retirar candidatura" : "Proponer como candidato a reproductor"}
                          >
                            <Star size={14} fill={animal.candidato_reproductor ? "currentColor" : "none"} />
                          </button>
                        )}
                        {/* Solicitar reactivación — solo no activos */}
                        {NO_ACTIVO_STATES.includes(animal.estado) && (
                          <button
                            onClick={() => {
                              if (realtaOpenId === animal.id) {
                                setRealtaOpenId(null); setRealtaNotas("");
                              } else {
                                setRealtaOpenId(animal.id); setRealtaNotas("");
                              }
                            }}
                            className={`p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors ${
                              realtaOpenId === animal.id
                                ? "bg-violet-100 text-violet-700"
                                : "text-gray-500 hover:bg-violet-50 hover:text-violet-600"
                            }`}
                            title="Solicitar reactivación"
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Inline dar de baja */}
                  {bajaAnimalId === animal.id && (
                    <tr>
                      <td colSpan={visibleCols.length + 1} className="px-4 py-3 bg-red-50 border-b border-red-100">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-red-700">
                            Confirmar baja — {animal.numero_anilla}
                          </p>
                          <div className="grid grid-cols-2 gap-2 max-w-sm">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Fecha de baja</label>
                              <input
                                type="date"
                                className="input-field text-xs"
                                value={bajaFecha}
                                onChange={(e) => setBajaFecha(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Motivo</label>
                              <select
                                className="input-field text-xs"
                                value={bajaMotivoId}
                                onChange={(e) => setBajaMotivoId(e.target.value)}
                              >
                                <option value="">Seleccionar...</option>
                                {motivosBaja.filter((m) => m.is_active).map((m) => (
                                  <option key={m.id} value={m.id}>{m.nombre}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                darBajaMutation.mutate({
                                  id: animal.id,
                                  fecha_baja: bajaFecha,
                                  motivo_baja: bajaMotivoId,
                                })
                              }
                              disabled={!bajaFecha || !bajaMotivoId || darBajaMutation.isPending}
                              className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                            >
                              {darBajaMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : null}
                              Confirmar baja
                            </button>
                            <button onClick={() => setBajaAnimalId(null)} className="btn-secondary text-xs py-1.5 px-3">
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Inline solicitar reactivación */}
                  {realtaOpenId === animal.id && (
                    <tr>
                      <td colSpan={visibleCols.length + 1} className="px-4 py-3 bg-violet-50 border-b border-violet-100">
                        <div className="space-y-2 max-w-lg">
                          <p className="text-xs font-semibold text-violet-800 flex items-center gap-1.5">
                            <RotateCcw size={12} />
                            Solicitar reactivación — {animal.numero_anilla}
                          </p>
                          <p className="text-xs text-violet-600">
                            Indica el motivo por el que solicitas reactivar este animal. La gestión revisará tu solicitud.
                          </p>
                          <textarea
                            className="input-field text-xs resize-none"
                            rows={3}
                            placeholder="Describe el motivo de la solicitud (obligatorio)..."
                            value={realtaNotas}
                            onChange={(e) => setRealtaNotas(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => realtaMutation.mutate({ id: animal.id, notas: realtaNotas })}
                              disabled={!realtaNotas.trim() || realtaMutation.isPending}
                              className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                            >
                              {realtaMutation.isPending
                                ? <Loader2 size={11} className="animate-spin" />
                                : <MessageSquare size={11} />}
                              Enviar solicitud
                            </button>
                            <button
                              onClick={() => { setRealtaOpenId(null); setRealtaNotas(""); }}
                              className="btn-secondary text-xs py-1.5 px-3"
                            >
                              Cancelar
                            </button>
                          </div>
                          {realtaMutation.isError && (
                            <p className="text-xs text-red-600">
                              {(realtaMutation.error as any)?.response?.data?.detail ?? "Error al enviar la solicitud."}
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Column config panel */}
      {showColPanel && (
        <ColConfigPanel
          cols={colState}
          onChange={setColState}
          onClose={() => setShowColPanel(false)}
        />
      )}
    </div>
  );
}
