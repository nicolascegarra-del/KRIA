import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { granjasApi } from "../../api/granjas";
import { sociosApi } from "../../api/socios";
import { Search, Building2, Plus, Loader2, X } from "lucide-react";
import type { Granja } from "../../types";

interface GranjaFormData {
  nombre: string;
  codigo_rega: string;
  socio: string;
}

const EMPTY_FORM: GranjaFormData = { nombre: "", codigo_rega: "", socio: "" };

export default function GranjasGestionPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<GranjaFormData>(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["granjas", search],
    queryFn: () => granjasApi.list({ search }),
  });

  const { data: sociosData } = useQuery({
    queryKey: ["socios", "alta"],
    queryFn: () => sociosApi.list({ estado: "ALTA", page: 1 }),
  });

  const socios = sociosData?.results ?? [];
  const granjas = data?.results ?? [];

  const openModal = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setModal(true);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      granjasApi.create({
        nombre: form.nombre.trim(),
        codigo_rega: form.codigo_rega.trim(),
        socio: form.socio,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["granjas"] });
      setModal(false);
    },
    onError: (err: any) => {
      const detail =
        err?.response?.data?.nombre?.[0] ??
        err?.response?.data?.socio?.[0] ??
        err?.response?.data?.non_field_errors?.[0] ??
        err?.response?.data?.detail ??
        "Error al crear la granja.";
      setFormError(detail);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setFormError("El nombre es obligatorio."); return; }
    if (!form.socio) { setFormError("Selecciona un socio."); return; }
    setFormError("");
    createMutation.mutate();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Granjas</h1>
          <p className="text-sm text-gray-500">{data?.count ?? 0} granjas en el tenant</p>
        </div>
        <button onClick={openModal} className="btn-primary">
          <Plus size={18} />
          Nueva granja
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, REGA o socio..."
          className="input-field pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card h-16 animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : granjas.length === 0 ? (
        <div className="card text-center py-8">
          <Building2 size={40} className="text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">No se encontraron granjas.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {granjas.map((granja) => (
            <div key={granja.id} className="card">
              <div className="flex items-center gap-3 flex-wrap">
                <Building2 size={20} className="text-blue-700 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{granja.nombre}</p>
                  <div className="text-sm text-gray-500 flex gap-3 flex-wrap mt-0.5">
                    {granja.codigo_rega && <span>REGA: {granja.codigo_rega}</span>}
                    {granja.socio_nombre && <span>Socio: {granja.socio_nombre}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Nueva Granja</h2>
              <button
                onClick={() => setModal(false)}
                className="p-1 rounded-lg text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Socio *</label>
                <select
                  className="input-field"
                  value={form.socio}
                  onChange={(e) => setForm({ ...form, socio: e.target.value })}
                >
                  <option value="">Seleccionar socio...</option>
                  {socios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre_razon_social}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej. Granja El Robledal"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
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

              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createMutation.isPending
                    ? <><Loader2 size={16} className="animate-spin" /> Creando...</>
                    : "Crear granja"
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
