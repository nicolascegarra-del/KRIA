import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { X, Plus, Trash2, GripVertical } from "lucide-react";
import { tablasApi } from "../../api/tablas";
import type { SocioFieldOption, TablaColumnaTipo } from "../../types";

const TIPO_LABELS: Record<TablaColumnaTipo, string> = {
  CHECKBOX: "Casilla (Sí/No)",
  TEXT: "Texto libre",
  DATE: "Fecha",
  NUMBER: "Número",
};

interface ColumnaForm {
  tempId: string;
  nombre: string;
  tipo: TablaColumnaTipo;
}

interface Props {
  tablaId?: string;
  socioFields: SocioFieldOption[];
  onClose: () => void;
  onSaved: () => void;
}

export default function TablaFormModal({ tablaId, socioFields, onClose, onSaved }: Props) {
  const isEdit = !!tablaId;

  const [nombre, setNombre] = useState("");
  const [selectedSocioFields, setSelectedSocioFields] = useState<string[]>([
    "numero_socio",
    "nombre_razon_social",
  ]);
  const [columnas, setColumnas] = useState<ColumnaForm[]>([
    { tempId: crypto.randomUUID(), nombre: "", tipo: "CHECKBOX" },
  ]);
  const [error, setError] = useState("");

  // Load existing table for editing
  const { data: existing } = useQuery({
    queryKey: ["tabla", tablaId],
    queryFn: () => tablasApi.get(tablaId!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setNombre(existing.nombre);
      setSelectedSocioFields(existing.socio_columns);
      setColumnas(
        existing.columnas.map((c) => ({
          tempId: c.id,
          nombre: c.nombre,
          tipo: c.tipo,
        }))
      );
    }
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: (data: Parameters<typeof tablasApi.create>[0]) =>
      isEdit ? tablasApi.update(tablaId!, data) : tablasApi.create(data),
    onSuccess: onSaved,
    onError: () => setError("Error al guardar la tabla. Revisa los datos."),
  });

  const toggleSocioField = (key: string) => {
    setSelectedSocioFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const addColumna = () => {
    setColumnas((prev) => [
      ...prev,
      { tempId: crypto.randomUUID(), nombre: "", tipo: "CHECKBOX" },
    ]);
  };

  const removeColumna = (tempId: string) => {
    setColumnas((prev) => prev.filter((c) => c.tempId !== tempId));
  };

  const updateColumna = (tempId: string, field: keyof ColumnaForm, value: string) => {
    setColumnas((prev) =>
      prev.map((c) => (c.tempId === tempId ? { ...c, [field]: value } : c))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!nombre.trim()) {
      setError("El nombre de la tabla es obligatorio.");
      return;
    }
    if (selectedSocioFields.length === 0) {
      setError("Selecciona al menos un campo del socio para mostrar.");
      return;
    }
    if (columnas.length === 0) {
      setError("Añade al menos una columna de control.");
      return;
    }
    if (columnas.some((c) => !c.nombre.trim())) {
      setError("Todas las columnas de control deben tener nombre.");
      return;
    }

    saveMutation.mutate({
      nombre: nombre.trim(),
      socio_columns: selectedSocioFields,
      columnas: columnas.map((c, i) => ({
        nombre: c.nombre.trim(),
        tipo: c.tipo,
        orden: i,
      })),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 rounded-t-2xl"
          style={{ background: "var(--color-primary)" }}
        >
          <h2 className="text-white font-bold text-lg">
            {isEdit ? "Editar tabla de control" : "Nueva tabla de control"}
          </h2>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
            {/* Nombre */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Nombre de la tabla *
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: LIBRETAS AÑO 2026"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
              />
            </div>

            {/* Campos del socio */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Campos del socio a mostrar *
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Selecciona qué datos del socio aparecerán en la tabla.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {socioFields.map((field) => (
                  <label
                    key={field.key}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                      selectedSocioFields.includes(field.key)
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)] font-medium"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSocioFields.includes(field.key)}
                      onChange={() => toggleSocioField(field.key)}
                      className="hidden"
                    />
                    <span
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                        selectedSocioFields.includes(field.key)
                          ? "bg-[var(--color-primary)] border-[var(--color-primary)]"
                          : "border-gray-300"
                      }`}
                    >
                      {selectedSocioFields.includes(field.key) && (
                        <svg viewBox="0 0 10 8" className="w-2.5 h-2 fill-white">
                          <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" />
                        </svg>
                      )}
                    </span>
                    {field.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Columnas de control */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">
                  Columnas de control *
                </label>
                <button
                  type="button"
                  onClick={addColumna}
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
                >
                  <Plus size={13} />
                  Añadir columna
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Define las columnas donde registrarás los datos de control.
              </p>

              <div className="space-y-2">
                {columnas.map((col, idx) => (
                  <div
                    key={col.tempId}
                    className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg bg-gray-50"
                  >
                    <GripVertical size={14} className="text-gray-300 shrink-0" />
                    <span className="text-xs text-gray-400 w-5 shrink-0">{idx + 1}.</span>
                    <input
                      type="text"
                      value={col.nombre}
                      onChange={(e) => updateColumna(col.tempId, "nombre", e.target.value)}
                      placeholder="Nombre de la columna"
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                    />
                    <select
                      value={col.tipo}
                      onChange={(e) => updateColumna(col.tempId, "tipo", e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                    >
                      {(Object.keys(TIPO_LABELS) as TablaColumnaTipo[]).map((t) => (
                        <option key={t} value={t}>
                          {TIPO_LABELS[t]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeColumna(col.tempId)}
                      disabled={columnas.length === 1}
                      className="text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
              style={{ background: "var(--color-primary)" }}
            >
              {saveMutation.isPending
                ? "Guardando…"
                : isEdit
                ? "Guardar cambios"
                : "Crear tabla"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
