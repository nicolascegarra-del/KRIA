import { Fragment, useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bird, Printer, Loader2, Search, Settings2,
  GripVertical, X, ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";
import { reproductoresApi } from "../../api/reproductores";
import type { Animal } from "../../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VARIEDAD_LABEL: Record<string, string> = {
  SALMON: "Salmón", PLATA: "Plata", SIN_DEFINIR: "Sin definir",
};

// ─── Columnas ─────────────────────────────────────────────────────────────────

interface ColDef {
  id: string;
  label: string;
  sortKey?: string;
  render: (a: Animal) => React.ReactNode;
}

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
    id: "variedad",
    label: "Variedad",
    render: (a) => (
      <span className="text-gray-600">{VARIEDAD_LABEL[a.variedad] ?? a.variedad ?? "—"}</span>
    ),
  },
  {
    id: "socio",
    label: "Propietario",
    sortKey: "socio_nombre",
    render: (a) => (
      <span className="text-sm text-gray-700">{a.socio_nombre ?? <span className="text-gray-300">—</span>}</span>
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
    id: "ganaderia",
    label: "Ganadería nac.",
    render: (a) => (
      <span className="text-xs text-gray-500">{a.ganaderia_nacimiento || <span className="text-gray-300">—</span>}</span>
    ),
  },
];

