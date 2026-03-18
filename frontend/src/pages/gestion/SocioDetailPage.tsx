import { useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sociosApi } from "../../api/socios";
import { animalsApi } from "../../api/animals";
import { granjasApi } from "../../api/granjas";
import { documentosApi } from "../../api/documentos";
import AnimalStateChip from "../../components/AnimalStateChip";
import SuccessToast from "../../components/SuccessToast";
import ErrorAlert from "../../components/ErrorAlert";
import { useAutoCloseError } from "../../hooks/useAutoCloseError";
import {
  ArrowLeft,
  Bird,
  Building2,
  FileText,
  Upload,
  Download,
  Trash2,
  Loader2,
} from "lucide-react";
import type { Documento } from "../../types";
import clsx from "clsx";

type Tab = "animales" | "granjas" | "documentos";

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function SocioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("animales");
  const [successMsg, setSuccessMsg] = useState("");
  const [uploadError, setUploadError, clearUploadError] = useAutoCloseError();
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: socio, isLoading } = useQuery({
    queryKey: ["socio", id],
    queryFn: () => sociosApi.get(id!),
    enabled: !!id,
  });

  const { data: animalesData } = useQuery({
    queryKey: ["animals", { socio_id: id }],
    queryFn: () => animalsApi.list({ socio_id: id! }),
    enabled: tab === "animales" && !!id,
  });

  const { data: granjasData } = useQuery({
    queryKey: ["granjas", { socio_id: id }],
    queryFn: () => granjasApi.list(),
    enabled: tab === "granjas" && !!id,
  });

  const { data: docs = [], isLoading: loadingDocs } = useQuery<Documento[]>({
    queryKey: ["documentos-socio", id],
    queryFn: () => documentosApi.listSocio(id!),
    enabled: tab === "documentos" && !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: documentosApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documentos-socio", id] });
      setSuccessMsg("Documento eliminado.");
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    clearUploadError();
    setUploading(true);
    try {
      await documentosApi.uploadSocio(id, file);
      qc.invalidateQueries({ queryKey: ["documentos-socio", id] });
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

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "animales", label: "Animales", icon: <Bird size={15} /> },
    { key: "granjas", label: "Granjas", icon: <Building2 size={15} /> },
    { key: "documentos", label: "Documentos", icon: <FileText size={15} /> },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={32} className="animate-spin text-blue-700" />
      </div>
    );
  }

  if (!socio) {
    return (
      <div className="card text-center py-12 text-gray-500">Socio no encontrado.</div>
    );
  }

  const animales = animalesData?.results ?? [];
  // Filtrar solo las granjas de este socio (el backend devuelve todas para gestión)
  const granjas = (granjasData?.results ?? []).filter((g) => g.socio === id);

  return (
    <div className="space-y-4 max-w-3xl">
      <SuccessToast message={successMsg} onDismiss={() => setSuccessMsg("")} />

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/socios")}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Volver"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{socio.nombre_razon_social}</h1>
          <p className="text-sm text-gray-500">{socio.email}</p>
        </div>
        <span
          className={clsx(
            "text-xs font-semibold px-2.5 py-1 rounded-full",
            socio.estado === "ALTA" ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"
          )}
        >
          {socio.estado}
        </span>
      </div>

      {/* Datos del socio */}
      <div className="card">
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {[
            { label: "DNI / NIF", value: socio.dni_nif },
            { label: "Nº Socio", value: socio.numero_socio || "—" },
            { label: "Código REGA", value: socio.codigo_rega || "—" },
            { label: "Teléfono", value: socio.telefono || "—" },
            { label: "Dirección", value: socio.direccion || "—" },
            { label: "Nombre", value: socio.full_name || "—" },
          ].map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-gray-400">{label}</dt>
              <dd className="font-medium text-gray-800 truncate">{value}</dd>
            </div>
          ))}
          {socio.estado === "BAJA" && socio.razon_baja && (
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-xs text-gray-400">Razón de baja</dt>
              <dd className="text-red-700">{socio.razon_baja}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              tab === t.key ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Animales */}
      {tab === "animales" && (
        <div className="card">
          {animales.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Bird size={36} className="mx-auto mb-2 text-gray-300" />
              <p>No hay animales registrados.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {animales.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <span className="font-mono font-medium text-gray-900">{a.numero_anilla}</span>
                    <span className="text-sm text-gray-500 ml-2">/ {a.anio_nacimiento}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{a.variedad}</span>
                    <AnimalStateChip estado={a.estado} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Granjas */}
      {tab === "granjas" && (
        <div className="card">
          {granjas.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Building2 size={36} className="mx-auto mb-2 text-gray-300" />
              <p>No hay granjas registradas.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {granjas.map((g) => (
                <div key={g.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="font-medium text-gray-900">{g.nombre}</div>
                  {g.codigo_rega && (
                    <div className="text-xs text-gray-400 mt-0.5">REGA: {g.codigo_rega}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Documentos */}
      {tab === "documentos" && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Buzón del socio</h2>
            <label className="btn-primary gap-2 cursor-pointer text-sm py-2">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? "Subiendo…" : "Subir documento"}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="sr-only"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </div>

          <ErrorAlert message={uploadError} onDismiss={clearUploadError} />

          {loadingDocs ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FileText size={36} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Sin documentos en el buzón.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <FileText size={18} className="text-blue-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{doc.nombre_archivo}</div>
                    <div className="text-xs text-gray-400">
                      v{doc.version} · {formatBytes(doc.tamanio_bytes)} ·{" "}
                      {new Date(doc.created_at).toLocaleDateString("es-ES")}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload(doc)}
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
                    onClick={() => {
                      if (confirm(`¿Eliminar "${doc.nombre_archivo}"?`)) {
                        deleteMutation.mutate(doc.id);
                      }
                    }}
                    className="text-gray-400 hover:text-red-600 p-2 min-h-[40px] min-w-[40px] flex items-center justify-center"
                    aria-label="Eliminar"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
