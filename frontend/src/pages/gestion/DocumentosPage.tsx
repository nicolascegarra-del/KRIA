import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { documentosApi } from "../../api/documentos";
import { sociosApi } from "../../api/socios";
import ErrorAlert from "../../components/ErrorAlert";
import SuccessToast from "../../components/SuccessToast";
import { useAutoCloseError } from "../../hooks/useAutoCloseError";
import {
  FolderOpen,
  Upload,
  Download,
  Trash2,
  Loader2,
  FileText,
  Users,
} from "lucide-react";
import type { Documento } from "../../types";
import clsx from "clsx";

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

type Tab = "general" | "socios";

function DocList({
  docs,
  isLoading,
  onDownload,
  onDelete,
  downloadingId,
}: {
  docs: Documento[];
  isLoading: boolean;
  onDownload: (doc: Documento) => void;
  onDelete: (doc: Documento) => void;
  downloadingId: string | null;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }
  if (docs.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <FileText size={40} className="mx-auto mb-3 text-gray-300" />
        <p className="font-medium">No hay documentos</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-gray-100">
      {docs.map((doc) => (
        <div key={doc.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <FileText size={20} className="text-blue-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 truncate">{doc.nombre_archivo}</div>
            <div className="text-xs text-gray-400">
              v{doc.version} · {formatBytes(doc.tamanio_bytes)} ·{" "}
              {new Date(doc.created_at).toLocaleDateString("es-ES")}
              {doc.subido_por_nombre && ` · ${doc.subido_por_nombre}`}
            </div>
          </div>
          <button
            onClick={() => onDownload(doc)}
            disabled={downloadingId === doc.id}
            className="text-gray-400 hover:text-blue-600 p-2 min-h-[40px] min-w-[40px] flex items-center justify-center"
            aria-label="Descargar"
          >
            {downloadingId === doc.id ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
          </button>
          <button
            onClick={() => onDelete(doc)}
            className="text-gray-400 hover:text-red-600 p-2 min-h-[40px] min-w-[40px] flex items-center justify-center"
            aria-label="Eliminar"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function DocumentosPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("general");
  const [selectedSocioId, setSelectedSocioId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError, clearUploadError] = useAutoCloseError();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  // Repositorio general
  const { data: generalDocs = [], isLoading: loadingGeneral } = useQuery<Documento[]>({
    queryKey: ["documentos-general"],
    queryFn: documentosApi.listGeneral,
    enabled: tab === "general",
  });

  // Buzón de socio seleccionado
  const { data: socioDocs = [], isLoading: loadingSocio } = useQuery<Documento[]>({
    queryKey: ["documentos-socio", selectedSocioId],
    queryFn: () => documentosApi.listSocio(selectedSocioId),
    enabled: tab === "socios" && !!selectedSocioId,
  });

  // Lista de socios para el selector
  const { data: sociosData } = useQuery({
    queryKey: ["socios-all"],
    queryFn: () => sociosApi.list({ page: 1 }),
    enabled: tab === "socios",
  });

  const deleteMutation = useMutation({
    mutationFn: documentosApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documentos-general"] });
      qc.invalidateQueries({ queryKey: ["documentos-socio"] });
      setSuccessMsg("Documento eliminado.");
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    clearUploadError();
    setUploading(true);
    try {
      if (tab === "general") {
        await documentosApi.uploadGeneral(file);
        qc.invalidateQueries({ queryKey: ["documentos-general"] });
      } else if (selectedSocioId) {
        await documentosApi.uploadSocio(selectedSocioId, file);
        qc.invalidateQueries({ queryKey: ["documentos-socio", selectedSocioId] });
      }
      setSuccessMsg("Documento subido correctamente.");
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
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = (doc: Documento) => {
    if (confirm(`¿Eliminar "${doc.nombre_archivo}"?`)) {
      deleteMutation.mutate(doc.id);
    }
  };

  const socios = sociosData?.results ?? [];
  const canUploadSocio = tab === "socios" && !!selectedSocioId;

  return (
    <div className="space-y-6 max-w-3xl">
      <SuccessToast message={successMsg} onDismiss={() => setSuccessMsg("")} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FolderOpen size={22} className="text-blue-700" />
            Gestión Documental
          </h1>
          <p className="text-sm text-gray-500">Repositorio general y buzones individuales</p>
        </div>
        <label
          className={clsx(
            "btn-primary gap-2 cursor-pointer",
            (uploading || (tab === "socios" && !selectedSocioId)) &&
              "opacity-50 pointer-events-none"
          )}
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {uploading ? "Subiendo…" : "Subir documento"}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="sr-only"
            onChange={handleUpload}
            disabled={uploading || (tab === "socios" && !selectedSocioId)}
          />
        </label>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("general")}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            tab === "general" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <FolderOpen size={15} />
          Repositorio General
        </button>
        <button
          onClick={() => setTab("socios")}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            tab === "socios" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Users size={15} />
          Buzón de Socios
        </button>
      </div>

      <ErrorAlert message={uploadError} onDismiss={clearUploadError} />

      {/* Tab: Repositorio General */}
      {tab === "general" && (
        <div className="card">
          <p className="text-xs text-gray-400 mb-4">
            Documentos accesibles únicamente por el equipo de gestión.
          </p>
          <DocList
            docs={generalDocs}
            isLoading={loadingGeneral}
            onDownload={handleDownload}
            onDelete={handleDelete}
            downloadingId={downloadingId}
          />
        </div>
      )}

      {/* Tab: Buzón de Socios */}
      {tab === "socios" && (
        <div className="space-y-4">
          <div className="card">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar socio
            </label>
            <select
              className="input-field"
              value={selectedSocioId}
              onChange={(e) => setSelectedSocioId(e.target.value)}
            >
              <option value="">— Elige un socio —</option>
              {socios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre_razon_social}
                  {s.numero_socio ? ` (Nº ${s.numero_socio})` : ""}
                </option>
              ))}
            </select>
            {!selectedSocioId && (
              <p className="text-xs text-gray-400 mt-2">
                Selecciona un socio para ver o subir documentos en su buzón personal.
              </p>
            )}
          </div>

          {selectedSocioId && (
            <div className="card">
              <p className="text-xs text-gray-400 mb-4">
                Solo el socio seleccionado puede ver estos documentos.
              </p>
              <DocList
                docs={socioDocs}
                isLoading={loadingSocio}
                onDownload={handleDownload}
                onDelete={handleDelete}
                downloadingId={downloadingId}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