const DEFAULT_VISIBLE = ["foto", "anilla", "anio", "sexo", "variedad", "socio", "padre", "madre"];
const LS_KEY = "catalogo_reproductores_cols";

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
  const reset = () =>
    setLocal(ALL_COLS.map((c) => ({ id: c.id, visible: DEFAULT_VISIBLE.includes(c.id) })));

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-72 bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="font-semibold text-gray-800 text-sm">Configurar columnas</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-gray-500 px-4 pt-2 pb-1">
          Arrastra para reordenar · Marca para mostrar
        </p>
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
          <button onClick={reset} className="btn-secondary text-xs flex-1">
            Restablecer
          </button>
          <button onClick={save} className="btn-primary text-xs flex-1">
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CatalogoReproductoresPage() {
  const [search, setSearch] = useState("");
  const [filterSexo, setFilterSexo] = useState("");
  const [filterVariedad, setFilterVariedad] = useState("");
  const [filterAnio, setFilterAnio] = useState("");
  const [ordering, setOrdering] = useState("numero_anilla");
  const [colState, setColState] = useState<ColState[]>(loadColState);
  const [showColPanel, setShowColPanel] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(colState));
  }, [colState]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["reproductores-catalogo-all"],
    queryFn: () => reproductoresApi.catalogo({ page: 1, page_size: 10000 }),
  });

  const animals: Animal[] = data?.results ?? [];
  const total = data?.count ?? 0;

  // Opciones de filtro
  const availableYears = [...new Set(
    animals
      .map((a) => a.fecha_nacimiento ? new Date(a.fecha_nacimiento).getFullYear() : null)
      .filter((y): y is number => y !== null)
  )].sort((a, b) => b - a);

  const availableVariedades = [...new Set(animals.map((a) => a.variedad).filter(Boolean))];

  // Ordenación
  const sorted = [...animals].sort((a, b) => {
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

  // Filtrado
  const filtered = sorted.filter((a) => {
    if (search && !a.numero_anilla.toLowerCase().includes(search.toLowerCase()) &&
        !((a.socio_nombre ?? "").toLowerCase().includes(search.toLowerCase()))) return false;
    if (filterSexo && a.sexo !== filterSexo) return false;
    if (filterVariedad && a.variedad !== filterVariedad) return false;
    if (filterAnio && (!a.fecha_nacimiento || new Date(a.fecha_nacimiento).getFullYear() !== Number(filterAnio))) return false;
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

  const hasActiveFilters = search || filterSexo || filterVariedad || filterAnio;
  const resetFilters = () => {
    setSearch(""); setFilterSexo(""); setFilterVariedad(""); setFilterAnio("");
  };

  // ── Imprimir catálogo ──────────────────────────────────────────────────────
  const handlePrint = async () => {
    setPrinting(true);
    try {
      const toprint = filtered.length > 0 ? filtered : animals;
      const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Catálogo de Reproductores</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; }
  .page { width: 210mm; min-height: 297mm; padding: 20mm; page-break-after: always; display: flex; flex-direction: column; }
  .page:last-child { page-break-after: avoid; }
  .header { border-bottom: 3px solid #1565C0; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
  .header-title { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .header-num { font-size: 11px; color: #1565C0; font-weight: 700; }
  .animal-id { font-family: monospace; font-size: 28px; font-weight: 900; color: #1565C0; margin-bottom: 4px; }
  .animal-year { font-size: 16px; color: #666; margin-bottom: 16px; }
  .content { display: flex; gap: 24px; flex: 1; }
  .photo-area { width: 160px; flex-shrink: 0; }
  .photo { width: 160px; height: 180px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb; }
  .photo-placeholder { width: 160px; height: 180px; background: #f3f4f6; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #d1d5db; font-size: 40px; border: 1px solid #e5e7eb; }
  .info { flex: 1; }
  .section-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 2px; margin-top: 12px; }
  .section-label:first-child { margin-top: 0; }
  .section-value { font-size: 14px; color: #111; font-weight: 500; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; background: #dcfce7; color: #166534; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
  .footer { border-top: 1px solid #e5e7eb; padding-top: 10px; margin-top: 20px; font-size: 9px; color: #9ca3af; display: flex; justify-content: space-between; }
  @media print { @page { size: A4; margin: 0; } .page { width: 210mm; min-height: 297mm; } }
</style>
</head>
<body>
${toprint.map((a, i) => {
  const perfilFoto = a.fotos?.find(f => f.tipo === 'PERFIL');
  const cabezaFoto = a.fotos?.find(f => f.tipo === 'CABEZA');
  const year = a.fecha_nacimiento ? new Date(a.fecha_nacimiento).getFullYear() : '—';
  return `<div class="page">
  <div class="header">
    <div><div class="header-title">Catálogo de Reproductores Aprobados</div></div>
    <div class="header-num">Nº ${i + 1} / ${toprint.length}</div>
  </div>
  <div class="animal-id">${a.numero_anilla}</div>
  <div class="animal-year">Nacimiento: ${a.fecha_nacimiento ? new Date(a.fecha_nacimiento).toLocaleDateString('es-ES') : '—'} · Año ${year}</div>
  <div class="content">
    <div class="photo-area">
      ${perfilFoto ? `<img class="photo" src="${perfilFoto.url}" alt="Foto perfil" crossorigin="anonymous" />` : `<div class="photo-placeholder">🐦</div>`}
      ${cabezaFoto ? `<img class="photo" src="${cabezaFoto.url}" alt="Foto cabeza" crossorigin="anonymous" style="margin-top:8px" />` : ''}
    </div>
    <div class="info">
      <div class="section-label">Estado</div>
      <div><span class="badge">Reproductor Aprobado</span></div>
      <div class="grid2">
        <div>
          <div class="section-label">Sexo</div>
          <div class="section-value">${a.sexo === 'M' ? '♂ Macho' : '♀ Hembra'}</div>
        </div>
        <div>
          <div class="section-label">Variedad</div>
          <div class="section-value">${VARIEDAD_LABEL[a.variedad] ?? a.variedad ?? '—'}</div>
        </div>
        <div>
          <div class="section-label">Propietario</div>
          <div class="section-value">${a.socio_nombre ?? '—'}</div>
        </div>
        <div>
          <div class="section-label">Ganadería nacimiento</div>
          <div class="section-value">${a.ganaderia_nacimiento ?? '—'}</div>
        </div>
      </div>
      ${(a.padre_anilla || a.madre_anilla) ? `
      <div style="margin-top:12px; padding-top:12px; border-top:1px solid #f3f4f6;">
        <div class="section-label">Genealogía</div>
        ${a.padre_anilla ? `<div class="section-value" style="font-size:13px">Padre: <span style="font-family:monospace">${a.padre_anilla}</span>${a.padre_anio_nacimiento ? ` (${a.padre_anio_nacimiento})` : ''}</div>` : ''}
        ${a.madre_anilla ? `<div class="section-value" style="font-size:13px">Madre: <span style="font-family:monospace">${a.madre_anilla}</span>${a.madre_anio_nacimiento ? ` (${a.madre_anio_nacimiento})` : ''}</div>` : ''}
      </div>` : ''}
    </div>
  </div>
  <div class="footer">
    <span>KRIA — Catálogo de Reproductores</span>
    <span>Generado el ${new Date().toLocaleDateString('es-ES')}</span>
  </div>
</div>`;
}).join('')}
</body>
</html>`;

      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        setTimeout(() => { win.focus(); win.print(); }, 800);
      }
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Bird size={22} className="text-purple-600" />
            Catálogo de Reproductores
          </h1>
          <p className="text-sm text-gray-500">
            {total} reproductores aprobados
            {hasActiveFilters && filtered.length !== total && (
              <span className="ml-2 text-blue-600">· {filtered.length} mostrados</span>
            )}
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
          {total > 0 && (
            <button
              onClick={handlePrint}
              disabled={printing}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              {printing ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
              Imprimir{hasActiveFilters && filtered.length > 0 ? ` (${filtered.length})` : ""}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por anilla o propietario..."
            className="input-field pl-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-field w-auto text-sm"
          value={filterSexo}
          onChange={(e) => setFilterSexo(e.target.value)}
        >
          <option value="">♂♀ Todos</option>
          <option value="M">♂ Machos</option>
          <option value="H">♀ Hembras</option>
        </select>
        {availableVariedades.length > 1 && (
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
        {availableYears.length > 1 && (
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
          >
            <X size={14} /> Limpiar
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <div className="card text-center py-8 text-red-600">
          Error al cargar el catálogo. Comprueba la conexión.
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <Bird size={48} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {hasActiveFilters
              ? "No hay reproductores que coincidan con los filtros"
              : "No hay reproductores en el catálogo"}
          </p>
          {!hasActiveFilters && (
            <p className="text-sm text-gray-400 mt-1">
              Los animales aprobados como reproductores aparecerán aquí.
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
              {filtered.map((animal, i) => (
                <Fragment key={animal.id}>
                  <tr
                    className={`border-b border-gray-100 hover:bg-purple-50/30 transition-colors ${
                      i % 2 === 0 ? "" : "bg-gray-50/40"
                    }`}
                  >
                    {visibleCols.map((col) => (
                      <td key={col.id} className="px-3 py-2 whitespace-nowrap">
                        {col.render(animal)}
                      </td>
                    ))}
                  </tr>
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
