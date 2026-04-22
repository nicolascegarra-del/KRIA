import { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText, FileSpreadsheet, ChevronUp, ChevronDown, ChevronsUpDown,
  Settings2, X, GripVertical, Pencil, RotateCcw, Check,
} from "lucide-react";
import { censoApi, animalsApi } from "../../api/animals";
import type { CensoFilters, CensoColumnDef } from "../../api/animals";
import { apiClient } from "../../api/client";
import { useTenantStore } from "../../store/tenantStore";

const LS_KEY = "animales_censo_columns_v2";
const PAGE_SIZE = 50;

const ESTADO_LABELS: Record<string, string> = {
  REGISTRADO: "Registrado", MODIFICADO: "Modificado", APROBADO: "Aprobado",
  EVALUADO: "Evaluado", RECHAZADO: "Rechazado", SOCIO_EN_BAJA: "Socio en baja", BAJA: "Baja",
};

const ESTADO_COLORS: Record<string, string> = {
  REGISTRADO: "bg-yellow-100 text-yellow-800",
  MODIFICADO: "bg-blue-100 text-blue-800",
  APROBADO: "bg-green-100 text-green-800",
  EVALUADO: "bg-amber-100 text-amber-800",
  RECHAZADO: "bg-red-100 text-red-800",
  SOCIO_EN_BAJA: "bg-gray-100 text-gray-600",
  BAJA: "bg-gray-200 text-gray-500",
};

interface ColState { key: string; visible: boolean; }

function SortIcon({ col, orderBy, orderDir }: { col: string; orderBy: string; orderDir: string }) {
  if (orderBy !== col) return <ChevronsUpDown size={13} className="text-gray-300" />;
  return orderDir === "asc"
    ? <ChevronUp size={13} className="text-white" />
    : <ChevronDown size={13} className="text-white" />;
}

