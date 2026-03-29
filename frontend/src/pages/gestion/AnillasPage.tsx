import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { anillasApi } from "../../api/anillas";
import { sociosApi } from "../../api/socios";
import Modal from "../../components/Modal";
import ErrorAlert from "../../components/ErrorAlert";
import SuccessToast from "../../components/SuccessToast";
import { useAutoCloseError } from "../../hooks/useAutoCloseError";
import { useTenantStore } from "../../store/tenantStore";
import { Tag, Plus, Trash2, Loader2 } from "lucide-react";
import type { Socio } from "../../types";

interface EntregaForm {
  socio: string;
  anio_campana: string;
  rango_inicio: string;
  rango_fin: string;
  diametro: string;
}

const FORM_DEFAULTS: EntregaForm = {
  socio: "",
  anio_campana: String(new Date().getFullYear()),
  rango_inicio: "",
  rango_fin: "",
  diametro: "",
};

export default function AnillasPage() {
  const qc = useQueryClient();
  const { branding } = useTenantStore();
  const anillaSizes = branding?.anilla_sizes ?? [];
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<EntregaForm>(FORM_DEFAULTS);
  const [filterAnio, setFilterAnio] = useState(String(new Date().getFullYear()));
  const [error, setError, clearError] = useAutoCloseError();
  const [successMsg, setSuccessMsg] = useState("");

  const { data: entregasData, isLoading } = useQuery({
    queryKey: ["anillas", filterAnio],
    queryFn: () => anillasApi.list({ anio: parseInt(filterAnio, 10) }),
  });

  const { data: sociosData } = useQuery({
    queryKey: ["socios-all"],
    queryFn: () => sociosApi.list({ page: 1 }),
  });

  const createMutation = useMutation({
    mutationFn: anillasApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["anillas"] });
      setModalOpen(false);
      setForm(FORM_DEFAULTS);
      setSuccessMsg("Entrega de anillas registrada.");
    },
    onError: (e: any) => {
      const d = e?.response?.data;
      if (d?.rango_inicio) setError(d.rango_inicio);
      else if (d?.rango_fin) setError(d.rango_fin);
      else setError(d?.detail ?? "Error al registrar la entrega.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: anillasApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["anillas"] });
      setSuccessMsg("Entrega eliminada.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    createMutation.mutate({
      socio: form.socio,
      anio_campana: parseInt(form.anio_campana, 10),
      rango_inicio: form.rango_inicio,
      rango_fin: form.rango_fin,
      diametro: form.diametro as "18" | "20",
    });
  };

  const entregas = entregasData?.results ?? [];
  const socios: Socio[] = sociosData?.results ?? [];

  return (
    <div className="space-y-4 max-w-4xl">
      <SuccessToast message={successMsg} onDismiss={() => setSuccessMsg("")} />

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Tag size={22} className="text-amber-600" />
            Control de Anillas
          </h1>
          <p className="text-sm text-gray-500">Rangos asignados a socios por campaña</p>
        </div>
        <button
          onClick={() => { setForm(FORM_DEFAULTS); clearError(); setModalOpen(true); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} />
          Nueva entrega
        </button>
      </div>

      {/* Filtro por año */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Campaña</label>
        <select
          className="input-field w-32"
          value={filterAnio}
          onChange={(e) => setFilterAnio(e.target.value)}
        >
          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500">{entregas.length} entregas</span>
      </div>

      {/* Tabla */}
      <div className="card">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : entregas.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Tag size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Sin entregas registradas para {filterAnio}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                  <th scope="col" className="pb-2 pr-4 text-left">Socio</th>
                  <th scope="col" className="pb-2 pr-4 text-left">Campaña</th>
                  <th scope="col" className="pb-2 pr-4 text-left">Rango</th>
                  <th scope="col" className="pb-2 pr-4 text-left">Diámetro</th>
                  <th scope="col" className="pb-2 pr-4 text-left">Registrado por</th>
                  <th scope="col" className="pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entregas.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 font-medium text-gray-900">{e.socio_nombre}</td>
                    <td className="py-3 pr-4 text-gray-600">{e.anio_campana}</td>
                    <td className="py-3 pr-4">
                      <span className="font-mono text-gray-800">
                        {e.rango_inicio} – {e.rango_fin}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {e.diametro}mm
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-400 text-xs">{e.created_by_nombre ?? "—"}</td>
                    <td className="py-3">
                      <button
                        onClick={() => {
                          if (confirm("¿Eliminar esta entrega?")) {
                            deleteMutation.mutate(e.id);
                          }
                        }}
                        className="text-gray-400 hover:text-red-600 p-1.5 min-h-[40px] min-w-[40px] flex items-center justify-center"
                        aria-label={`Eliminar entrega de ${e.socio_nombre}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal nueva entrega */}
      {modalOpen && (
        <Modal title="Nueva entrega de anillas" onClose={() => { setModalOpen(false); clearError(); }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Socio *</label>
              <select
                className="input-field"
                value={form.socio}
                onChange={(e) => setForm((f) => ({ ...f, socio: e.target.value }))}
                required
              >
                <option value="">Seleccionar socio...</option>
                {socios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre_razon_social} {s.numero_socio ? `(Nº ${s.numero_socio})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Año de campaña *</label>
              <input
                type="number"
                className="input-field"
                value={form.anio_campana}
                onChange={(e) => setForm((f) => ({ ...f, anio_campana: e.target.value }))}
                min={2020}
                max={new Date().getFullYear() + 1}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rango inicio *</label>
                <input
                  type="text"
                  className="input-field font-mono"
                  placeholder="0001"
                  value={form.rango_inicio}
                  onChange={(e) => setForm((f) => ({ ...f, rango_inicio: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rango fin *</label>
                <input
                  type="text"
                  className="input-field font-mono"
                  placeholder="0100"
                  value={form.rango_fin}
                  onChange={(e) => setForm((f) => ({ ...f, rango_fin: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Diámetro *</label>
              {anillaSizes.length === 0 ? (
                <p className="text-sm text-amber-600">Esta asociación no tiene tamaños de anilla configurados. Configúralos desde el panel SuperAdmin.</p>
              ) : (
                <select
                  className="input-field"
                  value={form.diametro}
                  onChange={(e) => setForm((f) => ({ ...f, diametro: e.target.value }))}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {anillaSizes.map((sz) => (
                    <option key={sz.mm} value={sz.mm}>{sz.mm}mm</option>
                  ))}
                </select>
              )}
            </div>

            <ErrorAlert message={error} onDismiss={clearError} />

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setModalOpen(false); clearError(); }}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {createMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  "Registrar entrega"
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
