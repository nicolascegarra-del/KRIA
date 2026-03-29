import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { configuracionApi } from "../../api/configuracion";
import { Plus, Pencil, Trash2, Loader2, Check, X } from "lucide-react";
import type { MotivoBaja } from "../../types";

export default function ConfiguracionPage() {
  const qc = useQueryClient();
  const [newNombre, setNewNombre] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");

  const { data: motivos = [], isLoading } = useQuery({
    queryKey: ["motivos-baja"],
    queryFn: configuracionApi.listMotivosBaja,
  });

  const createMutation = useMutation({
    mutationFn: (nombre: string) => configuracionApi.createMotivoBaja(nombre),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["motivos-baja"] });
      setNewNombre("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<MotivoBaja> }) =>
      configuracionApi.updateMotivoBaja(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["motivos-baja"] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: configuracionApi.deleteMotivoBaja,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["motivos-baja"] }),
  });

  const handleCreate = () => {
    const nombre = newNombre.trim();
    if (!nombre) return;
    createMutation.mutate(nombre);
  };

  const startEdit = (m: MotivoBaja) => {
    setEditingId(m.id);
    setEditNombre(m.nombre);
  };

  const confirmEdit = (id: string) => {
    const nombre = editNombre.trim();
    if (!nombre) return;
    updateMutation.mutate({ id, payload: { nombre } });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500 mt-1">Gestión de opciones del panel</p>
      </div>

      {/* Motivos de baja */}
      <div className="card space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Motivos de baja de animales</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Opciones disponibles al dar de baja un animal. Puedes activar/desactivar sin perder el historial.
          </p>
        </div>

        {/* Add new */}
        <div className="flex gap-2">
          <input
            type="text"
            className="input-field flex-1"
            placeholder="Nuevo motivo (ej. Fallecimiento)"
            value={newNombre}
            onChange={(e) => setNewNombre(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
          />
          <button
            onClick={handleCreate}
            disabled={!newNombre.trim() || createMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Añadir
          </button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : motivos.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Sin motivos configurados.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {motivos.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                {editingId === m.id ? (
                  <>
                    <input
                      type="text"
                      className="input-field flex-1 text-sm"
                      value={editNombre}
                      onChange={(e) => setEditNombre(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmEdit(m.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                    />
                    <button
                      onClick={() => confirmEdit(m.id)}
                      disabled={!editNombre.trim() || updateMutation.isPending}
                      className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200"
                    >
                      {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className={`flex-1 text-sm ${m.is_active ? "text-gray-900" : "text-gray-400 line-through"}`}>
                      {m.nombre}
                    </span>
                    <button
                      onClick={() => updateMutation.mutate({ id: m.id, payload: { is_active: !m.is_active } })}
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        m.is_active
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                      title={m.is_active ? "Desactivar" : "Activar"}
                    >
                      {m.is_active ? "Activo" : "Inactivo"}
                    </button>
                    <button
                      onClick={() => startEdit(m)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`¿Eliminar el motivo "${m.nombre}"?`)) {
                          deleteMutation.mutate(m.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                      title="Eliminar"
                    >
                      {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
