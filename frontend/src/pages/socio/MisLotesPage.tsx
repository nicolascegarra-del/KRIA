import { Fragment, useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Layers, Plus, X, Loader2, AlertCircle, Search,
  Settings2, GripVertical, ArrowUpDown, ArrowUp, ArrowDown,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { lotesApi } from "../../api/lotes";
import { animalsApi } from "../../api/animals";
import type { Lote } from "../../types";

// ─── LoteModal ────────────────────────────────────────────────────────────────

interface LoteModalProps {
  onClose: () => void;
}

function LoteModal({ onClose }: LoteModalProps) {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [machoId, setMachoId] = useState("");
  const [hembrasSlots, setHembrasSlots] = useState<string[]>([""]);
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().slice(0, 10));
  const [modalError, setModalError] = useState("");

  const { data: machosData, isLoading: loadingMachos } = useQuery({
    queryKey: ["animals-machos-select"],
    queryFn: () => animalsApi.list({ sexo: "M" }),
  });
  const { data: hembrasData, isLoading: loadingHembras } = useQuery({
    queryKey: ["animals-hembras-select"],
    queryFn: () => animalsApi.list({ sexo: "H" }),
  });
  const { data: lotesData } = useQuery({
    queryKey: ["lotes"],
    queryFn: lotesApi.list,
  });

  const machos = machosData?.results ?? [];
  const hembras = hembrasData?.results ?? [];

  const activeLotes = (lotesData?.results ?? []).filter((l) => !l.is_closed);
  const machoIdsEnUso = new Set(activeLotes.map((l) => l.macho).filter(Boolean) as string[]);
  const hembraIdsEnUso = new Set(activeLotes.flatMap((l) => l.hembras));

  const selectedHembraIds = new Set(hembrasSlots.filter(Boolean));

  const addHembraSlot = () => setHembrasSlots((prev) => [...prev, ""]);
  const removeHembraSlot = (idx: number) =>
    setHembrasSlots((prev) => prev.filter((_, i) => i !== idx));
  const updateHembraSlot = (idx: number, val: string) =>
    setHembrasSlots((prev) => prev.map((v, i) => (i === idx ? val : v)));

  const hembrasIds = hembrasSlots.filter(Boolean);

  const createMutation = useMutation({
    mutationFn: () =>
      lotesApi.create({
        nombre,
        macho: machoId || null,
        hembras: hembrasIds,
        fecha_inicio: fechaInicio,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lotes"] });
      onClose();
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail ??
        "Error al crear el lote. Comprueba los datos e inténtalo de nuevo.";
      setModalError(msg);
    },
  });

  const loadingAnimals = loadingMachos || loadingHembras;

  const animalLabel = (a: { numero_anilla: string; fecha_nacimiento: string; estado: string }) =>
    `${a.numero_anilla} / ${a.fecha_nacimiento ? new Date(a.fecha_nacimiento).getFullYear() : "—"}${a.estado !== "APROBADO" ? ` — ${a.estado.toLowerCase()}` : ""}`;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Nuevo Lote de Cría</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del lote *
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="Ej: Lote Primavera 2024"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de inicio *
            </label>
            <input
              type="date"
              className="input-field"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Macho</label>
            {loadingMachos ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                <Loader2 size={14} className="animate-spin" /> Cargando...
              </div>
            ) : machos.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No tienes machos registrados.</p>
            ) : (
              <select
                className="input-field"
                value={machoId}
                onChange={(e) => setMachoId(e.target.value)}
              >
                <option value="">— Sin macho asignado —</option>
                {machos.map((a) => (
                  <option key={a.id} value={a.id} disabled={machoIdsEnUso.has(a.id)}>
                    {animalLabel(a)}{machoIdsEnUso.has(a.id) ? " (en uso)" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Hembras
                {hembrasIds.length > 0 && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
                    {hembrasIds.length} seleccionada{hembrasIds.length !== 1 ? "s" : ""}
                  </span>
                )}
              </label>
              <button
                type="button"
                onClick={addHembraSlot}
                disabled={loadingHembras || hembras.length === 0}
                className="flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800 disabled:opacity-40"
              >
                <Plus size={12} /> Añadir
              </button>
            </div>
            {loadingHembras ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                <Loader2 size={14} className="animate-spin" /> Cargando...
              </div>
            ) : hembras.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No tienes hembras registradas.</p>
            ) : (
              <div className="space-y-2">
                {hembrasSlots.map((slotId, idx) => (
                  <div key={idx} className="flex gap-2">
                    <select
                      className="input-field flex-1"
                      value={slotId}
                      onChange={(e) => updateHembraSlot(idx, e.target.value)}
                    >
                      <option value="">— Selecciona una hembra —</option>
                      {hembras.map((a) => {
                        const enUso = hembraIdsEnUso.has(a.id);
                        const enOtraFila = selectedHembraIds.has(a.id) && a.id !== slotId;
                        const disabled = enUso || enOtraFila;
                        return (
                          <option key={a.id} value={a.id} disabled={disabled}>
                            {animalLabel(a)}
                            {enUso ? " (en uso)" : enOtraFila ? " (ya añadida)" : ""}
                          </option>
                        );
                      })}
                    </select>
                    {hembrasSlots.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeHembraSlot(idx)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg shrink-0"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {modalError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {modalError}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 pb-5 pt-3 border-t shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button
            onClick={() => { setModalError(""); createMutation.mutate(); }}
            disabled={createMutation.isPending || !nombre.trim() || !fechaInicio || loadingAnimals}
            className="btn-primary flex-1"
          >
            {createMutation.isPending ? (
              <><Loader2 size={14} className="animate-spin" /> Creando...</>
            ) : (
              "Crear lote"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Columnas ─────────────────────────────────────────────────────────────────

interface ColDef {
  id: string;
  label: string;
  sortKey?: string;
  render: (l: Lote) => React.ReactNode;
}

const ALL_COLS: ColDef[] = [
  {
    id: "nombre",
    label: "Nombre",
    sortKey: "nombre",
    render: (l) => <span className="font-semibold text-gray-900">{l.nombre}</span>,
  },
  {
    id: "estado",
    label: "Estado",
    render: (l) => (
      <span
        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          l.is_closed ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700"
        }`}
      >
        {l.is_closed ? "Finalizado" : "Activo"}
      </span>
    ),
  },
  {
    id: "macho",
    label: "Macho",
    render: (l) =>
      l.macho_anilla ? (
        <span className="font-mono text-xs text-blue-800 bg-blue-50 px-2 py-0.5 rounded">
          ♂ {l.macho_anilla}
        </span>
      ) : (
        <span className="text-gray-300">—</span>
      ),
  },
  {
    id: "hembras",
    label: "Hembras",
    render: (l) => (
      <span className="text-gray-700">{l.hembras.length}</span>
    ),
  },
  {
    id: "crias",
    label: "Crías",
    sortKey: "crias_count",
    render: (l) => <span className="text-gray-700">{l.crias_count}</span>,
  },
  {
    id: "fecha_inicio",
    label: "Inicio",
    sortKey: "fecha_inicio",
    render: (l) => <span className="text-gray-600 text-xs">{l.fecha_inicio}</span>,
  },
  {
    id: "fecha_fin",
    label: "Fin",
    sortKey: "fecha_fin",
    render: (l) =>
      l.fecha_fin ? (
        <span className="text-gray-600 text-xs">{l.fecha_fin}</span>
      ) : (
        <span className="text-gray-300">—</span>
      ),
  },
];

const DEFAULT_VISIBLE = ["nombre", "estado", "macho", "hembras", "crias", "fecha_inicio"];
const LS_KEY = "mis_lotes_table_cols";

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

// ─── MisLotesPage ─────────────────────────────────────────────────────────────

export default function MisLotesPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"activos" | "finalizados">("activos");
  const [showModal, setShowModal] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [ordering, setOrdering] = useState("nombre");
  const [colState, setColState] = useState<ColState[]>(loadColState);
  const [showColPanel, setShowColPanel] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(colState));
  }, [colState]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["lotes"],
    queryFn: lotesApi.list,
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => {
      setClosingId(id);
      return lotesApi.close(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lotes"] });
      setClosingId(null);
    },
    onError: () => setClosingId(null),
  });

  const allLotes = data?.results ?? [];
  const activeLotes = allLotes.filter((l) => !l.is_closed);
  const closedLotes = allLotes.filter((l) => l.is_closed);
  const tabLotes = activeTab === "activos" ? activeLotes : closedLotes;

  // Sort
  const sorted = [...tabLotes].sort((a, b) => {
    const desc = ordering.startsWith("-");
    const key = desc ? ordering.slice(1) : ordering;
    let va: any = (a as any)[key] ?? "";
    let vb: any = (b as any)[key] ?? "";
    if (va < vb) return desc ? 1 : -1;
    if (va > vb) return desc ? -1 : 1;
    return 0;
  });

  // Filter
  const filtered = sorted.filter((l) => {
    if (search && !l.nombre.toLowerCase().includes(search.toLowerCase())) return false;
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mis Lotes de Cría</h1>
          <p className="text-sm text-gray-500">
            {activeLotes.length} activo{activeLotes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowColPanel(true)}
            className="btn-secondary flex items-center gap-2 text-sm"
            title="Configurar columnas"
          >
            <Settings2 size={15} /> Columnas
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} /> Nuevo Lote
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(["activos", "finalizados"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-blue-700 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "activos" ? "Activos" : "Finalizados"}
            <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5">
              {tab === "activos" ? activeLotes.length : closedLotes.length}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre..."
            className="input-field pl-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {search && (
          <button
            onClick={() => setSearch("")}
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
        <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg p-4">
          <AlertCircle size={18} />
          Error al cargar los lotes. Inténtalo de nuevo.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Layers size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            {search
              ? "No hay lotes que coincidan con la búsqueda"
              : activeTab === "activos"
              ? "No tienes lotes activos. ¡Crea tu primer lote!"
              : "No hay lotes finalizados."}
          </p>
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
              {filtered.map((lote, i) => (
                <Fragment key={lote.id}>
                  <tr
                    className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${
                      i % 2 === 0 ? "" : "bg-gray-50/40"
                    }`}
                  >
                    {visibleCols.map((col) => (
                      <td key={col.id} className="px-3 py-2 whitespace-nowrap">
                        {col.render(lote)}
                      </td>
                    ))}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1 justify-end">
                        {/* Expandir hembras */}
                        {lote.hembras_anillas.length > 0 && (
                          <button
                            onClick={() => setExpandedId(expandedId === lote.id ? null : lote.id)}
                            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                            title={expandedId === lote.id ? "Ocultar hembras" : "Ver hembras"}
                          >
                            {expandedId === lote.id
                              ? <ChevronUp size={14} />
                              : <ChevronDown size={14} />}
                          </button>
                        )}
                        {/* Finalizar */}
                        {!lote.is_closed && (
                          <button
                            onClick={() => closeMutation.mutate(lote.id)}
                            disabled={closingId === lote.id && closeMutation.isPending}
                            className="btn-secondary text-xs py-1 px-2.5 shrink-0"
                          >
                            {closingId === lote.id && closeMutation.isPending
                              ? <Loader2 size={12} className="animate-spin" />
                              : "Finalizar"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Fila expandida — hembras */}
                  {expandedId === lote.id && (
                    <tr>
                      <td colSpan={visibleCols.length + 1} className="px-4 py-3 bg-pink-50/60 border-b border-pink-100">
                        <p className="text-xs font-semibold text-pink-700 mb-2">
                          Hembras del lote ({lote.hembras_anillas.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {lote.hembras_anillas.map((anilla) => (
                            <span
                              key={anilla}
                              className="text-xs bg-white text-pink-700 border border-pink-200 rounded px-2 py-0.5 font-mono"
                            >
                              ♀ {anilla}
                            </span>
                          ))}
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

      {showModal && <LoteModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
