import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { importsApi } from "../../api/imports";
import {
  Upload,
  Users,
  Bird,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Download,
  AlertCircle,
  CheckCheck,
  ArrowLeft,
} from "lucide-react";
import clsx from "clsx";
import type { ImportJob, ImportValidateResult } from "../../types";

type ImportType = "socios" | "animales";
type Phase = "select" | "upload" | "preview" | "processing";

// ── Reusable import flow ───────────────────────────────────────────────────────

interface ImportFlowProps {
  tipo: ImportType;
  onBack: () => void;
}

function ImportFlow({ tipo, onBack }: ImportFlowProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("upload");
  const [validating, setValidating] = useState(false);
  const [validateError, setValidateError] = useState("");
  const [preview, setPreview] = useState<ImportValidateResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const isSocios = tipo === "socios";

  const { data: job } = useQuery<ImportJob>({
    queryKey: ["import-job", jobId],
    queryFn: () => importsApi.jobStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "PENDING" || s === "PROCESSING" ? 2000 : false;
    },
  });

  const handleDownloadTemplate = async () => {
    const blob = isSocios
      ? await importsApi.downloadTemplate()
      : await importsApi.downloadAnimalTemplate();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = isSocios ? "plantilla_socios.xlsx" : "plantilla_animales.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setValidateError("");
    setValidating(true);
    try {
      const result = isSocios
        ? await importsApi.validate(file)
        : await importsApi.validateAnimales(file);
      setPreview(result);
      setPhase("preview");
    } catch (err: any) {
      setValidateError(err?.response?.data?.detail ?? "Error al validar el archivo.");
    } finally {
      setValidating(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setConfirming(true);
    try {
      const res = isSocios
        ? await importsApi.confirm(preview.temp_key)
        : await importsApi.confirmAnimales(preview.temp_key);
      setJobId(res.job_id);
      setPhase("processing");
    } catch (err: any) {
      setValidateError(err?.response?.data?.detail ?? "Error al confirmar importación.");
    } finally {
      setConfirming(false);
    }
  };

  const handleReset = () => {
    setPhase("upload");
    setPreview(null);
    setJobId(null);
    setValidateError("");
  };

  const accentColor = isSocios ? "blue" : "green";
  const entityLabel = isSocios ? "socios" : "animales";
  const totalLabel = isSocios ? preview?.total_filas : preview?.filas_ok;

  const statusIcon: Record<string, React.ReactNode> = {
    PENDING:    <Clock size={20} className="text-amber-500" />,
    PROCESSING: <Loader2 size={20} className="text-blue-600 animate-spin" />,
    DONE:       <CheckCircle2 size={20} className="text-green-600" />,
    FAILED:     <XCircle size={20} className="text-red-600" />,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft size={15} />
          Volver
        </button>
        <button onClick={handleDownloadTemplate} className="btn-secondary gap-2 text-sm shrink-0">
          <Download size={15} /> Descargar plantilla
        </button>
      </div>

      {/* ── Upload ── */}
      {phase === "upload" && (
        <div className="card space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Paso 1 — Selecciona el archivo Excel</h2>

          {!isSocios && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 space-y-1">
              <p className="font-medium text-blue-800">Columnas requeridas en el Excel:</p>
              <p><strong>Obligatorias:</strong> numero_anilla, fecha_nacimiento (AAAA-MM-DD), sexo (M/H), socio_dni o socio_numero_socio</p>
              <p><strong>Opcionales:</strong> variedad, padre_anilla, madre_anilla, madre_lote_externo, fecha_incubacion, ganaderia_nacimiento, ganaderia_actual</p>
            </div>
          )}

          <label className={clsx(
            "flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 cursor-pointer transition-colors",
            accentColor === "blue"
              ? "border-gray-300 hover:border-blue-500 hover:bg-blue-50"
              : "border-gray-300 hover:border-green-500 hover:bg-green-50"
          )}>
            <FileSpreadsheet size={40} className="text-gray-400 mb-3" />
            <span className="text-sm font-medium text-gray-700">
              {validating ? "Validando…" : "Haz clic para seleccionar un archivo .xlsx"}
            </span>
            <span className="text-xs text-gray-400 mt-1">Excel (.xlsx)</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="sr-only"
              onChange={handleFileChange}
              disabled={validating}
            />
          </label>

          {validating && (
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <Loader2 size={16} className="animate-spin" /> Analizando el archivo…
            </div>
          )}
          {validateError && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle size={16} className="shrink-0 mt-0.5" /> {validateError}
            </div>
          )}
        </div>
      )}

      {/* ── Preview ── */}
      {phase === "preview" && preview && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-base font-semibold text-gray-800 mb-3">Paso 2 — Previsualización</h2>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center bg-gray-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-gray-900">{preview.total_filas}</div>
                <div className="text-xs text-gray-500">Total filas</div>
              </div>
              <div className="text-center bg-green-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-green-700">{preview.filas_ok}</div>
                <div className="text-xs text-gray-500">Sin errores</div>
              </div>
              <div className="text-center bg-amber-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-amber-700">{preview.filas_con_error}</div>
                <div className="text-xs text-gray-500">{isSocios ? "Con advertencias" : "Con errores"}</div>
              </div>
            </div>

            {preview.columnas_faltantes && preview.columnas_faltantes.length > 0 && (
              <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 mb-4">
                <p className="text-sm font-medium text-blue-800 mb-1">Columnas no encontradas (se importará sin esos datos):</p>
                <p className="text-xs text-blue-700">
                  {preview.columnas_faltantes.map((c: string) => (
                    <code key={c} className="bg-blue-100 px-1 rounded mx-0.5">{c}</code>
                  ))}
                </p>
              </div>
            )}

            {preview.filas_con_error > 0 && (
              <div className={clsx(
                "border rounded-lg p-3 mb-4",
                isSocios ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"
              )}>
                <p className={clsx("text-sm font-medium mb-2", isSocios ? "text-amber-800" : "text-red-800")}>
                  {isSocios
                    ? "Advertencias — estos socios se importarán igualmente:"
                    : "Errores — estas filas se omitirán en la importación:"}
                </p>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {preview.errores.map((e) => (
                    <li key={e.fila} className={clsx("text-xs", isSocios ? "text-amber-700" : "text-red-700")}>
                      <span className="font-medium">Fila {e.fila}:</span> {e.errores.join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 font-semibold text-gray-600">Fila</th>
                    {isSocios ? (
                      <>
                        <th className="px-3 py-2 font-semibold text-gray-600">DNI/NIF</th>
                        <th className="px-3 py-2 font-semibold text-gray-600">Nombre</th>
                        <th className="px-3 py-2 font-semibold text-gray-600">Email</th>
                      </>
                    ) : (
                      <>
                        <th className="px-3 py-2 font-semibold text-gray-600">Anilla</th>
                        <th className="px-3 py-2 font-semibold text-gray-600">Nac.</th>
                        <th className="px-3 py-2 font-semibold text-gray-600">Sexo</th>
                        <th className="px-3 py-2 font-semibold text-gray-600">Socio</th>
                      </>
                    )}
                    <th className="px-3 py-2 font-semibold text-gray-600">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.slice(0, 50).map((row: any) => (
                    <tr key={row.fila} className={`border-b ${row.errores.length > 0 ? (isSocios ? "bg-amber-50" : "bg-red-50") : "hover:bg-gray-50"}`}>
                      <td className="px-3 py-2 text-gray-500">{row.fila}</td>
                      {isSocios ? (
                        <>
                          <td className="px-3 py-2 font-mono">{row.dni_nif || "—"}</td>
                          <td className="px-3 py-2">{row.nombre_razon_social || "—"}</td>
                          <td className="px-3 py-2">{row.email || "—"}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 font-mono">{row.numero_anilla || "—"}</td>
                          <td className="px-3 py-2">{row.fecha_nacimiento || "—"}</td>
                          <td className="px-3 py-2">{row.sexo || "—"}</td>
                          <td className="px-3 py-2">{row.socio || "—"}</td>
                        </>
                      )}
                      <td className="px-3 py-2">
                        {row.errores.length === 0
                          ? <span className="text-green-700 font-medium">OK</span>
                          : <span className={isSocios ? "text-amber-700" : "text-red-700"}>{row.errores.join(", ")}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.preview.length > 50 && (
                <p className="text-xs text-gray-400 text-center mt-2">
                  Mostrando 50 de {preview.preview.length} filas
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleReset} className="btn-secondary">Cancelar</button>
            <button
              onClick={handleConfirm}
              disabled={confirming || (isSocios ? preview.total_filas === 0 : preview.filas_ok === 0)}
              className="btn-primary gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {confirming ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} />}
              Importar {totalLabel} {entityLabel}
            </button>
          </div>
          {validateError && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle size={16} className="shrink-0 mt-0.5" /> {validateError}
            </div>
          )}
        </div>
      )}

      {/* ── Processing ── */}
      {phase === "processing" && job && (
        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            {statusIcon[job.status]}
            <div>
              <h2 className="font-semibold text-gray-800">
                {job.status === "PENDING" && "En cola…"}
                {job.status === "PROCESSING" && "Procesando importación…"}
                {job.status === "DONE" && "Importación completada"}
                {job.status === "FAILED" && "Error en la importación"}
              </h2>
              <p className="text-xs text-gray-400">ID: {job.id}</p>
            </div>
          </div>

          {job.status === "DONE" && job.result_summary && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{job.result_summary.total_rows ?? 0}</div>
                  <div className="text-xs text-gray-500">Procesadas</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-700">{job.result_summary.created ?? 0}</div>
                  <div className="text-xs text-gray-500">Nuevos</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-700">{job.result_summary.updated ?? 0}</div>
                  <div className="text-xs text-gray-500">Actualizados</div>
                </div>
              </div>
              {job.result_summary.errors && job.result_summary.errors.length > 0 && (
                <div className="mt-3 border-t border-green-200 pt-3">
                  <p className="text-xs font-medium text-amber-700 mb-1">
                    {job.result_summary.errors.length} avisos durante el proceso:
                  </p>
                  <ul className="text-xs text-gray-600 space-y-0.5 max-h-32 overflow-y-auto">
                    {job.result_summary.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {job.status === "FAILED" && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              <p className="font-medium mb-1">Error en el proceso:</p>
              <pre className="text-xs overflow-auto max-h-40 whitespace-pre-wrap">{job.error_log}</pre>
            </div>
          )}

          {(job.status === "DONE" || job.status === "FAILED") && (
            <button onClick={handleReset} className="btn-secondary">Nueva importación</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const [selected, setSelected] = useState<ImportType | null>(null);

  if (selected) {
    return (
      <div>
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900">Importaciones</h1>
          <p className="text-sm text-gray-500">
            {selected === "socios" ? "Importar Socios desde Excel" : "Importar Animales desde Excel"}
          </p>
        </div>
        <ImportFlow tipo={selected} onBack={() => setSelected(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Importaciones</h1>
        <p className="text-sm text-gray-500">Importación masiva desde archivo Excel en 2 fases: previsualización y confirmación</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Socios */}
        <button
          onClick={() => setSelected("socios")}
          className="group text-left card hover:shadow-md hover:border-blue-300 border border-gray-200 transition-all duration-200 p-6 space-y-4"
        >
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
              <Users size={24} className="text-blue-600" />
            </div>
            <Upload size={16} className="text-gray-300 group-hover:text-blue-400 transition-colors mt-1" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
              Importar Socios
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Carga masiva de socios desde Excel. Soporta alta, actualización y gestión de bajas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["DNI/NIF", "Email", "Dirección", "Número socio"].map((tag) => (
              <span key={tag} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">
                {tag}
              </span>
            ))}
          </div>
        </button>

        {/* Animales */}
        <button
          onClick={() => setSelected("animales")}
          className="group text-left card hover:shadow-md hover:border-green-300 border border-gray-200 transition-all duration-200 p-6 space-y-4"
        >
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
              <Bird size={24} className="text-green-600" />
            </div>
            <Upload size={16} className="text-gray-300 group-hover:text-green-400 transition-colors mt-1" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 group-hover:text-green-700 transition-colors">
              Importar Animales
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Carga masiva de animales desde Excel. Permite vincular genealogía y asignar socio.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["Anilla", "Sexo/Variedad", "Genealogía", "Socio"].map((tag) => (
              <span key={tag} className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full border border-green-100">
                {tag}
              </span>
            ))}
          </div>
        </button>
      </div>

      {/* Info box */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex gap-3">
        <FileSpreadsheet size={20} className="text-gray-400 shrink-0 mt-0.5" />
        <div className="text-sm text-gray-600 space-y-1">
          <p className="font-medium text-gray-700">¿Cómo funciona?</p>
          <ol className="list-decimal list-inside space-y-0.5 text-xs text-gray-500">
            <li>Descarga la plantilla Excel del tipo de importación que necesites</li>
            <li>Rellena los datos respetando el formato de las columnas</li>
            <li>Sube el archivo — se validará y verás una previsualización antes de confirmar</li>
            <li>Confirma la importación y el sistema procesará los datos en segundo plano</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
