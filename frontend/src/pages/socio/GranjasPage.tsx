import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { granjasApi } from "../../api/granjas";
import { Plus, Building, Loader2, Pencil, Trash2, X } from "lucide-react";
import type { Granja } from "../../types";

interface GranjaFormData {
  nombre: string;
  codigo_rega: string;
}

const EMPTY_FORM: GranjaFormData = { nombre: "", codigo_rega: "" };

export default function GranjasPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<"create" | Granja | null>(null);
  const [form, setForm] = useState<GranjaFormData>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Granja | null>(null);
  const [formError, setFormError] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["granjas"],
    queryFn: () => granjasApi.list(),
  });

  const granjas = data?.results ?? [];

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setModal("create");
  };

  const openEdit = (granja: Granja) => {
    setForm({ nombre: granja.nombre, codigo_rega: granja.codigo_rega });
    setFormError("");
    setModal(granja);
  };

  const closeModal = () => setModal(null);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (modal === "create") {
        return granjasApi.create({ nombre: form.nombre.trim(), codigo_rega: form.codigo_rega.trim() });
      }
      return granjasApi.update((modal as Granja).id, { nombre: form.nombre.trim(), codigo_rega: form.codigo_rega.trim() });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["granjas"] });
      closeModal();
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.nombre?.[0]
        ?? err?.response?.data?.non_field_errors?.[0]
        ?? err?.response?.data?.detail
        ?? "Error al guardar la granja.";
      setFormError(detail);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => granjasApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["granjas"] });
      setDeleteTarget(null);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setFormError("El nombre es obligatorio."); return; }
    setFormError("");
    saveMutation.mutate();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mis Granjas</h1>
          <p className="text-sm text-gray-500">{data?.count ?? 0} granjas registradas</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={18} />
          Nueva granja
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse h-16 bg-gray-100" />
          ))}
        </div>
      ) : isError ? (
        <div className="card text-center py-8 text-red-600">
          Error al cargar las granjas. Comprueba la conexión.
        </div>
      ) : granjas.length === 0 ? (
        <div className="card text-center py-12">
          <Building size={48} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No tienes granjas registradas</p>
          <button onClick={openCreate} className="btn-primary mt-4 inline-flex">
            <Plus size={18} />
            Registrar primera granja
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {granjas.map((granja) => (
            <div key={granja.id} className="card">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <Building size={20} className="text-blue-700 shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">{granja.nombre}</p>
                    {granja.codigo_rega && (
                      <p className="text-sm text-gray-500">REGA: {granja.codigo_rega}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(granja)}
                    className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Editar"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(granja)}
                    className="p-2 rounded-lg text-red-600 hover:bg-red-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Eliminar"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {modal !== null && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {modal === "create" ? "Nueva Granja" : "Editar Granja"}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 rounded-lg text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej. Granja El Robledal"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código REGA (opcional)
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej. ES280101000001"
                  value={form.codigo_rega}
                  onChange={(e) => setForm({ ...form, codigo_rega: e.target.value })}
                />
              </div>

              {formError && (
                <p className="text-sm text-red-600">{formError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {saveMutation.isPending
                    ? <><Loader2 size={16} className="animate-spin" /> Guardando...</>
                    : "Guardar"
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Eliminar Granja</h2>
            <p className="text-sm text-gray-600">
              ¿Eliminar <strong>{deleteTarget.nombre}</strong>? Los animales asignados a esta granja perderán la asignación.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="btn-danger flex-1"
              >
                {deleteMutation.isPending
                  ? <Loader2 size={16} className="animate-spin" />
                  : "Eliminar"
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
