import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { superadminApi } from "../../api/superadmin";
import { Shield, Plus, Edit2, Users, Bird, Building, Check, X, Loader2 } from "lucide-react";
import type { Tenant } from "../../types";

export default function SuperAdminPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", primary_color: "#1565C0", secondary_color: "#FBC02D", is_active: true });
  const [error, setError] = useState("");

  const { data: stats } = useQuery({ queryKey: ["superadmin-stats"], queryFn: superadminApi.stats });
  const { data: tenantsData, isLoading } = useQuery({ queryKey: ["superadmin-tenants"], queryFn: () => superadminApi.listTenants() });

  const createMutation = useMutation({
    mutationFn: superadminApi.createTenant,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-tenants"] }); resetForm(); },
    onError: (e: any) => setError(e?.response?.data?.detail ?? "Error al crear la asociación."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Tenant> }) => superadminApi.updateTenant(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-tenants"] }); resetForm(); },
    onError: (e: any) => setError(e?.response?.data?.detail ?? "Error al actualizar."),
  });

  const resetForm = () => { setShowForm(false); setEditing(null); setForm({ name: "", slug: "", primary_color: "#1565C0", secondary_color: "#FBC02D", is_active: true }); setError(""); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (editing) updateMutation.mutate({ id: editing.id, payload: form });
    else createMutation.mutate(form);
  };

  const startEdit = (t: Tenant) => {
    setEditing(t);
    setForm({ name: t.name, slug: t.slug, primary_color: t.primary_color, secondary_color: t.secondary_color, is_active: t.is_active });
    setShowForm(true);
  };

  const tenants: Tenant[] = tenantsData?.results ?? [];
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Shield size={22} className="text-violet-600" />Super Admin</h1>
          <p className="text-sm text-gray-500">Gestión global de asociaciones</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary gap-2"><Plus size={16} />Nueva asociación</button>
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

      {/* Form */}
      {showForm && (
        <div className="card border border-violet-200 bg-violet-50">
          <h2 className="text-base font-semibold text-gray-800 mb-4">{editing ? "Editar asociación" : "Nueva asociación"}</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre</label>
                <input className="input-field" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Asociación Ejemplo" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Slug (código único)</label>
                <input className="input-field font-mono" value={form.slug} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))} required placeholder="mi-asoc" disabled={!!editing} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Color primario</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={form.primary_color} onChange={(e) => setForm(f => ({ ...f, primary_color: e.target.value }))} className="h-10 w-16 rounded cursor-pointer border border-gray-300" />
                  <input className="input-field flex-1 font-mono" value={form.primary_color} onChange={(e) => setForm(f => ({ ...f, primary_color: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Color secundario</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={form.secondary_color} onChange={(e) => setForm(f => ({ ...f, secondary_color: e.target.value }))} className="h-10 w-16 rounded cursor-pointer border border-gray-300" />
                  <input className="input-field flex-1 font-mono" value={form.secondary_color} onChange={(e) => setForm(f => ({ ...f, secondary_color: e.target.value }))} />
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
              Asociación activa
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={resetForm} className="btn-secondary"><X size={16} />Cancelar</button>
              <button type="submit" disabled={isPending} className="btn-primary gap-2 disabled:opacity-50">
                {isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {editing ? "Guardar cambios" : "Crear asociación"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tenants table */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-800 mb-3">Asociaciones registradas</h2>
        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : tenants.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No hay asociaciones.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead><tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                <th className="pb-2 pr-4">Nombre</th>
                <th className="pb-2 pr-4">Slug</th>
                <th className="pb-2 pr-4">Colores</th>
                <th className="pb-2 pr-4">Estado</th>
                <th className="pb-2"></th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 font-medium text-gray-900">{t.name}</td>
                    <td className="py-3 pr-4 font-mono text-gray-500">{t.slug}</td>
                    <td className="py-3 pr-4">
                      <div className="flex gap-1">
                        <div className="w-5 h-5 rounded-full border border-gray-200" style={{ background: t.primary_color }} title={t.primary_color} />
                        <div className="w-5 h-5 rounded-full border border-gray-200" style={{ background: t.secondary_color }} title={t.secondary_color} />
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${t.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {t.is_active ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td className="py-3">
                      <button onClick={() => startEdit(t)} className="text-gray-400 hover:text-blue-600 p-1" aria-label="Editar"><Edit2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
