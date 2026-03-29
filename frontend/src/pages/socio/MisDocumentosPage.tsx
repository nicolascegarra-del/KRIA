import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { documentosApi } from "../../api/documentos";
import { useAuthStore } from "../../store/authStore";
import { FolderOpen, Download, FileText, Loader2 } from "lucide-react";
import type { Documento } from "../../types";

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function MisDocumentosPage() {
  const { user } = useAuthStore();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // El socio ve su propio buzón — necesita su socio_id
  // Lo obtenemos de /socios/me/ o desde el token; usamos el endpoint de lista filtrado por el propio usuario
  const { data: docs = [], isLoading } = useQuery<Documento[]>({
    queryKey: ["mis-documentos"],
    queryFn: async () => {
      // Intentamos obtener el socio_id del usuario actual
      const { apiClient } = await import("../../api/client");
      const { data: socio } = await apiClient.get("/socios/me/");
      return documentosApi.listSocio(socio.id);
    },
    enabled: !!user,
  });

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
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><FolderOpen size={22} className="text-blue-700" />Mis Documentos</h1>
        <p className="text-sm text-gray-500">Documentos que la asociación ha enviado a tu buzón</p>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : docs.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileText size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No tienes documentos</p>
            <p className="text-sm mt-1">La asociación te enviará documentos aquí cuando estén disponibles.</p>
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
                  </div>
                </div>
                <button onClick={() => handleDownload(doc)} disabled={downloadingId === doc.id} className="text-gray-400 hover:text-blue-600 p-2 min-h-[40px] min-w-[40px] flex items-center justify-center" aria-label="Descargar">
                  {downloadingId === doc.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
