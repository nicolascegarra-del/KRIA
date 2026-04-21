import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Table2,
  Trash2,
  Pencil,
  Columns3,
  CalendarDays,
} from "lucide-react";
import { tablasApi } from "../../api/tablas";
import type { TablaControlList, SocioFieldOption } from "../../types";
import TablaFormModal from "../../components/tablas/TablaFormModal";

export default function TablasPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [editingTabla, setEditingTabla] = useState<TablaControlList | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: tablas = [], isLoading } = useQuery({
    queryKey: ["tablas"],
    queryFn: tablasApi.list,
  });

  const { data: socioFields = [] } = useQuery({
    queryKey: ["tablas-socio-fields"],
    queryFn: tablasApi.getSocioFields,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tablasApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tablas"] });
      setDeletingId(null);
    },
  });

  const handleCreated = () => {
    qc.invalidateQueries({ queryKey: ["tablas"] });
    setShowCreate(false);
    setEditingTabla(null);
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Table2 size={24} className="text-[var(--color-primary)]" />
            Tablas de Control
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gestiona controles y entregas personalizados para los socios.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: "var(--color-primary)" }}
        >
          <Plus size={16} />
          Nueva Tabla
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : tablas.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Table2 size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay tablas de control todavía.</p>
          <p className="text-sm mt-1">Crea tu primera tabla con el botón de arriba.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tablas.map((tabla) => (
            <TablaCard
              key={tabla.id}
              tabla={tabla}
              socioFields={socioFields}
              onOpen={() => navigate(`/tablas/${tabla.id}`)}
              onEdit={() => setEditingTabla(tabla)}
              onDelete={() => setDeletingId(tabla.id)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {(showCreate || editingTabla) && (
        <TablaFormModal
          tablaId={editingTabla?.id}
          socioFields={socioFields}
          onClose={() => { setShowCreate(false); setEditingTabla(null); }}
          onSaved={handleCreated}
        />
      )}

      {/* Delete confirmation */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-2">¿Eliminar tabla?</h2>
            <p className="text-sm text-gray-600 mb-6">
              Se eliminarán la tabla y todos sus datos de control. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingId)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TablaCard({
  tabla,
  onOpen,
  onEdit,
  onDelete,
}: {
  tabla: TablaControlList;
  socioFields: SocioFieldOption[];
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-lg hover:border-[var(--color-primary)] transition-all duration-200 flex flex-col overflow-hidden">
      {/* Clickable body */}
      <button onClick={onOpen} className="w-full text-left flex-1 p-5">
        {/* Icon + name */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "color-mix(in srgb, var(--color-primary) 12%, transparent)" }}
          >
            <Table2 size={20} style={{ color: "var(--color-primary)" }} />
          </div>
          <p className="font-bold text-gray-900 text-base truncate leading-tight">{tabla.nombre}</p>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-lg font-medium">
            <Columns3 size={12} style={{ color: "var(--color-primary)" }} />
            {tabla.columnas_count} {tabla.columnas_count === 1 ? "columna" : "columnas"}
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarDays size={12} />
            {new Date(tabla.created_at).toLocaleDateString("es-ES")}
          </span>
        </div>
      </button>

      {/* Actions footer */}
      <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-2.5 flex items-center justify-between">
        <span className="text-xs text-gray-400 italic">Pulsa para abrir</span>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            title="Editar tabla"
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            title="Eliminar tabla"
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
