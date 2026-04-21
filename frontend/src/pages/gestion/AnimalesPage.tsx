import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, FileSpreadsheet, ChevronUp, ChevronDown, ChevronsUpDown, Settings2, X } from "lucide-react";
import { censoApi } from "../../api/animals";
import type { CensoFilters, CensoColumnDef } from "../../api/animals";
import { apiClient } from "../../api/client";

const LS_KEY = "animales_censo_columns";
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

function SortIcon({ col, orderBy, orderDir }: { col: string; orderBy: string; orderDir: string }) {
  if (orderBy !== col) return <ChevronsUpDown size={13} className="text-gray-300" />;
  return orderDir === "asc"
    ? <ChevronUp size={13} className="text-white" />
    : <ChevronDown size={13} className="text-white" />;
}

export default function AnimalesPage() {
  // Column picker
  const { data: colMeta } = useQuery({
    queryKey: ["censo-columnas"],
    queryFn: censoApi.getColumnas,
    staleTime: Infinity,
  });
  const allColumns: CensoColumnDef[] = colMeta?.columns ?? [];
  const defaultCols: string[] = colMeta?.defaults ?? [];

  const [selectedCols, setSelectedCols] = useState<string[] | null>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      return saved ? (JSON.parse(saved) as string[]) : null;
    } catch (_e) { return null; }
  });
  const activeCols = selectedCols ?? defaultCols;

  const [showColPicker, setShowColPicker] = useState(false);

  function toggleCol(key: string) {
    const next = activeCols.includes(key)
      ? activeCols.filter((k) => k !== key)
      : [...activeCols, key];
    setSelectedCols(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  }

  // Filters
  const [search, setSearch] = useState("");
  const [variedad, setVariedad] = useState("");
  const [estado, setEstado] = useState("");
  const [sexo, setSexo] = useState("");
  const [propietario, setPropietario] = useState<"" | "con" | "sin">("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // Sorting & pagination
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
  }), [search, variedad, estado, sexo, propietario, fechaDesde, fechaHasta, orderBy, orderDir, page]);

  const { data, isLoading } = useQuery({
    queryKey: ["censo-animales", filters],
    queryFn: () => censoApi.list(filters),
    placeholderData: (prev) => prev,
  });

  const totalPages = data ? Math.ceil(data.count / PAGE_SIZE) : 1;

  // Sortable columns
  const SORTABLE = new Set([
    "numero_anilla", "fecha_nacimiento", "sexo", "variedad",
    "estado", "socio_nombre", "ganaderia_nacimiento", "ganaderia_actual",
    "fecha_baja", "fecha_incubacion",
  ]);

  // Export
  async function handleExport(format: "pdf" | "excel") {
    const exportParams: Record<string, string> = { format, columns: activeCols.join(",") };
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

  const activeColDefs = allColumns.filter((c) => activeCols.includes(c.key));

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Animales</h1>
          {data && (
            <p className="text-sm text-gray-500 mt-0.5">{data.count} animales en total</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowColPicker((v) => !v)}
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

      {/* Column picker panel */}
      {showColPicker && (
        <div className="border border-gray-200 rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700">Columnas visibles</span>
            <button onClick={() => setShowColPicker(false)}><X size={16} className="text-gray-400" /></button>
          </div>
          <div className="flex flex-wrap gap-2">
            {allColumns.map((col) => (
              <label key={col.key} className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={activeCols.includes(col.key)}
                  onChange={() => toggleCol(col.key)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">{col.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          <input
            className="col-span-2 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Buscar anilla, propietario, ganadería..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
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
            onChange={(e) => { setEstado(e.target.value); setPage(1); }}
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
            placeholder="Nacimiento desde"
          />
          <input
            type="date"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={fechaHasta}
            onChange={(e) => { setFechaHasta(e.target.value); setPage(1); }}
            placeholder="Nacimiento hasta"
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
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={activeColDefs.length} className="text-center py-12 text-gray-400">
                  Cargando...
                </td>
              </tr>
            ) : !data?.results.length ? (
              <tr>
                <td colSpan={activeColDefs.length} className="text-center py-12 text-gray-400">
                  No hay animales con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              data.results.map((animal, i) => (
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
                </tr>
              ))
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
