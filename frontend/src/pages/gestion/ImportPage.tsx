import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { importsApi } from "../../api/imports";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Download,
  AlertCircle,
  CheckCheck,
} from "lucide-react";
import type { ImportJob, ImportValidateResult } from "../../types";

type Phase = "upload" | "preview" | "processing";

export default function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("upload");
  const [validating, setValidating] = useState(false);
  const [validateError, setValidateError] = useState("");
  const [preview, setPreview] = useState<ImportValidateResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Poll job status while processing
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
    const blob = await importsApi.downloadTemplate();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_socios.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setValidateError("");
    setValidating(true);
    try {
      const result = await importsApi.validate(file);
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
      const res = await importsApi.confirm(preview.temp_key);
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

  const statusIcon: Record<string, React.ReactNode> = {
    PENDING: <Clock size={20} className="text-amber-500" />,
    PROCESSING: <Loader2 size={20} className="text-blue-600 animate-spin" />,
    DONE: <CheckCircle2 size={20} className="text-green-600" />,
    FAILED: <XCircle size={20} className="text-red-600" />,
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Importar Socios</h1>
          <p className="text-sm text-gray-500">Importación en 2 fases: previsualización + confirmación</p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="btn-secondary gap-2 text-sm shrink-0"
        >
          <Download size={16} /> Plantilla Excel
        </button>
      </div>

      {/* ── Fase 1: Upload ──────────────────────────────────────────────────── */}
      {phase === "upload" && (
        <div className="card space-y-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Paso 1 — Selecciona el archivo</h2>
            <p className="text-sm text-gray-500 mt-1">
              Columnas requeridas:{" "}
              {["dni_nif", "nombre_razon_social", "email"].map((c) => (
                <code key={c} className="bg-gray-100 px-1 rounded mx-0.5">{c}</code>
              ))}
            </p>
          </div>

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-10 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
            <FileSpreadsheet size={40} className="text-gray-400 mb-3" />
            <span className="text-sm font-medium text-gray-700">
              {validating ? "Validando..." : "Haz clic para seleccionar un archivo .xlsx"}
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
              <Loader2 size={16} className="animate-spin" />
              Analizando el archivo…
            </div>
          )}

          {validateError && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              {validateError}
            </div>
          )}
        </div>
      )}

      {/* ── Fase 2: Preview ─────────────────────────────────────────────────── */}
      {phase === "preview" && preview && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-base font-semibold text-gray-800 mb-3">
              Paso 2 — Previsualización del archivo
            </h2>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center bg-gray-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-gray-900">{preview.total_filas}</div>
                <div className="text-xs text-gray-500">Total filas</div>
              </div>
              <div className="text-center bg-green-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-green-700">{preview.filas_ok}</div>
                <div className="text-xs text-gray-500">Sin errores</div>
              </div>
              <div className="text-center bg-red-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-red-700">{preview.filas_con_error}</div>
                <div className="text-xs text-gray-500">Con errores</div>
              </div>
            </div>

            {/* Error list */}
            {preview.filas_con_error > 0 && (
              <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 mb-4">
                <p className="text-sm font-medium text-amber-800 mb-2">
                  Filas con errores (no se importarán):
                </p>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {preview.errores.map((e) => (
                    <li key={e.fila} className="text-xs text-amber-700">
                      <span className="font-medium">Fila {e.fila}:</span>{" "}
                      {e.errores.join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preview table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 font-semibold text-gray-600">Fila</th>
                    <th className="px-3 py-2 font-semibold text-gray-600">DNI/NIF</th>
                    <th className="px-3 py-2 font-semibold text-gray-600">Nombre</th>
                    <th className="px-3 py-2 font-semibold text-gray-600">Email</th>
                    <th className="px-3 py-2 font-semibold text-gray-600">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.slice(0, 50).map((row) => (
                    <tr
                      key={row.fila}
                      className={`border-b ${row.errores.length > 0 ? "bg-red-50" : "hover:bg-gray-50"}`}
                    >
                      <td className="px-3 py-2 text-gray-500">{row.fila}</td>
                      <td className="px-3 py-2 font-mono">{row.dni_nif || "—"}</td>
                      <td className="px-3 py-2">{row.nombre_razon_social || "—"}</td>
                      <td className="px-3 py-2">{row.email || "—"}</td>
                      <td className="px-3 py-2">
                        {row.errores.length === 0 ? (
                          <span className="text-green-700 font-medium">OK</span>
                        ) : (
                          <span className="text-red-700">{row.errores.join(", ")}</span>
                        )}
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

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={handleReset} className="btn-secondary">
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirming || preview.filas_ok === 0}
              className="btn-primary gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {confirming ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCheck size={16} />
              )}
              Confirmar importación ({preview.filas_ok} filas válidas)
            </button>
          </div>

          {validateError && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              {validateError}
            </div>
          )}
        </div>
      )}

      {/* ── Fase 3: Job status ──────────────────────────────────────────────── */}
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
                    {job.result_summary.errors.length} errores en proceso:
                  </p>
                  <ul className="text-xs text-gray-600 space-y-0.5 max-h-32 overflow-y-auto">
                    {job.result_summary.errors.map((e, i) => <li key={i}>{e}</li>)}
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
            <button onClick={handleReset} className="btn-secondary">
              Nueva importación
            </button>
          )}
        </div>
      )}
    </div>
  );
}
