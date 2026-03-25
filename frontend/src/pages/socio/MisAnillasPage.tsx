import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Tag, Loader2, AlertCircle, Search, Settings2,
  GripVertical, X, ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";
import { anillasApi } from "../../api/anillas";

// ─── DiametroChip ─────────────────────────────────────────────────────────────

function DiametroChip({ diametro, sexo }: { diametro: string; sexo?: "M" | "H" | null }) {
  const isHembra = sexo === "H";
  const isMacho = sexo === "M";
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
        isHembra ? "bg-pink-100 text-pink-800"
        : isMacho ? "bg-blue-100 text-blue-800"
        : "bg-gray-100 text-gray-600"
      }`}
    >
      {isHembra ? "♀" : isMacho ? "♂" : "·"} {diametro} mm
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rangoCount(inicio: string, fin: string): number | null {
  const parseNum = (s: string) => {
    const m = s.replace(/\D/g, "");
    return m ? parseInt(m, 10) : null;
  };
  const a = parseNum(inicio);
  const b = parseNum(fin);
  if (a !== null && b !== null && b >= a) return b - a + 1;
  return null;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface EntregaAnillas {
  id: string;
  anio_campana: number;
  rango_inicio: string;
  rango_fin: string;
  diametro: string;
  sexo?: "M" | "H" | null;
  created_by_nombre?: string | null;
}

interface ColDef {
  id: string;
  label: string;
  sortKey?: string;
  render: (e: EntregaAnillas) => React.ReactNode;
}

const ALL_COLS: ColDef[] = [
  {
    id: "campana",
    label: "Campaña",
    sortKey: "anio_campana",
    render: (e) => (
      <span className="font-semibold text-gray-800">{e.anio_campana}</span>
    ),
  },
  {
    id: "desde",
    label: "Desde",
    sortKey: "rango_inicio",
    render: (e) => (
      <span className="font-mono font-medium text-gray-900">{e.rango_inicio}</span>
    ),
  },
  {
    id: "hasta",
    label: "Hasta",
    sortKey: "rango_fin",
    render: (e) => (
      <span className="font-mono font-medium text-gray-900">{e.rango_fin}</span>
    ),
  },
  {
    id: "diametro",
    label: "Diám. / Sexo",
    render: (e) => <DiametroChip diametro={e.diametro} sexo={e.sexo} />,
  },
  {
    id: "cantidad",
    label: "Cantidad",
    render: (e) => {
      const n = rangoCount(e.rango_inicio, e.rango_fin);
      return n !== null ? (
        <span className="font-semibold text-gray-700">{n}</span>
      ) : (
        <span className="text-gray-300">—</span>
      );
    },
  },
  {
    id: "asignado_por",
    label: "Asignado por",
    render: (e) => (
      <span className="text-gray-500 text-xs">{e.created_by_nombre ?? "—"}</span>
    ),
  },
];

const DEFAULT_VISIBLE = ["campana", "desde", "hasta", "diametro", "cantidad", "asignado_por"];
const LS_KEY = "mis_anillas_table_cols";

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

// ─── Panel de columnas ────────────────────────────────────────────────────────

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
      <div className="w-72 bg-white shadow-2xl flex flex-col">
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

// ─── MisAnillasPage ───────────────────────────────────────────────────────────

export default function MisAnillasPage() {
  const [search, setSearch] = useState("");
  const [filterAnio, setFilterAnio] = useState("");
  const [ordering, setOrdering] = useState("-anio_campana");
  const [colState, setColState] = useState<ColState[]>(loadColState);
  const [showColPanel, setShowColPanel] = useState(false);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(colState));
  }, [colState]);

  const { data: entregas = [], isLoading, isError } = useQuery({
    queryKey: ["mis-anillas"],
    queryFn: anillasApi.misAnillas,
  });

  const availableYears = [...new Set(entregas.map((e) => e.anio_campana))].sort((a, b) => b - a);

  // Sort
  const sorted = [...entregas].sort((a, b) => {
    const desc = ordering.startsWith("-");
    const key = desc ? ordering.slice(1) : ordering;
    let va: any = (a as any)[key] ?? "";
    let vb: any = (b as any)[key] ?? "";
    if (va < vb) return desc ? 1 : -1;
    if (va > vb) return desc ? -1 : 1;
    return 0;
  });

  // Filter
  const filtered = sorted.filter((e) => {
    if (filterAnio && e.anio_campana !== Number(filterAnio)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !e.rango_inicio.toLowerCase().includes(q) &&
        !e.rango_fin.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

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

  const hasActiveFilters = search || filterAnio;
  const resetFilters = () => { setSearch(""); setFilterAnio(""); };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mis Anillas</h1>
          <p className="text-sm text-gray-500">Rangos de anillas asignados por la asociación</p>
        </div>
        <button
          onClick={() => setShowColPanel(true)}
          className="btn-secondary flex items-center gap-2 text-sm"
          title="Configurar columnas"
        >
          <Settings2 size={15} /> Columnas
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por rango..."
            className="input-field pl-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {availableYears.length > 1 && (
          <select
            className="input-field w-auto text-sm"
            value={filterAnio}
            onChange={(e) => setFilterAnio(e.target.value)}
          >
            <option value="">Todas las campañas</option>
            {availableYears.map((y) => (
              <option key={y} value={String(y)}>Campaña {y}</option>
            ))}
          </select>
        )}
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="btn-secondary text-sm flex items-center gap-1 text-gray-500"
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
        <div className="card flex items-center gap-3 text-red-600 py-6">
          <AlertCircle size={20} />
          <p>Error al cargar las anillas. Comprueba la conexión.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Tag size={48} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {hasActiveFilters
              ? "No hay anillas que coincidan con los filtros"
              : "No tienes anillas asignadas todavía"}
          </p>
          {!hasActiveFilters && (
            <p className="text-sm text-gray-400 mt-1">
              Contacta con la asociación para solicitar tu asignación de anillas.
            </p>
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
              </tr>
            </thead>
            <tbody>
              {filtered.map((entrega, i) => (
                <tr
                  key={entrega.id}
                  className={`border-b border-gray-100 last:border-0 hover:bg-blue-50/30 transition-colors ${
                    i % 2 === 0 ? "" : "bg-gray-50/40"
                  }`}
                >
                  {visibleCols.map((col) => (
                    <td key={col.id} className="px-3 py-2 whitespace-nowrap">
                      {col.render(entrega)}
                    </td>
                  ))}
                </tr>
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
