import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sociosApi } from "../../api/socios";
import { Search, UserX, Loader2, Users } from "lucide-react";
import type { Socio } from "../../types";

export default function SociosPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [bajaModal, setBajaModal] = useState<Socio | null>(null);
  const [razonBaja, setRazonBaja] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["socios", search],
    queryFn: () => sociosApi.list({ search }),
  });

  const bajaMutation = useMutation({
    mutationFn: ({ id, razon }: { id: string; razon: string }) =>
      sociosApi.darBaja(id, razon),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["socios"] });
      setBajaModal(null);
    },
  });

  const socios = data?.results ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Socios</h1>
        <p className="text-sm text-gray-500">{data?.count ?? 0} socios</p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, DNI o número de socio..."
          className="input-field pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="card h-16 animate-pulse bg-gray-100" />)}
        </div>
      ) : socios.length === 0 ? (
        <div className="card text-center py-8">
          <Users size={40} className="text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">No se encontraron socios.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {socios.map((socio) => (
            <div key={socio.id} className="card">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{socio.nombre_razon_social}</span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        socio.estado === "ALTA"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {socio.estado}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 flex gap-3 mt-0.5 flex-wrap">
                    <span>DNI: {socio.dni_nif}</span>
                    {socio.numero_socio && <span>Nº {socio.numero_socio}</span>}
                    {socio.codigo_rega && <span>REGA: {socio.codigo_rega}</span>}
                    <span>{socio.email}</span>
                  </div>
                </div>
                {socio.estado === "ALTA" && (
                  <button
                    onClick={() => { setBajaModal(socio); setRazonBaja(""); }}
                    className="p-2 rounded-lg bg-red-700 text-white hover:bg-red-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Dar de baja"
                  >
                    <UserX size={18} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {bajaModal && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Dar de Baja a Socio</h2>
            <p className="text-sm text-gray-600">
              Socio: <strong>{bajaModal.nombre_razon_social}</strong>
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              ⚠️ Todos los animales del socio pasarán a estado "Socio en Baja".
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Razón de baja *</label>
              <textarea
                className="input-field h-20 resize-none"
                value={razonBaja}
                onChange={(e) => setRazonBaja(e.target.value)}
                placeholder="Motivo de la baja..."
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setBajaModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button
                onClick={() => bajaMutation.mutate({ id: bajaModal.id, razon: razonBaja })}
                disabled={!razonBaja.trim() || bajaMutation.isPending}
                className="btn-danger flex-1"
              >
                {bajaMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : "Confirmar Baja"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
