import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { sociosApi } from "../../api/socios";
import Modal from "../../components/Modal";
import ErrorAlert from "../../components/ErrorAlert";
import SuccessToast from "../../components/SuccessToast";
import { useAutoCloseError } from "../../hooks/useAutoCloseError";
import {
  Search, UserX, UserCheck, Loader2, Users, Plus, Pencil, ExternalLink,
  ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown,
  Settings2, GripVertical, X, Mail,
} from "lucide-react";
import type { Socio } from "../../types";

// ── Column definitions ────────────────────────────────────────────────────────

interface ColDef {
  id: string;
  label: string;
  sortKey?: string;
  render: (s: Socio) => React.ReactNode;
}

const ALL_COLS: ColDef[] = [
  {
    id: "numero_socio", label: "Nº Socio", sortKey: "numero_socio",
    render: (s) => s.numero_socio || <span className="text-gray-300">—</span>,
  },
  {
    id: "nombre", label: "Nombre / Razón Social", sortKey: "nombre_razon_social",
    render: (s) => <span className="font-medium text-gray-900">{s.nombre_razon_social}</span>,
  },
  {
    id: "estado", label: "Estado",
    render: (s) => (
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.estado === "ALTA" ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}`}>
        {s.estado}
      </span>
    ),
  },
  {
    id: "dni_nif", label: "DNI / NIF",
    render: (s) => <span className="font-mono">{s.dni_nif}</span>,
  },
  {
    id: "email", label: "Email",
    render: (s) => <span className="text-gray-600">{s.email}</span>,
  },
  {
    id: "cuota", label: "Cuota",
    render: (s) => s.cuota_anual_pagada
      ? <span className="text-green-700 font-medium">{s.cuota_anual_pagada}</span>
      : <span className="text-gray-300 text-sm">—</span>,
  },
  {
    id: "telefono", label: "Teléfono",
    render: (s) => <span className="text-gray-600">{s.telefono || <span className="text-gray-300">—</span>}</span>,
  },
  {
    id: "codigo_rega", label: "REGA",
    render: (s) => <span className="text-sm text-gray-600 font-mono">{s.codigo_rega || <span className="text-gray-300">—</span>}</span>,
  },
  {
    id: "fecha_alta", label: "Fecha Alta",
    render: (s) => s.fecha_alta
      ? <span className="text-gray-600">{new Date(s.fecha_alta).toLocaleDateString("es-ES")}</span>
      : <span className="text-gray-300 text-sm">—</span>,
  },
  {
    id: "domicilio", label: "Domicilio",
    render: (s) => <span className="text-sm text-gray-600 max-w-[200px] truncate block">{s.domicilio || <span className="text-gray-300">—</span>}</span>,
  },
  {
    id: "municipio", label: "Municipio",
    render: (s) => <span className="text-sm text-gray-600">{s.municipio || <span className="text-gray-300">—</span>}</span>,
  },
  {
    id: "provincia", label: "Provincia",
    render: (s) => <span className="text-sm text-gray-600">{s.provincia || <span className="text-gray-300">—</span>}</span>,
  },
  {
    id: "numero_cuenta", label: "Cuenta",
    render: (s) => <span className="text-sm font-mono text-gray-600">{s.numero_cuenta || <span className="text-gray-300">—</span>}</span>,
  },
  {
    id: "razon_baja", label: "Razón baja",
    render: (s) => s.razon_baja
      ? <span className="text-xs text-red-700 max-w-[200px] truncate block">{s.razon_baja}</span>
      : <span className="text-gray-300 text-sm">—</span>,
  },
  {
    id: "portal_access", label: "Acceso portal",
    render: (s) => {
      if (s.portal_access_status === "active") {
        return (
          <span className="flex items-center gap-1.5 text-xs font-medium text-green-700">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            Activo
          </span>
        );
      }
      if (s.portal_access_status === "pending") {
        return (
          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            Pendiente
          </span>
        );
      }
      return (
        <span className="flex items-center gap-1.5 text-xs font-medium text-red-500">
          <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
          Sin acceso
        </span>
      );
    },
  },
];

const DEFAULT_VISIBLE = ["numero_socio", "nombre", "estado", "dni_nif", "email", "cuota", "portal_access"];
const LS_KEY = "socios_table_cols";

interface ColState { id: string; visible: boolean; }

function loadColState(): ColState[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const saved: ColState[] = JSON.parse(raw);
      // Merge: add any new columns not yet in saved state
      const ids = new Set(saved.map((c) => c.id));
      const merged = [...saved];
      ALL_COLS.forEach((c) => { if (!ids.has(c.id)) merged.push({ id: c.id, visible: false }); });
      return merged;
    }
  } catch {}
  return ALL_COLS.map((c) => ({ id: c.id, visible: DEFAULT_VISIBLE.includes(c.id) }));
}

// ── Socio Form Modal ──────────────────────────────────────────────────────────

interface SocioFormData {
  nombre_razon_social: string;
  dni_nif: string;
  email: string;
  telefono: string;
  numero_socio: string;
  codigo_rega: string;
  domicilio: string;
  municipio: string;
  codigo_postal: string;
  provincia: string;
  numero_cuenta: string;
  fecha_alta?: string;
  initial_password?: string;
  new_password?: string;
  cuota_anual_pagada?: string;
}

type ModalMode = "create" | "edit";

function SocioModal({
  mode, socio, onClose, onSuccess,
}: {
  mode: ModalMode; socio?: Socio | null; onClose: () => void; onSuccess: (msg: string) => void;
}) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<SocioFormData>({
    defaultValues: mode === "edit" && socio ? {
      nombre_razon_social: socio.nombre_razon_social ?? "",
      dni_nif: socio.dni_nif ?? "",
      email: socio.email ?? "",
      telefono: socio.telefono ?? "",
      numero_socio: socio.numero_socio ?? "",
      codigo_rega: socio.codigo_rega ?? "",
      domicilio: socio.domicilio ?? "",
      municipio: socio.municipio ?? "",
      codigo_postal: socio.codigo_postal ?? "",
      provincia: socio.provincia ?? "",
      numero_cuenta: socio.numero_cuenta ?? "",
      fecha_alta: socio.fecha_alta ?? "",
      cuota_anual_pagada: socio.cuota_anual_pagada ? String(socio.cuota_anual_pagada) : "",
    } : {},
  });
  const [error, setError, clearError] = useAutoCloseError();

  const createMutation = useMutation({
    mutationFn: (data: Partial<Socio>) => sociosApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["socios"] }); qc.invalidateQueries({ queryKey: ["socios-all"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] }); onSuccess("Socio creado correctamente."); onClose(); },
    onError: (err: any) => {
      const d = err?.response?.data;
      setError(d?.detail ?? (typeof d === "object" ? Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ") : "Error al guardar."));
    },
  });
  const editMutation = useMutation({
    mutationFn: (data: Partial<Socio>) => sociosApi.update(socio!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["socios"] }); qc.invalidateQueries({ queryKey: ["socios-all"] }); onSuccess("Socio actualizado correctamente."); onClose(); },
    onError: (err: any) => {
      const d = err?.response?.data;
      setError(d?.detail ?? (typeof d === "object" ? Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ") : "Error al guardar."));
    },
  });
  const isPending = createMutation.isPending || editMutation.isPending;

  const onSubmit = (data: SocioFormData) => {
    clearError();
    const payload: any = {
      nombre_razon_social: data.nombre_razon_social, dni_nif: data.dni_nif,
      telefono: data.telefono || undefined, numero_socio: data.numero_socio || undefined,
      codigo_rega: data.codigo_rega || undefined,
      domicilio: data.domicilio || undefined,
      municipio: data.municipio || undefined,
      codigo_postal: data.codigo_postal || undefined,
      provincia: data.provincia || undefined,
      numero_cuenta: data.numero_cuenta || undefined,
      fecha_alta: data.fecha_alta || undefined,
      cuota_anual_pagada: data.cuota_anual_pagada ? parseInt(data.cuota_anual_pagada) : undefined,
    };
    if (mode === "create") {
      if (data.email) payload.email = data.email;
      if (data.initial_password) payload.initial_password = data.initial_password;
      createMutation.mutate(payload);
    } else {
      if (data.email) payload.email = data.email;
      if (data.new_password) payload.new_password = data.new_password;
      editMutation.mutate(payload);
    }
  };

  return (
    <Modal title={mode === "create" ? "Nuevo Socio" : "Editar Socio"} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Identificación */}
          <div className="col-span-2 sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre / Razón Social *</label>
            <input className="input-field" {...register("nombre_razon_social", { required: true })} />
            {errors.nombre_razon_social && <p className="text-xs text-red-600 mt-1">Requerido</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nº Socio</label>
            <input className="input-field" {...register("numero_socio")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DNI / NIF</label>
            <input className="input-field" {...register("dni_nif")} />
            {errors.dni_nif && <p className="text-xs text-red-600 mt-1">Formato inválido</p>}
          </div>
          {/* Contacto */}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email{mode === "create" && <span className="font-normal text-gray-400"> (opcional — para acceso al portal)</span>}
              {mode === "edit" && <span className="font-normal text-gray-400"> (credencial de acceso)</span>}
            </label>
            <input type="email" className="input-field" {...register("email")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input className="input-field" {...register("telefono")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código REGA</label>
            <input className="input-field" {...register("codigo_rega")} />
          </div>
          {/* Dirección */}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Domicilio</label>
            <input className="input-field" placeholder="Calle, número, piso..." {...register("domicilio")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Municipio</label>
            <input className="input-field" {...register("municipio")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código postal</label>
            <input className="input-field" {...register("codigo_postal")} />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
            <input className="input-field" {...register("provincia")} />
          </div>
          {/* Datos de asociado */}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Número de cuenta (IBAN)</label>
            <input className="input-field" placeholder="ES00 0000 0000..." {...register("numero_cuenta")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de alta</label>
            <input type="date" className="input-field" {...register("fecha_alta")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cuota anual <span className="font-normal text-gray-400">(año)</span></label>
            <input type="number" className="input-field" placeholder="p.ej. 2025" min="2000" max="2100" {...register("cuota_anual_pagada")} />
          </div>
        </div>
        {mode === "create" ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña inicial <span className="font-normal text-gray-400">(vacío = auto-generar y enviar por email)</span></label>
            <input type="text" className="input-field" {...register("initial_password")} placeholder="Dejar vacío para generar automáticamente" />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña <span className="font-normal text-gray-400">(vacío = sin cambios)</span></label>
            <input type="text" className="input-field" {...register("new_password")} placeholder="Dejar vacío para no cambiar" />
          </div>
        )}
        <ErrorAlert message={error} onDismiss={clearError} />
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={isPending} className="btn-primary flex-1">
            {isPending ? <Loader2 size={16} className="animate-spin" /> : mode === "create" ? "Crear Socio" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Column config panel ───────────────────────────────────────────────────────

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
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />
      {/* Panel */}
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SociosPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("ALTA");
  const [filterCuota, setFilterCuota] = useState("");
  const [ordering, setOrdering] = useState("numero_socio");
  const [page, setPage] = useState(1);
  const [bajaModal, setBajaModal] = useState<Socio | null>(null);
  const [bajaMotivoKey, setBajaMotivoKey] = useState<"voluntaria" | "impago" | "otros" | "">("");
  const [bajaObservaciones, setBajaObservaciones] = useState("");
  const [bajaFecha, setBajaFecha] = useState(new Date().toISOString().split("T")[0]);
  const [socioModal, setSocioModal] = useState<{ mode: ModalMode; socio?: Socio } | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [colState, setColState] = useState<ColState[]>(loadColState);
  const [showColPanel, setShowColPanel] = useState(false);
  const [sendingAccessId, setSendingAccessId] = useState<string | null>(null);

  // Persist column config
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(colState));
  }, [colState]);

  const resetPage = (fn: () => void) => { fn(); setPage(1); };

  const { data, isLoading } = useQuery({
    queryKey: ["socios", search, filterEstado, filterCuota, ordering, page],
    queryFn: () => sociosApi.list({
      search: search || undefined,
      estado: filterEstado || undefined,
      cuota: filterCuota || undefined,
      ordering,
      page,
    }),
  });

  const bajaMutation = useMutation({
    mutationFn: ({ id, razon, fecha }: { id: string; razon: string; fecha: string }) =>
      sociosApi.darBaja(id, razon, fecha),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["socios"] }); qc.invalidateQueries({ queryKey: ["socios-all"] }); qc.invalidateQueries({ queryKey: ["animals"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] }); setBajaModal(null); setSuccessMsg("Socio dado de baja."); },
  });

  const reactivarMutation = useMutation({
    mutationFn: (id: string) => sociosApi.reactivar(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["socios"] }); qc.invalidateQueries({ queryKey: ["socios-all"] }); qc.invalidateQueries({ queryKey: ["animals"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] }); setSuccessMsg("Socio reactivado correctamente."); },
  });

  const enviarAccesoMutation = useMutation({
    mutationFn: (id: string) => { setSendingAccessId(id); return sociosApi.enviarAcceso(id); },
    onSuccess: () => { setSendingAccessId(null); setSuccessMsg("Correo de acceso enviado correctamente."); },
    onError: () => { setSendingAccessId(null); setSuccessMsg("No se pudo enviar el correo. Comprueba que el socio tiene email."); },
  });

  const socios = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / 50);

  // Visible columns in user-defined order
  const visibleCols = colState
    .filter((cs) => cs.visible)
    .map((cs) => ALL_COLS.find((c) => c.id === cs.id)!)
    .filter(Boolean);

  const sortIcon = (sortKey?: string) => {
    if (!sortKey) return null;
    if (ordering === sortKey) return <ArrowUp size={13} className="text-blue-600" />;
    if (ordering === `-${sortKey}`) return <ArrowDown size={13} className="text-blue-600" />;
    return <ArrowUpDown size={13} className="text-gray-300" />;
  };

  const handleSort = (sortKey?: string) => {
    if (!sortKey) return;
    setOrdering((prev) => prev === sortKey ? `-${sortKey}` : sortKey);
    setPage(1);
  };

  const yearNow = new Date().getFullYear();

  return (
    <div className="space-y-4">
      <SuccessToast message={successMsg} onDismiss={() => setSuccessMsg("")} />

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Socios</h1>
          <p className="text-sm text-gray-500">{totalCount} socios</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowColPanel(true)}
            className="btn-secondary flex items-center gap-2 text-sm"
            title="Configurar columnas"
          >
            <Settings2 size={15} /> Columnas
          </button>
          <button onClick={() => setSocioModal({ mode: "create" })} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nuevo Socio
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, DNI, email o número de socio..."
          className="input-field pl-9"
          value={search}
          onChange={(e) => resetPage(() => setSearch(e.target.value))}
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select className="input-field w-44 text-sm" value={filterEstado} onChange={(e) => resetPage(() => setFilterEstado(e.target.value))}>
          <option value="">Todos los estados</option>
          <option value="ALTA">Alta</option>
          <option value="BAJA">Baja</option>
        </select>
        <select className="input-field w-44 text-sm" value={filterCuota} onChange={(e) => resetPage(() => setFilterCuota(e.target.value))}>
          <option value="">Cualquier cuota</option>
          {[yearNow, yearNow - 1, yearNow - 2].map((y) => (
            <option key={y} value={String(y)}>Cuota {y}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4].map((i) => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-lg" />)}
        </div>
      ) : socios.length === 0 ? (
        <div className="card text-center py-8">
          <Users size={40} className="text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">No se encontraron socios.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {visibleCols.map((col) => (
                  <th
                    key={col.id}
                    className={`px-3 py-1.5 text-left font-semibold text-gray-600 text-xs whitespace-nowrap ${col.sortKey ? "cursor-pointer hover:bg-gray-100 select-none" : ""}`}
                    onClick={() => handleSort(col.sortKey)}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sortIcon(col.sortKey)}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-1.5 text-right font-semibold text-gray-600 text-xs">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {socios.map((socio, i) => (
                <tr
                  key={socio.id}
                  className={`border-b border-gray-100 hover:bg-blue-50/40 transition-colors ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}
                >
                  {visibleCols.map((col) => (
                    <td key={col.id} className="px-3 py-1 whitespace-nowrap">
                      {col.render(socio)}
                    </td>
                  ))}
                  <td className="px-3 py-1 whitespace-nowrap">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => navigate(`/socios/${socio.id}`)}
                        className="p-2 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Ver ficha"
                      >
                        <ExternalLink size={14} />
                      </button>
                      <button
                        onClick={() => setSocioModal({ mode: "edit", socio })}
                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => enviarAccesoMutation.mutate(socio.id)}
                        disabled={sendingAccessId === socio.id || !socio.email}
                        className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title={socio.email ? "Enviar acceso por email" : "El socio no tiene email configurado"}
                      >
                        {sendingAccessId === socio.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Mail size={14} />}
                      </button>
                      {socio.estado === "ALTA" ? (
                        <button
                          onClick={() => { setBajaModal(socio); setBajaMotivoKey(""); setBajaObservaciones(""); setBajaFecha(new Date().toISOString().split("T")[0]); }}
                          className="p-2 rounded-lg text-red-600 hover:bg-red-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="Dar de baja"
                        >
                          <UserX size={14} />
                        </button>
                      ) : (
                        <button
                          onClick={() => reactivarMutation.mutate(socio.id)}
                          disabled={reactivarMutation.isPending}
                          className="p-2 rounded-lg text-green-600 hover:bg-green-50 disabled:opacity-40 min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="Reactivar socio"
                        >
                          <UserCheck size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-sm text-gray-500">Página {page} de {totalPages} · {totalCount} socios</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary p-2 min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-40">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary p-2 min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-40">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showColPanel && (
        <ColConfigPanel cols={colState} onChange={setColState} onClose={() => setShowColPanel(false)} />
      )}

      {socioModal && (
        <SocioModal mode={socioModal.mode} socio={socioModal.socio} onClose={() => setSocioModal(null)} onSuccess={setSuccessMsg} />
      )}

      {bajaModal && (() => {
        const razonFinal = bajaMotivoKey === "otros"
          ? `Otros: ${bajaObservaciones.trim()}`
          : bajaMotivoKey === "voluntaria" ? "Voluntaria"
          : bajaMotivoKey === "impago" ? "Impago"
          : "";
        const canSubmit = !!bajaMotivoKey && (bajaMotivoKey !== "otros" || bajaObservaciones.trim().length > 0) && !!bajaFecha;
        return (
          <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
            <div role="dialog" aria-modal="true" className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Dar de Baja a Socio</h2>
              <p className="text-gray-600">Socio: <strong>{bajaModal.nombre_razon_social}</strong></p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                ⚠️ Todos los animales del socio pasarán a estado "Socio en Baja".
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de baja *</label>
                <input
                  type="date"
                  className="input-field"
                  value={bajaFecha}
                  onChange={(e) => setBajaFecha(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo *</label>
                <select
                  className="input-field"
                  value={bajaMotivoKey}
                  onChange={(e) => { setBajaMotivoKey(e.target.value as typeof bajaMotivoKey); setBajaObservaciones(""); }}
                  autoFocus
                >
                  <option value="">Seleccionar motivo...</option>
                  <option value="voluntaria">Voluntaria</option>
                  <option value="impago">Impago</option>
                  <option value="otros">Otros</option>
                </select>
              </div>
              {bajaMotivoKey === "otros" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones *</label>
                  <textarea
                    className="input-field h-20 resize-none"
                    value={bajaObservaciones}
                    onChange={(e) => setBajaObservaciones(e.target.value)}
                    placeholder="Describe el motivo de la baja..."
                    autoFocus
                  />
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setBajaModal(null)} className="btn-secondary flex-1">Cancelar</button>
                <button
                  onClick={() => bajaMutation.mutate({ id: bajaModal.id, razon: razonFinal, fecha: bajaFecha })}
                  disabled={!canSubmit || bajaMutation.isPending}
                  className="btn-danger flex-1 disabled:opacity-50"
                >
                  {bajaMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : "Confirmar Baja"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
