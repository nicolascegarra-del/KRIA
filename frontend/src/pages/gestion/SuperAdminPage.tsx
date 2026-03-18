import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { superadminApi } from "../../api/superadmin";
import Modal from "../../components/Modal";
import ErrorAlert from "../../components/ErrorAlert";
import SuccessToast from "../../components/SuccessToast";
import { useAutoCloseError } from "../../hooks/useAutoCloseError";
import { Shield, Plus, Edit2, Users, Bird, Building, Check, Loader2, Upload } from "lucide-react";
import type { Tenant } from "../../types";

interface TenantForm {
  name: string;
  slug: string;
  primary_color: string;
  secondary_color: string;
  is_active: boolean;
}

const FORM_DEFAULTS: TenantForm = {
  name: "",
  slug: "",
  primary_color: "#1565C0",
  secondary_color: "#FBC02D",
  is_active: true,
};

export default function SuperAdminPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [form, setForm] = useState<TenantForm>(FORM_DEFAULTS);
  const [error, setError, clearError] = useAutoCloseError();
  const [successMsg, setSuccessMsg] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);

  const { data: stats } = useQuery({ queryKey: ["superadmin-stats"], queryFn: superadminApi.stats });
  const { data: tenantsData, isLoading } = useQuery({
    queryKey: ["superadmin-tenants"],
    queryFn: () => superadminApi.listTenants(),
  });

  const createMutation = useMutation({
    mutationFn: superadminApi.createTenant,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-tenants"] });
      qc.invalidateQueries({ queryKey: ["superadmin-stats"] });
      closeModal();
      setSuccessMsg("Asociación creada correctamente.");
    },
    onError: (e: any) =>
      setError(e?.response?.data?.detail ?? "Error al crear la asociación."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Tenant> }) =>
      superadminApi.updateTenant(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-tenants"] });
      closeModal();
      setSuccessMsg("Asociación actualizada correctamente.");
    },
    onError: (e: any) =>
      setError(e?.response?.data?.detail ?? "Error al actualizar."),
  });

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(FORM_DEFAULTS);
    setLogoPreview(null);
    setLogoError("");
    clearError();
  };

  const openCreate = () => {
    setEditing(null);
    setForm(FORM_DEFAULTS);
    setLogoPreview(null);
    setLogoError("");
    clearError();
    setModalOpen(true);
  };

  const openEdit = (t: Tenant) => {
    setEditing(t);
    setForm({
      name: t.name,
      slug: t.slug,
      primary_color: t.primary_color,
      secondary_color: t.secondary_color,
      is_active: t.is_active,
    });
    setLogoPreview((t as any).logo_url ?? null);
    setLogoError("");
    clearError();
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    setLogoError("");
    setLogoUploading(true);
    try {
      const updated = await superadminApi.uploadLogo(editing.id, file);
      const newLogoUrl = (updated as any).logo_url ?? null;
      setLogoPreview(newLogoUrl);
      qc.invalidateQueries({ queryKey: ["superadmin-tenants"] });
      qc.invalidateQueries({ queryKey: ["tenant-branding"] });
      setSuccessMsg("Logo actualizado correctamente.");
    } catch {
      setLogoError("Error al subir el logo. Inténtalo de nuevo.");
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const tenants: Tenant[] = tenantsData?.results ?? [];
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 max-w-4xl">
      <SuccessToast message={successMsg} onDismiss={() => setSuccessMsg("")} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield size={22} className="text-violet-600" />
            Super Admin
          </h1>
          <p className="text-sm text-gray-500">Gestión global de asociaciones</p>
        </div>
        <button onClick={openCreate} className="btn-primary gap-2 flex items-center">
          <Plus size={16} />
          Nueva asociación
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Asociaciones", value: stats.tenants, icon: <Building size={18} />, color: "text-violet-600" },
            { label: "Usuarios", value: stats.usuarios, icon: <Users size={18} />, color: "text-blue-600" },
            { label: "Socios", value: stats.socios, icon: <Users size={18} />, color: "text-emerald-600" },
            { label: "Animales", value: stats.animales, icon: <Bird size={18} />, color: "text-amber-600" },
          ].map((s) => (
            <div key={s.label} className="card text-center">
              <div className={`${s.color} flex justify-center mb-1`}>{s.icon}</div>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tenants table */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-800 mb-3">Asociaciones registradas</h2>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : tenants.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No hay asociaciones.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                  <th scope="col" className="pb-2 pr-4">Nombre</th>
                  <th scope="col" className="pb-2 pr-4">Slug</th>
                  <th scope="col" className="pb-2 pr-4">Colores</th>
                  <th scope="col" className="pb-2 pr-4">Estado</th>
                  <th scope="col" className="pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 font-medium text-gray-900">{t.name}</td>
                    <td className="py-3 pr-4 font-mono text-gray-500">{t.slug}</td>
                    <td className="py-3 pr-4">
                      <div className="flex gap-1">
                        <div
                          className="w-5 h-5 rounded-full border border-gray-200"
                          style={{ background: t.primary_color }}
                          title={t.primary_color}
                        />
                        <div
                          className="w-5 h-5 rounded-full border border-gray-200"
                          style={{ background: t.secondary_color }}
                          title={t.secondary_color}
                        />
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          t.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {t.is_active ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => openEdit(t)}
                        className="text-gray-400 hover:text-blue-600 p-1 min-h-[40px] min-w-[40px] flex items-center justify-center"
                        aria-label={`Editar ${t.name}`}
                      >
                        <Edit2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal crear/editar */}
      {modalOpen && (
        <Modal
          title={editing ? "Editar asociación" : "Nueva asociación"}
          onClose={closeModal}
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  className="input-field"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="Asociación Ejemplo"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Slug (código único) *
                </label>
                <input
                  className="input-field font-mono"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  required
                  placeholder="mi-asoc"
                  disabled={!!editing}
                />
                {editing && (
                  <p className="text-xs text-gray-400 mt-1">El slug no se puede cambiar.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Color primario</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={form.primary_color}
                    onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))}
                    className="h-10 w-16 rounded cursor-pointer border border-gray-300"
                    aria-label="Selector color primario"
                  />
                  <input
                    className="input-field flex-1 font-mono"
                    value={form.primary_color}
                    onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Color secundario</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={form.secondary_color}
                    onChange={(e) => setForm((f) => ({ ...f, secondary_color: e.target.value }))}
                    className="h-10 w-16 rounded cursor-pointer border border-gray-300"
                    aria-label="Selector color secundario"
                  />
                  <input
                    className="input-field flex-1 font-mono"
                    value={form.secondary_color}
                    onChange={(e) => setForm((f) => ({ ...f, secondary_color: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="rounded"
              />
              Asociación activa
            </label>

            {/* Logo — solo visible al editar (necesita ID) */}
            {editing && (
              <div className="border-t border-gray-100 pt-4">
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Logo de la asociación
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 flex-shrink-0">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <Bird size={24} className="text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <label
                      className="btn-secondary flex items-center gap-2 cursor-pointer text-sm w-fit"
                      aria-label="Subir logo"
                    >
                      {logoUploading ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Upload size={15} />
                      )}
                      {logoUploading ? "Subiendo..." : "Seleccionar imagen"}
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoChange}
                        disabled={logoUploading}
                      />
                    </label>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG o SVG. Se sube al seleccionar.</p>
                    {logoError && (
                      <p className="text-xs text-red-600 mt-1">{logoError}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <ErrorAlert message={error} onDismiss={clearError} />

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={closeModal} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                {editing ? "Guardar cambios" : "Crear asociación"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