function ColConfigPanel({
  allColumns, colState, onChange, onClose,
}: {
  allColumns: CensoColumnDef[];
  colState: ColState[];
  onChange: (s: ColState[]) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<ColState[]>(colState);
  const dragIdx = useRef<number | null>(null);

  const toggleVisible = (key: string) =>
    setLocal((prev) => prev.map((c) => c.key === key ? { ...c, visible: !c.visible } : c));

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
  const reset = () => setLocal(allColumns.map((c) => ({ key: c.key, visible: true })));

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
            const def = allColumns.find((c) => c.key === cs.key);
            if (!def) return null;
            return (
              <li
                key={cs.key}
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
                  onChange={() => toggleVisible(cs.key)}
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

const ESTADOS_NO_ACTIVOS = new Set(["BAJA", "RECHAZADO", "SOCIO_EN_BAJA"]);

export default function AnimalesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { branding } = useTenantStore();
  const allowModifications = branding?.allow_animal_modifications !== false;
  const { data: colMeta } = useQuery({
    queryKey: ["censo-columnas"],
    queryFn: censoApi.getColumnas,
    staleTime: Infinity,
  });
  const allColumns: CensoColumnDef[] = colMeta?.columns ?? [];
  const defaultCols: string[] = colMeta?.defaults ?? [];

  const [colState, setColState] = useState<ColState[] | null>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      return saved ? (JSON.parse(saved) as ColState[]) : null;
    } catch { return null; }
  });
  const [showColPanel, setShowColPanel] = useState(false);

  const effectiveColState: ColState[] = colState ?? allColumns.map((c) => ({ key: c.key, visible: defaultCols.includes(c.key) }));

  function handleColChange(next: ColState[]) {
    setColState(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  }

  // Merge new columns that may not be in saved state
  const mergedColState: ColState[] = (() => {
    const saved = effectiveColState;
    const savedKeys = new Set(saved.map((c) => c.key));
    return [
      ...saved,
      ...allColumns.filter((c) => !savedKeys.has(c.key)).map((c) => ({ key: c.key, visible: false })),
    ];
  })();

  const activeColDefs = mergedColState
    .filter((cs) => cs.visible)
    .map((cs) => allColumns.find((c) => c.key === cs.key))
    .filter(Boolean) as CensoColumnDef[];

  // Filters
  const [search, setSearch] = useState("");
  const [activo, setActivo] = useState<"" | "true" | "false">("");
  const [variedad, setVariedad] = useState("");
  const [estado, setEstado] = useState("");
  const [sexo, setSexo] = useState("");
  const [propietario, setPropietario] = useState<"" | "con" | "sin">("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const [orderBy, setOrderBy] = useState("numero_anilla");
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  function handleSort(col: string) {
    if (orderBy === col) {
      setOrderDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setOrderBy(col);
      setOrderDir("asc");
    }
    setPage(1);
  }

  const filters: CensoFilters = useMemo(() => ({
    search: search || undefined,
    activo: activo || undefined,
    variedad: variedad || undefined,
    estado: estado || undefined,
    sexo: sexo || undefined,
    propietario: propietario || undefined,
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
    order_by: orderBy,
    order_dir: orderDir,
    page,
    page_size: PAGE_SIZE,
  }), [search, activo, variedad, estado, sexo, propietario, fechaDesde, fechaHasta, orderBy, orderDir, page]);

  const { data, isLoading } = useQuery({
    queryKey: ["censo-animales", filters],
    queryFn: () => censoApi.list(filters),
    placeholderData: (prev) => prev,
  });

  const totalPages = data ? Math.ceil(data.count / PAGE_SIZE) : 1;

  const [confirmReactivar, setConfirmReactivar] = useState<string | null>(null);

  const reactivarMutation = useMutation({
    mutationFn: (id: string) => animalsApi.reactivar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["censo-animales"] });
      setConfirmReactivar(null);
    },
  });

  const SORTABLE = new Set([
    "numero_anilla", "fecha_nacimiento", "sexo", "variedad",
    "estado", "socio_nombre", "ganaderia_nacimiento", "ganaderia_actual",
    "fecha_baja", "fecha_incubacion",
  ]);

  async function handleExport(format: "pdf" | "excel") {
    const exportParams: Record<string, string> = { format, columns: mergedColState.filter(c => c.visible).map(c => c.key).join(",") };
    const filterEntries = Object.entries(filters) as [string, unknown][];
    for (const [k, v] of filterEntries) {
      if (k === "page" || k === "page_size") continue;
      if (v !== undefined && v !== "") exportParams[k] = String(v);
    }
    const query = new URLSearchParams(exportParams).toString();
    const url = `/animals/censo/export/?${query}`;
    const { data: blob } = await apiClient.get(url, { responseType: "blob" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = format === "pdf" ? "censo_animales.pdf" : "censo_animales.xlsx";
    a.click();
    URL.revokeObjectURL(href);
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {showColPanel && (
        <ColConfigPanel
          allColumns={allColumns}
          colState={mergedColState}
          onChange={handleColChange}
          onClose={() => setShowColPanel(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Animales</h1>
          {data && (
            <p className="text-sm text-gray-500 mt-0.5">{data.count} animales</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowColPanel(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <Settings2 size={15} /> Columnas
          </button>
          <button
            onClick={() => handleExport("excel")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <FileSpreadsheet size={15} /> Excel
          </button>
          <button
            onClick={() => handleExport("pdf")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <FileText size={15} /> PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <input
            className="col-span-2 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Buscar anilla, propietario, ganadería..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <select
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={activo}
            onChange={(e) => { setActivo(e.target.value as "" | "true" | "false"); setEstado(""); setPage(1); }}
          >
            <option value="">Activos y no activos</option>
            <option value="true">Solo activos</option>
            <option value="false">Solo no activos</option>
          </select>
          <select
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={variedad}
            onChange={(e) => { setVariedad(e.target.value); setPage(1); }}
          >
            <option value="">Todas las variedades</option>
            <option value="SALMON">Salmón</option>
            <option value="PLATA">Plata</option>
            <option value="SIN_DEFINIR">Sin definir</option>
          </select>
          <select
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={estado}
            onChange={(e) => { setEstado(e.target.value); setActivo(""); setPage(1); }}
          >
            <option value="">Todos los estados</option>
            {Object.entries(ESTADO_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={sexo}
            onChange={(e) => { setSexo(e.target.value); setPage(1); }}
          >
            <option value="">Todos los sexos</option>
            <option value="M">Macho</option>
            <option value="H">Hembra</option>
          </select>
          <select
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={propietario}
            onChange={(e) => { setPropietario(e.target.value as "" | "con" | "sin"); setPage(1); }}
          >
            <option value="">Con y sin propietario</option>
            <option value="con">Con propietario</option>
            <option value="sin">Sin propietario</option>
          </select>
          <input
            type="date"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={fechaDesde}
            onChange={(e) => { setFechaDesde(e.target.value); setPage(1); }}
            title="Nacimiento desde"
          />
          <input
            type="date"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={fechaHasta}
            onChange={(e) => { setFechaHasta(e.target.value); setPage(1); }}
            title="Nacimiento hasta"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {activeColDefs.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-semibold text-white bg-[#051937] whitespace-nowrap select-none"
                  style={{ cursor: SORTABLE.has(col.key) ? "pointer" : "default" }}
                  onClick={() => SORTABLE.has(col.key) && handleSort(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {SORTABLE.has(col.key) && (
                      <SortIcon col={col.key} orderBy={orderBy} orderDir={orderDir} />
                    )}
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-semibold text-white bg-[#051937] whitespace-nowrap w-24">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={activeColDefs.length + 1} className="text-center py-12 text-gray-400">
                  Cargando...
                </td>
              </tr>
            ) : !data?.results.length ? (
              <tr>
                <td colSpan={activeColDefs.length + 1} className="text-center py-12 text-gray-400">
                  No hay animales con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              data.results.map((animal, i) => {
                const isNoActivo = ESTADOS_NO_ACTIVOS.has(animal.estado);
                const isConfirmingReactivar = confirmReactivar === animal.id;
                return (
                  <tr key={animal.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    {activeColDefs.map((col) => {
                      const val = animal[col.key] ?? "";
                      if (col.key === "estado") {
                        return (
                          <td key={col.key} className="px-4 py-2.5 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[val] ?? "bg-gray-100 text-gray-600"}`}>
                              {ESTADO_LABELS[val] ?? val}
                            </span>
                          </td>
                        );
                      }
                      if (col.key === "socio_nombre") {
                        return (
                          <td key={col.key} className="px-4 py-2.5 whitespace-nowrap">
                            {val || <span className="text-gray-400 italic">Sin propietario</span>}
                          </td>
                        );
                      }
                      return (
                        <td key={col.key} className="px-4 py-2.5 whitespace-nowrap text-gray-700">
                          {val}
                        </td>
                      );
                    })}

                    {/* Acciones */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {/* Editar — solo si la asociación tiene permiso de modificaciones */}
                        {allowModifications && (
                          animal.socio_id ? (
                            <button
                              title="Editar animal"
                              onClick={() => navigate(`/socios/${animal.socio_id}/animales/${animal.id}?returnTo=/animales`)}
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <Pencil size={14} />
                            </button>
                          ) : (
                            <span className="p-1.5 text-gray-300" title="Sin propietario asignado">
                              <Pencil size={14} />
                            </span>
                          )
                        )}

                        {/* Reactivar (solo para no activos) */}
                        {isNoActivo && (
                          isConfirmingReactivar ? (
                            <div className="flex items-center gap-1">
                              <button
                                title="Confirmar reactivación"
                                onClick={() => reactivarMutation.mutate(animal.id)}
                                disabled={reactivarMutation.isPending}
                                className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                title="Cancelar"
                                onClick={() => setConfirmReactivar(null)}
                                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              title="Reactivar animal"
                              onClick={() => setConfirmReactivar(animal.id)}
                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors"
                            >
                              <RotateCcw size={14} />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Página {page} de {totalPages} · {data?.count} registros
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Anterior
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
