import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { documentosApi } from "../../api/documentos";
import { FolderOpen, Upload, Download, Trash2, Loader2, FileText, AlertCircle } from "lucide-react";
import type { Documento } from "../../types";

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function DocumentosPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: docs = [], isLoading } = useQuery<Documento[]>({
    queryKey: ["documentos-general"],
    queryFn: documentosApi.listGeneral,
  });

  const deleteMutation = useMutation({
    mutationFn: documentosApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documentos-general"] }),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setUploading(true);
    try {
      await documentosApi.uploadGeneral(file);
      qc.invalidateQueries({ queryKey: ["documentos-general"] });
    } catch (err: any) {
      setUploadError(err?.response?.data?.detail ?? "Error al subir el archivo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownload = async (doc: Documento) => {
    setDownloadingId(doc.id);
    try {
      const { download_url, nombre_archivo } = await documentosApi.downloadUrl(doc.id);
      const a = document.createElement("a");
      a.href = download_url;
      a.download = nombre_archivo;
      a.target = "_blank";
      a.click();
    } catch {
      // silencioso
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><FolderOpen size={22} className="text-blue-700" />Repositorio General</h1>
          <p className="text-sm text-gray-500">Documentos de la asociación accesibles por gestión</p>
        </div>
        <label className="btn-primary gap-2 cursor-pointer">
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {uploading ? "Subiendo…" : "Subir documento"}
          <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {uploadError && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle size={16} className="shrink-0" />{uploadError}
        </div>
      )}

      <div className="card">
        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : docs.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileText size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No hay documentos</p>
            <p className="text-sm mt-1">Sube el primer documento usando el botón superior.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <FileText size={20} className="text-blue-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{doc.nombre_archivo}</div>
                  <div className="text-xs text-gray-400">
                    v{doc.version} · {formatBytes(doc.tamanio_bytes)} · {new Date(doc.created_at).toLocaleDateString("es-ES")}
                    {doc.subido_por_nombre && ` · ${doc.subido_por_nombre}`}
                  </div>
                </div>
                <button onClick={() => handleDownload(doc)} disabled={downloadingId === doc.id} className="text-gray-400 hover:text-blue-600 p-2 min-h-[40px] min-w-[40px] flex items-center justify-center" aria-label="Descargar">
                  {downloadingId === doc.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                </button>
                <button onClick={() => { if (confirm(`¿Eliminar "${doc.nombre_archivo}"?`)) deleteMutation.mutate(doc.id); }} className="text-gray-400 hover:text-red-600 p-2 min-h-[40px] min-w-[40px] flex items-center justify-center" aria-label="Eliminar">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
