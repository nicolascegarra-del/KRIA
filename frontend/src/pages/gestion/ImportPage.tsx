import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { sociosApi } from "../../api/socios";
import { apiClient } from "../../api/client";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import type { ImportJob } from "../../types";

export default function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Poll job status
  const { data: job } = useQuery<ImportJob>({
    queryKey: ["import-job", jobId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/imports/job/${jobId}/`);
      return data;
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "PENDING" || status === "PROCESSING" ? 2000 : false;
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError("");
    setUploading(true);
    try {
      const res = await sociosApi.import(file);
      setJobId(res.job_id);
    } catch (err: any) {
      setUploadError(err?.response?.data?.detail ?? "Error al subir el archivo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const statusIcon = {
    PENDING: <Clock size={20} className="text-amber-500" />,
    PROCESSING: <Loader2 size={20} className="text-blue-600 animate-spin" />,
    DONE: <CheckCircle2 size={20} className="text-green-600" />,
    FAILED: <XCircle size={20} className="text-red-600" />,
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Importar Socios</h1>
        <p className="text-sm text-gray-500">Sube un Excel con datos de socios para UPSERT masivo</p>
      </div>

      {/* Upload area */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-800 mb-2">Archivo Excel</h2>
        <p className="text-sm text-gray-500 mb-4">
          Columnas requeridas: <code className="bg-gray-100 px-1 rounded">dni_nif</code>,{" "}
          <code className="bg-gray-100 px-1 rounded">nombre_razon_social</code>,{" "}
          <code className="bg-gray-100 px-1 rounded">email</code>.
          Opcionales: first_name, last_name, telefono, direccion, numero_socio, codigo_rega.
        </p>

        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
          <FileSpreadsheet size={40} className="text-gray-400 mb-3" />
          <span className="text-sm font-medium text-gray-700">
            {uploading ? "Subiendo..." : "Haz clic para seleccionar un archivo .xlsx"}
          </span>
          <span className="text-xs text-gray-400 mt-1">Excel (.xlsx, .xls)</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="sr-only"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </label>

        {uploadError && (
          <p className="mt-2 text-sm text-red-600">{uploadError}</p>
        )}
      </div>

      {/* Job status */}
      {job && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            {statusIcon[job.status]}
            <h2 className="font-semibold text-gray-800">
              Estado: {job.status}
            </h2>
          </div>

          {job.status === "DONE" && job.result_summary && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{job.result_summary.total_rows ?? 0}</div>
                  <div className="text-xs text-gray-500">Filas procesadas</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-700">{job.result_summary.created ?? 0}</div>
                  <div className="text-xs text-gray-500">Nuevos socios</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-700">{job.result_summary.updated ?? 0}</div>
                  <div className="text-xs text-gray-500">Actualizados</div>
                </div>
              </div>
              {job.result_summary.errors && job.result_summary.errors.length > 0 && (
                <div className="mt-3 border-t border-green-200 pt-3">
                  <p className="text-xs font-medium text-amber-700 mb-1">
                    {job.result_summary.errors.length} errores:
                  </p>
                  <ul className="text-xs text-gray-600 space-y-0.5 max-h-32 overflow-y-auto">
                    {job.result_summary.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
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

          <div className="text-xs text-gray-400">
            ID: {job.id}
            {job.finished_at && ` · Finalizado: ${new Date(job.finished_at).toLocaleString("es-ES")}`}
          </div>
        </div>
      )}
    </div>
  );
}
