import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Search,
  ArrowUp,
  ArrowDown,
  FileDown,
  FileSpreadsheet,
  Pencil,
  RefreshCw,
  Filter,
  X,
} from "lucide-react";
import { tablasApi } from "../../api/tablas";
import type { TablaEntrada, TablaColumna, TablaColumnaTipo } from "../../types";
import TablaFormModal from "../../components/tablas/TablaFormModal";
import clsx from "clsx";

const SOCIO_FIELD_LABELS: Record<string, string> = {
  numero_socio: "Nº Socio",
  nombre_razon_social: "Nombre / Razón Social",
  dni_nif: "DNI / NIF",
  email: "Email",
  telefono: "Teléfono",
  municipio: "Municipio",
  provincia: "Provincia",
  estado: "Estado",
  fecha_alta: "Fecha Alta",
  cuota_anual_pagada: "Cuota (año)",
};

const SORTABLE_SOCIO: Record<string, string> = {
  numero_socio: "numero_socio",
  nombre_razon_social: "nombre",
  estado: "estado",
};

type SortDir = "asc" | "desc";

export default function TablaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");
  const [sortKey, setSortKey] = useState("numero_socio");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showEdit, setShowEdit] = useState(false);
  const [exportLoading, setExportLoading] = useState<"pdf" | "excel" | null>(null);

  const { data: tabla, isLoading: loadingTabla } = useQuery({
    queryKey: ["tabla", id],
    queryFn: () => tablasApi.get(id!),
    enabled: !!id,
  });

  const { data: socioFields = [] } = useQuery({
    queryKey: ["tablas-socio-fields"],
    queryFn: tablasApi.getSocioFields,
  });

  const ordering = sortDir === "asc" ? sortKey : `-${sortKey}`;

  const { data: filas = [], isLoading: loadingFilas } = useQuery({
    queryKey: ["tabla-filas", id, search, estadoFilter, ordering],
    queryFn: () =>
      tablasApi.getFilas(id!, {
        search: search || undefined,
        estado: estadoFilter || undefined,
        ordering,
      }),
    enabled: !!id,
  });

  const syncMutation = useMutation({
    mutationFn: () => tablasApi.syncSocios(id!),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["tabla-filas", id] });
      if (data.added > 0) {
        alert(`Se han añadido ${data.added} nuevo(s) socio(s) a la tabla.`);
      }
    },
  });

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleExport = async (formato: "pdf" | "excel") => {
    if (!tabla) return;
    setExportLoading(formato);
    try {
      await tablasApi.export(id!, formato, tabla.nombre);
    } finally {
      setExportLoading(null);
    }
  };

  if (loadingTabla) {
    return (
      <div className="p-6">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!tabla) {
    return (
      <div className="p-6 text-center text-gray-500">
        Tabla no encontrada.{" "}
        <button onClick={() => navigate("/tablas")} className="underline">
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <button
          onClick={() => navigate("/tablas")}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft size={16} />
          Tablas
        </button>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900 flex-1 min-w-0 truncate">
          {tabla.nombre}
        </h1>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowEdit(true)}
            title="Editar tabla"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Pencil size={14} />
            Editar
          </button>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            title="Sincronizar nuevos socios"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncMutation.isPending ? "animate-spin" : ""} />
            Sincronizar
          </button>
          <button
            onClick={() => handleExport("pdf")}
            disabled={exportLoading !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-sm text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <FileDown size={14} />
            {exportLoading === "pdf" ? "Generando…" : "PDF"}
          </button>
          <button
            onClick={() => handleExport("excel")}
            disabled={exportLoading !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-200 text-sm text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet size={14} />
            {exportLoading === "excel" ? "Generando…" : "Excel"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar socio…"
            className="w-full pl-8 pr-8 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        >
          <option value="">Todos los estados</option>
          <option value="ALTA">Alta</option>
          <option value="BAJA">Baja</option>
        </select>

        {(search || estadoFilter) && (
          <button
            onClick={() => { setSearch(""); setEstadoFilter(""); }}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded-lg border border-gray-200"
          >
            <Filter size={12} />
            Limpiar filtros
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400 self-center">
          {loadingFilas ? "Cargando…" : `${filas.length} socios`}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white text-xs" style={{ background: "var(--color-primary)" }}>
              {tabla.socio_columns.map((field) => {
                const sortable = SORTABLE_SOCIO[field];
                return (
                  <th
                    key={field}
                    className={clsx(
                      "px-3 py-2.5 text-left whitespace-nowrap select-none",
                      sortable && "cursor-pointer hover:opacity-80"
                    )}
                    onClick={() => sortable && toggleSort(sortable)}
                  >
                    <div className="flex items-center gap-1">
                      {SOCIO_FIELD_LABELS[field] || field}
                      {sortable && sortKey === sortable && (
                        sortDir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      )}
                    </div>
                  </th>
                );
              })}
              {tabla.columnas.map((col) => (
                <th key={col.id} className="px-3 py-2.5 text-left whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    {col.nombre}
                    <span className="text-white/50 text-[10px]">
                      {col.tipo === "CHECKBOX" && "☑"}
                      {col.tipo === "TEXT" && "T"}
                      {col.tipo === "DATE" && "📅"}
                      {col.tipo === "NUMBER" && "#"}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loadingFilas ? (
              <tr>
                <td
                  colSpan={tabla.socio_columns.length + tabla.columnas.length}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  Cargando…
                </td>
              </tr>
            ) : filas.length === 0 ? (
              <tr>
                <td
                  colSpan={tabla.socio_columns.length + tabla.columnas.length}
                  className="px-4 py-10 text-center text-gray-400"
                >
                  No hay registros.
                </td>
              </tr>
            ) : (
              filas.map((entrada) => (
                <FilaRow
                  key={entrada.id}
                  entrada={entrada}
                  tabla={tabla}
                  onUpdated={() => qc.invalidateQueries({ queryKey: ["tabla-filas", id] })}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <TablaFormModal
          tablaId={id}
          socioFields={socioFields}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            qc.invalidateQueries({ queryKey: ["tabla", id] });
            qc.invalidateQueries({ queryKey: ["tabla-filas", id] });
            qc.invalidateQueries({ queryKey: ["tablas"] });
          }}
        />
      )}
    </div>
  );
}

// ── Fila de la tabla con edición inline ──────────────────────────────────────

function FilaRow({
  entrada,
  tabla,
  onUpdated,
}: {
  entrada: TablaEntrada;
  tabla: { socio_columns: string[]; columnas: TablaColumna[]; id: string };
  onUpdated: () => void;
}) {
  const getSocioValue = (field: string): string => {
    const map: Record<string, string | number | null | undefined> = {
      numero_socio: entrada.socio_numero,
      nombre_razon_social: entrada.socio_nombre,
      dni_nif: entrada.socio_dni,
      email: entrada.socio_email,
      telefono: entrada.socio_telefono,
      municipio: entrada.socio_municipio,
      provincia: entrada.socio_provincia,
      estado: entrada.socio_estado,
      fecha_alta: entrada.socio_fecha_alta,
      cuota_anual_pagada: entrada.socio_cuota_anual_pagada,
    };
    const val = map[field];
    if (val === null || val === undefined) return "—";
    return String(val);
  };

  const updateMutation = useMutation({
    mutationFn: (valores: Record<string, boolean | string | number | null>) =>
      tablasApi.updateEntrada(tabla.id, entrada.socio_id, valores),
    onSuccess: onUpdated,
  });

  const handleCellChange = useCallback(
    (colId: string, value: boolean | string | number | null) => {
      updateMutation.mutate({ [colId]: value });
    },
    [updateMutation]
  );

  const isEven = false; // Could track index externally; stripe handled via CSS

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      {tabla.socio_columns.map((field) => (
        <td key={field} className="px-3 py-2 whitespace-nowrap text-gray-700">
          {field === "estado" ? (
            <span
              className={clsx(
                "inline-block px-2 py-0.5 rounded-full text-xs font-semibold",
                entrada.socio_estado === "ALTA"
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500"
              )}
            >
              {entrada.socio_estado}
            </span>
          ) : (
            getSocioValue(field)
          )}
        </td>
      ))}
      {tabla.columnas.map((col) => (
        <td key={col.id} className="px-3 py-2">
          <EditableCell
            colId={col.id}
            tipo={col.tipo}
            value={entrada.valores[col.id] ?? (col.tipo === "CHECKBOX" ? false : "")}
            onChange={handleCellChange}
            saving={updateMutation.isPending}
          />
        </td>
      ))}
    </tr>
  );
}

// ── Celda editable según tipo ─────────────────────────────────────────────────

function EditableCell({
  colId,
  tipo,
  value,
  onChange,
  saving,
}: {
  colId: string;
  tipo: TablaColumnaTipo;
  value: boolean | string | number | null;
  onChange: (colId: string, value: boolean | string | number | null) => void;
  saving: boolean;
}) {
  const [localValue, setLocalValue] = useState(value);
  const [editing, setEditing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from server when not actively editing
  useEffect(() => {
    if (!editing) {
      setLocalValue(value);
    }
  }, [value, editing]);

  const commitChange = (val: boolean | string | number | null) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange(colId, val);
      setEditing(false);
    }, 400);
  };

  if (tipo === "CHECKBOX") {
    const checked = localValue === true || localValue === "true";
    return (
      <button
        onClick={() => {
          const next = !checked;
          setLocalValue(next);
          onChange(colId, next);
        }}
        disabled={saving}
        className={clsx(
          "w-6 h-6 rounded border-2 flex items-center justify-center transition-colors",
          checked
            ? "bg-green-500 border-green-500 text-white"
            : "bg-white border-gray-300 hover:border-green-400",
          saving && "opacity-60"
        )}
        title={checked ? "Marcar como No" : "Marcar como Sí"}
      >
        {checked && (
          <svg viewBox="0 0 10 8" className="w-3 h-2.5 fill-none stroke-white stroke-2">
            <polyline points="1,4 4,7 9,1" />
          </svg>
        )}
      </button>
    );
  }

  if (tipo === "DATE") {
    return (
      <input
        type="date"
        value={typeof localValue === "string" ? localValue : ""}
        onFocus={() => setEditing(true)}
        onChange={(e) => {
          setLocalValue(e.target.value);
          commitChange(e.target.value);
        }}
        disabled={saving}
        className="border border-gray-200 rounded px-2 py-1 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] disabled:opacity-60"
      />
    );
  }

  if (tipo === "NUMBER") {
    return (
      <input
        type="number"
        value={typeof localValue === "number" || typeof localValue === "string" ? String(localValue) : ""}
        onFocus={() => setEditing(true)}
        onChange={(e) => {
          setLocalValue(e.target.value);
          commitChange(e.target.value === "" ? null : Number(e.target.value));
        }}
        disabled={saving}
        className="border border-gray-200 rounded px-2 py-1 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] disabled:opacity-60"
      />
    );
  }

  // TEXT
  return (
    <input
      type="text"
      value={typeof localValue === "string" ? localValue : ""}
      onFocus={() => setEditing(true)}
      onChange={(e) => {
        setLocalValue(e.target.value);
        commitChange(e.target.value);
      }}
      disabled={saving}
      placeholder="—"
      className="border border-gray-200 rounded px-2 py-1 text-xs w-36 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] disabled:opacity-60 placeholder:text-gray-300"
    />
  );
}
