import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { auditoriasApi } from "../../api/auditorias";
import { animalsApi } from "../../api/animals";
import { reportsApi } from "../../api/reports";
import type {
  AuditoriaEstado, AuditoriaAnimal, CriterioEvaluacion, PreguntaInstalacion, ReportJob,
} from "../../types";
import {
  ArrowLeft, Plus, Trash2, Save, Loader2,
  Calendar, ChevronDown, ChevronUp, Bird, ExternalLink,
  FileText, Download, Clock, CheckCircle2, Eye, EyeOff,
} from "lucide-react";

const ESTADO_OPTS: { value: AuditoriaEstado; label: string }[] = [
  { value: "PLANIFICADA",  label: "Planificada" },
  { value: "EN_CURSO",     label: "En curso" },
  { value: "COMPLETADA",   label: "Completada" },
  { value: "CANCELADA",    label: "Cancelada" },
];

const ESTADO_COLOR: Record<AuditoriaEstado, string> = {
  PLANIFICADA: "bg-blue-100 text-blue-800",
  EN_CURSO:    "bg-amber-100 text-amber-800",
  COMPLETADA:  "bg-green-100 text-green-800",
  CANCELADA:   "bg-gray-100 text-gray-500",
};

export default function AuditoriaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"animales" | "instalaciones">("animales");
  const [showAddAnimal, setShowAddAnimal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pdfJobId, setPdfJobId] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const { data: auditoria, isLoading } = useQuery({
    queryKey: ["auditoria", id],
    queryFn: () => auditoriasApi.get(id!),
    enabled: !!id,
  });

  const { data: criterios = [] } = useQuery({
    queryKey: ["criterios"],
    queryFn: auditoriasApi.criterios.list,
  });

  const { data: preguntas = [] } = useQuery({
    queryKey: ["preguntas-instalacion"],
    queryFn: auditoriasApi.preguntas.list,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<typeof auditoria>) =>
      auditoriasApi.update(id!, payload as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auditoria", id] }),
  });

  const deleteAnimalMutation = useMutation({
    mutationFn: (animalId: string) => auditoriasApi.animales.delete(id!, animalId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auditoria", id] }),
  });

  if (isLoading || !auditoria) {
    return (
      <div className="flex justify-center py-20 text-gray-400">
        <Loader2 size={32} className="animate-spin" />
      </div>
    );
  }

  const activeCriterios = criterios.filter(c => c.is_active);
  const activePreguntas = preguntas.filter(p => p.is_active);

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate("/auditorias")} className="mt-0.5 text-gray-400 hover:text-gray-700">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">
              Auditoría — {auditoria.socio_nombre}
            </h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLOR[auditoria.estado]}`}>
              {ESTADO_OPTS.find(o => o.value === auditoria.estado)?.label}
            </span>
          </div>
          <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
            <Calendar size={12} />
            {new Date(auditoria.fecha_planificada).toLocaleDateString("es-ES")}
            {auditoria.auditores && ` · ${auditoria.auditores}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Generar PDF */}
          <button
            onClick={async () => {
              setGeneratingPdf(true);
              try {
                const res = await reportsApi.auditoria(id!);
                setPdfJobId(res.job_id);
              } finally {
                setGeneratingPdf(false);
              }
            }}
            disabled={generatingPdf}
            className="btn-secondary text-sm flex items-center gap-1.5"
            title="Generar informe PDF"
          >
            {generatingPdf ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            PDF
          </button>

          {/* Eliminar */}
          <button
            onClick={() => setShowDeleteModal(true)}
            className="btn-secondary text-sm text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-1.5"
            title="Eliminar auditoría"
          >
            <Trash2 size={14} /> Eliminar
          </button>

          {/* Cambio de estado */}
          <select
            className="input-field text-sm w-36"
            value={auditoria.estado}
            onChange={e =>
              updateMutation.mutate({ estado: e.target.value as AuditoriaEstado })
            }
          >
            {ESTADO_OPTS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Estado del job PDF */}
      {pdfJobId && (
        <AuditoriaPdfStatus jobId={pdfJobId} onClose={() => setPdfJobId(null)} />
      )}

      {/* Modal eliminar */}
      {showDeleteModal && (
        <DeleteAuditoriaModal
          auditoriaId={id!}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => navigate("/auditorias")}
        />
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {([
          { key: "animales",      label: `Animales (${auditoria.animales_evaluados.length})` },
          { key: "instalaciones", label: `Instalaciones` },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Animales ─────────────────────────────────────────────────────── */}
      {activeTab === "animales" && (
        <div className="space-y-4">
          {activeCriterios.length === 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No hay criterios de evaluación configurados. Configúralos en el panel de superadmin → asociación → Auditorías.
            </div>
          )}

          {/* Animales ya evaluados */}
          <div className="space-y-3">
            {auditoria.animales_evaluados.map(av => (
              <AnimalEvaluadoCard
                key={av.id}
                item={av}
                criterios={activeCriterios}
                auditoriaId={id!}
                onDelete={() => deleteAnimalMutation.mutate(av.id)}
                onUpdated={() => qc.invalidateQueries({ queryKey: ["auditoria", id] })}
              />
            ))}
          </div>

          <button
            onClick={() => setShowAddAnimal(true)}
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <Plus size={15} /> Añadir animal a evaluar
          </button>

          {showAddAnimal && (
            <AddAnimalPanel
              auditoriaId={id!}
              criterios={activeCriterios}
              socioId={auditoria.socio}
              existingAnimalIds={auditoria.animales_evaluados.map(a => a.animal).filter(Boolean) as string[]}
              onDone={() => {
                setShowAddAnimal(false);
                qc.invalidateQueries({ queryKey: ["auditoria", id] });
              }}
              onCancel={() => setShowAddAnimal(false)}
            />
          )}
        </div>
      )}

      {/* ── Tab: Instalaciones ────────────────────────────────────────────────── */}
      {activeTab === "instalaciones" && (
        <InstalacionesForm
          auditoriaId={id!}
          preguntas={activePreguntas}
          existentes={auditoria.respuestas_instalacion}
          onSaved={() => qc.invalidateQueries({ queryKey: ["auditoria", id] })}
        />
      )}
    </div>
  );
}

// ── PDF status banner ─────────────────────────────────────────────────────────

function AuditoriaPdfStatus({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const { data } = useQuery<ReportJob>({
    queryKey: ["report-job", jobId],
    queryFn: () => reportsApi.jobStatus(jobId),
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "PENDING" || s === "PROCESSING" ? 2000 : false;
    },
  });

  const isDone = data?.status === "DONE";
  const isFailed = data?.status === "FAILED";

  return (
    <div className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${
      isDone ? "bg-green-50 border border-green-200 text-green-800"
      : isFailed ? "bg-red-50 border border-red-200 text-red-700"
      : "bg-blue-50 border border-blue-200 text-blue-800"
    }`}>
      {isDone ? <CheckCircle2 size={16} /> : isFailed ? null : <Clock size={16} className="animate-pulse" />}
      <span className="flex-1">
        {!data || data.status === "PENDING" ? "Generando informe PDF..." :
         data.status === "PROCESSING" ? "Procesando informe..." :
         isDone ? "Informe listo" : "Error al generar el informe"}
      </span>
      {isDone && data?.download_url && (
        <a
          href={data.download_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 font-semibold hover:underline"
        >
          <Download size={14} /> Descargar
        </a>
      )}
      <button onClick={onClose} className="text-current opacity-50 hover:opacity-100 text-xs ml-2">✕</button>
    </div>
  );
}

// ── Modal eliminar auditoría con contraseña ───────────────────────────────────

function DeleteAuditoriaModal({
  auditoriaId,
  onClose,
  onDeleted,
}: {
  auditoriaId: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => auditoriasApi.deleteConfirm(auditoriaId, password),
    onSuccess: onDeleted,
    onError: (err: any) => {
      setError(err?.response?.data?.detail ?? "Contraseña incorrecta.");
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-red-700 flex items-center gap-2">
            <Trash2 size={18} /> Eliminar Auditoría
          </h2>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600">
            Esta acción es irreversible. Se eliminarán todos los datos de esta auditoría incluyendo evaluaciones y respuestas de instalaciones.
          </p>
          <div>
            <label className="label text-sm">Confirma con tu contraseña</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                className="input-field pr-10 text-sm"
                value={password}
                autoFocus
                onChange={e => { setPassword(e.target.value); setError(""); }}
                onKeyDown={e => { if (e.key === "Enter" && password) mutation.mutate(); }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 min-h-0"
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>
        </div>
        <div className="p-5 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary text-sm">Cancelar</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!password || mutation.isPending}
            className="btn-primary text-sm bg-red-600 hover:bg-red-700 border-red-600 disabled:opacity-50"
          >
            {mutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Eliminando...</> : "Eliminar definitivamente"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tarjeta de animal evaluado ────────────────────────────────────────────────

function AnimalEvaluadoCard({
  item,
  criterios,
  auditoriaId,
  onDelete,
  onUpdated,
}: {
  item: AuditoriaAnimal;
  criterios: CriterioEvaluacion[];
  auditoriaId: string;
  onDelete: () => void;
  onUpdated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [puntuaciones, setPuntuaciones] = useState<Record<string, number>>(item.puntuaciones);
  const [notas, setNotas] = useState(item.notas);
  const [dirty, setDirty] = useState(false);

  const updateMutation = useMutation({
    mutationFn: () =>
      auditoriasApi.animales.update(auditoriaId, item.id, { puntuaciones, notas }),
    onSuccess: () => { setDirty(false); onUpdated(); },
  });

  const porcentaje = item.porcentaje;
  const color =
    porcentaje === null ? "text-gray-400" :
    porcentaje >= 75 ? "text-green-600" :
    porcentaje >= 50 ? "text-amber-600" : "text-red-600";

  return (
    <div className="card">
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <Bird size={16} className="text-gray-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-mono font-semibold text-gray-900">
            {item.animal_anilla || item.numero_anilla_manual || "—"}
          </span>
        </div>
        <span className={`text-sm font-bold ${color}`}>
          {porcentaje !== null ? `${porcentaje}%` : "—"}
        </span>
        <span className="text-xs text-gray-400">
          {item.puntuacion_total}/{item.puntuacion_maxima}
        </span>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-gray-100 pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {criterios.map(c => (
              <div key={c.id}>
                <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                  <span>{c.nombre}</span>
                  <span className="text-gray-400">×{c.multiplicador}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={puntuaciones[c.id] ?? 0}
                  onChange={e => {
                    setPuntuaciones(p => ({ ...p, [c.id]: parseInt(e.target.value) }));
                    setDirty(true);
                  }}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>0</span>
                  <span className="font-bold text-gray-700">{puntuaciones[c.id] ?? 0}</span>
                  <span>10</span>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="label text-xs">Notas</label>
            <textarea
              className="input-field text-sm"
              rows={2}
              value={notas}
              onChange={e => { setNotas(e.target.value); setDirty(true); }}
            />
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={e => { e.stopPropagation(); onDelete(); }}
              className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
            >
              <Trash2 size={13} /> Eliminar
            </button>
            {dirty && (
              <button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="btn-primary text-xs py-1 px-3 flex items-center gap-1"
              >
                {updateMutation.isPending
                  ? <><Loader2 size={12} className="animate-spin" /> Guardando...</>
                  : <><Save size={12} /> Guardar</>
                }
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Panel para añadir animal ──────────────────────────────────────────────────

const ACTIVE_ESTADOS = ["REGISTRADO", "APROBADO", "EVALUADO"];

function AddAnimalPanel({
  auditoriaId,
  criterios,
  socioId,
  existingAnimalIds,
  onDone,
  onCancel,
}: {
  auditoriaId: string;
  criterios: CriterioEvaluacion[];
  socioId: string;
  existingAnimalIds: string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"existente" | "nuevo">("existente");
  const [animalId, setAnimalId] = useState("");
  const [puntuaciones, setPuntuaciones] = useState<Record<string, number>>({});
  const [notas, setNotas] = useState("");

  const { data: socioAnimalesData, isLoading: loadingAnimales } = useQuery({
    queryKey: ["animals-socio-auditoria", socioId],
    queryFn: () => animalsApi.list({ socio_id: socioId, page_size: 200 }),
    enabled: mode === "existente",
  });

  const disponibles = (socioAnimalesData?.results ?? []).filter(
    a => ACTIVE_ESTADOS.includes(a.estado) && !existingAnimalIds.includes(a.id)
  );

  const mutation = useMutation({
    mutationFn: () =>
      auditoriasApi.animales.create(auditoriaId, {
        animal: animalId || null,
        numero_anilla_manual: "",
        puntuaciones,
        notas,
      }),
    onSuccess: onDone,
  });

  if (mode === "nuevo") {
    return (
      <div className="card border-2 border-primary/20 bg-primary/5 space-y-4">
        <div className="flex gap-3">
          <button
            onClick={() => setMode("existente")}
            className="text-sm px-3 py-1 rounded-lg border bg-white text-gray-600 border-gray-200"
          >
            Animal ya registrado
          </button>
          <button
            className="text-sm px-3 py-1 rounded-lg border bg-primary text-white border-primary"
          >
            Dar de alta en el momento
          </button>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Debes registrar el animal primero. Serás redirigido al formulario de alta y al guardar volverás automáticamente a esta auditoría.
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="btn-secondary text-sm">Cancelar</button>
          <button
            onClick={() => navigate(`/socios/${socioId}/nuevo-animal?returnTo=/auditorias/${auditoriaId}`)}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <ExternalLink size={14} /> Ir al formulario de alta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card border-2 border-primary/20 bg-primary/5 space-y-4">
      {/* Selector de modo */}
      <div className="flex gap-3">
        <button
          onClick={() => setMode("existente")}
          className="text-sm px-3 py-1 rounded-lg border bg-primary text-white border-primary"
        >
          Animal ya registrado
        </button>
        <button
          onClick={() => setMode("nuevo")}
          className="text-sm px-3 py-1 rounded-lg border bg-white text-gray-600 border-gray-200"
        >
          Dar de alta en el momento
        </button>
      </div>

      {/* Desplegable de animales del socio */}
      {loadingAnimales ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={14} className="animate-spin" /> Cargando animales...
        </div>
      ) : disponibles.length === 0 ? (
        <p className="text-sm text-gray-500">
          {(socioAnimalesData?.results ?? []).length === 0
            ? "Este socio no tiene animales registrados."
            : "Todos los animales activos de este socio ya están en la auditoría."}
        </p>
      ) : (
        <div>
          <label className="label text-xs">Animal *</label>
          <select
            className="input-field text-sm"
            value={animalId}
            onChange={e => setAnimalId(e.target.value)}
          >
            <option value="">— Selecciona un animal —</option>
            {disponibles.map(a => (
              <option key={a.id} value={a.id}>
                {a.numero_anilla} · {a.fecha_nacimiento ? new Date(a.fecha_nacimiento).getFullYear() : "—"} · {a.sexo === "M" ? "Macho" : "Hembra"} · {a.estado}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Criterios de evaluación */}
      {criterios.length > 0 && animalId && (
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Puntuaciones</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {criterios.map(c => (
              <div key={c.id}>
                <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                  <span>{c.nombre}</span>
                  <span className="text-gray-400">×{c.multiplicador}</span>
                </div>
                <input
                  type="range" min={0} max={10} step={1}
                  value={puntuaciones[c.id] ?? 0}
                  onChange={e => setPuntuaciones(p => ({ ...p, [c.id]: parseInt(e.target.value) }))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>0</span>
                  <span className="font-bold text-gray-700">{puntuaciones[c.id] ?? 0}</span>
                  <span>10</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {animalId && (
        <div>
          <label className="label text-xs">Notas</label>
          <textarea className="input-field text-sm" rows={2} value={notas} onChange={e => setNotas(e.target.value)} />
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn-secondary text-sm">Cancelar</button>
        <button
          onClick={() => mutation.mutate()}
          disabled={!animalId || mutation.isPending}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {mutation.isPending ? <><Loader2 size={13} className="animate-spin" /> Guardando...</> : "Guardar evaluación"}
        </button>
      </div>
    </div>
  );
}

// ── Formulario instalaciones ──────────────────────────────────────────────────

function InstalacionesForm({
  auditoriaId,
  preguntas,
  existentes,
  onSaved,
}: {
  auditoriaId: string;
  preguntas: PreguntaInstalacion[];
  existentes: { pregunta: string; respuesta: string }[];
  onSaved: () => void;
}) {
  const [respuestas, setRespuestas] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    existentes.forEach(r => { map[r.pregunta] = r.respuesta; });
    return map;
  });

  // Sincroniza cuando lleguen datos frescos
  useEffect(() => {
    const map: Record<string, string> = {};
    existentes.forEach(r => { map[r.pregunta] = r.respuesta; });
    setRespuestas(map);
  }, [existentes.length]);

  const mutation = useMutation({
    mutationFn: () =>
      auditoriasApi.respuestas.save(
        auditoriaId,
        Object.entries(respuestas).map(([pregunta, respuesta]) => ({ pregunta, respuesta }))
      ),
    onSuccess: onSaved,
  });

  if (preguntas.length === 0) {
    return (
      <div className="card text-center py-10 text-gray-400">
        <p className="font-medium">No hay preguntas configuradas</p>
        <p className="text-sm mt-1">Configúralas en el panel de superadmin → asociación → Auditorías</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {preguntas.map(p => (
        <div key={p.id} className="card">
          <p className="text-sm font-medium text-gray-800 mb-2">{p.texto}</p>
          {p.tipo === "SINO" && (
            <div className="flex gap-3">
              {["si", "no"].map(v => (
                <label key={v} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name={p.id}
                    value={v}
                    checked={respuestas[p.id] === v}
                    onChange={() => setRespuestas(r => ({ ...r, [p.id]: v }))}
                    className="accent-primary"
                  />
                  {v === "si" ? "Sí" : "No"}
                </label>
              ))}
            </div>
          )}
          {p.tipo === "TEXTO" && (
            <textarea
              className="input-field text-sm"
              rows={3}
              value={respuestas[p.id] ?? ""}
              onChange={e => setRespuestas(r => ({ ...r, [p.id]: e.target.value }))}
              placeholder="Descripción..."
            />
          )}
          {p.tipo === "PUNTUACION" && (
            <div>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={parseInt(respuestas[p.id] ?? "0")}
                onChange={e => setRespuestas(r => ({ ...r, [p.id]: e.target.value }))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>0</span>
                <span className="font-bold text-gray-700">{respuestas[p.id] ?? "0"}</span>
                <span>10</span>
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="flex justify-end">
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="btn-primary flex items-center gap-1.5"
        >
          {mutation.isPending
            ? <><Loader2 size={15} className="animate-spin" /> Guardando...</>
            : <><Save size={15} /> Guardar respuestas</>
          }
        </button>
      </div>
    </div>
  );
}
