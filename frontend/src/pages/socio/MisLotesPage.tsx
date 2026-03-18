import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layers, Plus, X, Loader2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { lotesApi } from "../../api/lotes";
import { animalsApi } from "../../api/animals";
import type { Lote } from "../../types";

// ─── LoteModal ────────────────────────────────────────────────────────────────

interface LoteModalProps {
  onClose: () => void;
}

function LoteModal({ onClose }: LoteModalProps) {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [machoId, setMachoId] = useState("");
  // Cada elemento es un ID seleccionado o "" (fila vacía)
  const [hembrasSlots, setHembrasSlots] = useState<string[]>([""]);
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().slice(0, 10));
  const [modalError, setModalError] = useState("");

  // Animales del socio
  const { data: machosData, isLoading: loadingMachos } = useQuery({
    queryKey: ["animals-machos-select"],
    queryFn: () => animalsApi.list({ sexo: "M" }),
  });
  const { data: hembrasData, isLoading: loadingHembras } = useQuery({
    queryKey: ["animals-hembras-select"],
    queryFn: () => animalsApi.list({ sexo: "H" }),
  });
  // Lotes activos para detectar animales ya en uso
  const { data: lotesData } = useQuery({
    queryKey: ["lotes"],
    queryFn: lotesApi.list,
  });

  const machos = machosData?.results ?? [];
  const hembras = hembrasData?.results ?? [];

  // IDs en uso en lotes activos (is_closed=false)
  const activeLotes = (lotesData?.results ?? []).filter((l) => !l.is_closed);
  const machoIdsEnUso = new Set(activeLotes.map((l) => l.macho).filter(Boolean) as string[]);
  const hembraIdsEnUso = new Set(activeLotes.flatMap((l) => l.hembras));

  // IDs ya seleccionados en otras filas de hembras
  const selectedHembraIds = new Set(hembrasSlots.filter(Boolean));

  const addHembraSlot = () => setHembrasSlots((prev) => [...prev, ""]);
  const removeHembraSlot = (idx: number) =>
    setHembrasSlots((prev) => prev.filter((_, i) => i !== idx));
  const updateHembraSlot = (idx: number, val: string) =>
    setHembrasSlots((prev) => prev.map((v, i) => (i === idx ? val : v)));

  const hembrasIds = hembrasSlots.filter(Boolean);

  const createMutation = useMutation({
    mutationFn: () =>
      lotesApi.create({
        nombre,
        macho: machoId || null,
        hembras: hembrasIds,
        fecha_inicio: fechaInicio,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lotes"] });
      onClose();
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail ??
        "Error al crear el lote. Comprueba los datos e inténtalo de nuevo.";
      setModalError(msg);
    },
  });

  const loadingAnimals = loadingMachos || loadingHembras;

  // Helper: etiqueta de opción animal
  const animalLabel = (a: { numero_anilla: string; anio_nacimiento: number; estado: string }) =>
    `${a.numero_anilla} / ${a.anio_nacimiento}${a.estado !== "APROBADO" ? ` — ${a.estado.toLowerCase()}` : ""}`;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Nuevo Lote de Cría</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del lote *
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="Ej: Lote Primavera 2024"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          {/* Fecha inicio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de inicio *
            </label>
            <input
              type="date"
              className="input-field"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>

          {/* Macho */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Macho</label>
            {loadingMachos ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                <Loader2 size={14} className="animate-spin" /> Cargando...
              </div>
            ) : machos.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No tienes machos registrados.</p>
            ) : (
              <select
                className="input-field"
                value={machoId}
                onChange={(e) => setMachoId(e.target.value)}
              >
                <option value="">— Sin macho asignado —</option>
                {machos.map((a) => (
                  <option key={a.id} value={a.id} disabled={machoIdsEnUso.has(a.id)}>
                    {animalLabel(a)}{machoIdsEnUso.has(a.id) ? " (en uso)" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Hembras */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Hembras
                {hembrasIds.length > 0 && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
                    {hembrasIds.length} seleccionada{hembrasIds.length !== 1 ? "s" : ""}
                  </span>
                )}
              </label>
              <button
                type="button"
                onClick={addHembraSlot}
                disabled={loadingHembras || hembras.length === 0}
                className="flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800 disabled:opacity-40"
              >
                <Plus size={12} /> Añadir
              </button>
            </div>
            {loadingHembras ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                <Loader2 size={14} className="animate-spin" /> Cargando...
              </div>
            ) : hembras.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No tienes hembras registradas.</p>
            ) : (
              <div className="space-y-2">
                {hembrasSlots.map((slotId, idx) => (
                  <div key={idx} className="flex gap-2">
                    <select
                      className="input-field flex-1"
                      value={slotId}
                      onChange={(e) => updateHembraSlot(idx, e.target.value)}
                    >
                      <option value="">— Selecciona una hembra —</option>
                      {hembras.map((a) => {
                        const enUso = hembraIdsEnUso.has(a.id);
                        const enOtraFila = selectedHembraIds.has(a.id) && a.id !== slotId;
                        const disabled = enUso || enOtraFila;
                        return (
                          <option key={a.id} value={a.id} disabled={disabled}>
                            {animalLabel(a)}
                            {enUso ? " (en uso)" : enOtraFila ? " (ya añadida)" : ""}
                          </option>
                        );
                      })}
                    </select>
                    {hembrasSlots.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeHembraSlot(idx)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg shrink-0"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {modalError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {modalError}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 pb-5 pt-3 border-t shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button
            onClick={() => { setModalError(""); createMutation.mutate(); }}
            disabled={createMutation.isPending || !nombre.trim() || !fechaInicio || loadingAnimals}
            className="btn-primary flex-1"
          >
            {createMutation.isPending ? (
              <><Loader2 size={14} className="animate-spin" /> Creando...</>
            ) : (
              "Crear lote"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LoteCard ─────────────────────────────────────────────────────────────────

interface LoteCardProps {
  lote: Lote;
  onClose: (id: string) => void;
  isClosing: boolean;
}

function LoteCard({ lote, onClose, isClosing }: LoteCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 truncate">{lote.nombre}</h3>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                lote.is_closed
                  ? "bg-gray-100 text-gray-500"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {lote.is_closed ? "Finalizado" : "Activo"}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
            <span>
              <span className="text-gray-400">Macho:</span>{" "}
              {lote.macho_anilla ?? <span className="text-gray-400 italic">sin asignar</span>}
            </span>
            <span>
              <span className="text-gray-400">Hembras:</span> {lote.hembras.length}
            </span>
            <span>
              <span className="text-gray-400">Crías:</span> {lote.crias_count}
            </span>
            <span>
              <span className="text-gray-400">Inicio:</span> {lote.fecha_inicio}
            </span>
            {lote.fecha_fin && (
              <span>
                <span className="text-gray-400">Fin:</span> {lote.fecha_fin}
              </span>
            )}
          </div>

          {/* Hembras expandible */}
          {lote.hembras_anillas.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800"
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expanded ? "Ocultar hembras" : "Ver hembras"}
            </button>
          )}

          {expanded && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {lote.hembras_anillas.map((anilla) => (
                <span
                  key={anilla}
                  className="text-xs bg-pink-50 text-pink-700 border border-pink-200 rounded px-2 py-0.5 font-mono"
                >
                  {anilla}
                </span>
              ))}
            </div>
          )}
        </div>

        {!lote.is_closed && (
          <button
            onClick={() => onClose(lote.id)}
            disabled={isClosing}
            className="btn-secondary text-xs py-1.5 px-3 shrink-0"
          >
            {isClosing ? <Loader2 size={12} className="animate-spin" /> : "Finalizar"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── MisLotesPage ─────────────────────────────────────────────────────────────

export default function MisLotesPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"activos" | "finalizados">("activos");
  const [showModal, setShowModal] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["lotes"],
    queryFn: lotesApi.list,
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => {
      setClosingId(id);
      return lotesApi.close(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lotes"] });
      setClosingId(null);
    },
    onError: () => setClosingId(null),
  });

  const allLotes = data?.results ?? [];
  const activeLotes = allLotes.filter((l) => !l.is_closed);
  const closedLotes = allLotes.filter((l) => l.is_closed);
  const visibleLotes = activeTab === "activos" ? activeLotes : closedLotes;

  return (
    <div className="max-w-2xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers size={24} className="text-blue-700" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Mis Lotes de Cría</h1>
            <p className="text-sm text-gray-500">
              {activeLotes.length} activo{activeLotes.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} />
          Nuevo Lote
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(["activos", "finalizados"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-blue-700 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "activos" ? "Activos" : "Finalizados"}
            <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5">
              {tab === "activos" ? activeLotes.length : closedLotes.length}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin text-blue-700" />
        </div>
      ) : isError ? (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg p-4">
          <AlertCircle size={18} />
          Error al cargar los lotes. Inténtalo de nuevo.
        </div>
      ) : visibleLotes.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Layers size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            {activeTab === "activos"
              ? "No tienes lotes activos. ¡Crea tu primer lote!"
              : "No hay lotes finalizados."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleLotes.map((lote) => (
            <LoteCard
              key={lote.id}
              lote={lote}
              onClose={(id) => closeMutation.mutate(id)}
              isClosing={closingId === lote.id && closeMutation.isPending}
            />
          ))}
        </div>
      )}

      {showModal && <LoteModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
