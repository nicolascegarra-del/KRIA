import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "../../api/reports";
import { FileText, Download, Loader2, Clock, CheckCircle2, ArrowUpDown, X } from "lucide-react";
import type { ReportJob } from "../../types";

// ─── Sort options ───────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  {
    value: "variedad_anilla",
    label: "Variedad → Nº Anilla",
    description: "Agrupa primero por variedad, luego por número de anilla",
  },
  {
    value: "socio_anilla",
    label: "Solo Nº Anilla (por socio)",
    description: "Agrupado por socio y luego por número de anilla",
  },
  {
    value: "estado_anilla",
    label: "Estado → Nº Anilla",
    description: "Agrupa primero por estado del animal, luego por número de anilla",
  },
  {
    value: "anilla",
    label: "Solo Nº Anilla",
    description: "Ordenado únicamente por número de anilla",
  },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

// ─── Sort order modal ───────────────────────────────────────────────────────

function SortOrderModal({
  value,
  onChange,
  onConfirm,
  onCancel,
  loading,
}: {
  value: SortValue;
  onChange: (v: SortValue) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ArrowUpDown size={18} className="text-blue-700" />
            <div>
              <div className="font-semibold text-gray-900 text-sm">Ordenar por…</div>
              <div className="text-xs text-gray-500">Inventario · PDF</div>
            </div>
          </div>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-2">
          {SORT_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                value === opt.value
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="sort-order"
                value={opt.value}
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
                className="mt-0.5 accent-blue-700"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">{opt.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onCancel} className="btn-secondary flex-1" disabled={loading}>
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} disabled={loading} className="btn-primary flex-1">
            {loading ? (
              <><Loader2 size={15} className="animate-spin" /> Iniciando…</>
            ) : (
              "Generar PDF"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Job status polling ─────────────────────────────────────────────────────

function ReportJobStatus({ jobId }: { jobId: string }) {
  const { data } = useQuery<ReportJob>({
    queryKey: ["report-job", jobId],
    queryFn: () => reportsApi.jobStatus(jobId),
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "PENDING" || s === "PROCESSING" ? 2000 : false;
    },
  });

  if (!data) return <div className="text-xs text-gray-400 animate-pulse">Iniciando...</div>;

  return (
    <div className="text-xs space-y-1">
      <div className="flex items-center gap-1">
        {data.status === "DONE" ? (
          <CheckCircle2 size={14} className="text-green-600" />
        ) : data.status === "FAILED" ? (
          <span className="text-red-600">✗</span>
        ) : (
          <Clock size={14} className="text-amber-500 animate-pulse" />
        )}
        <span className="text-gray-600">{data.status}</span>
      </div>
      {data.status === "DONE" && data.download_url && (
        <button
          onClick={() => reportsApi.downloadFile(jobId)}
          className="flex items-center gap-1 text-blue-700 hover:underline"
        >
          <Download size={12} />
          Descargar
        </button>
      )}
      {data.status === "FAILED" && (
        <div className="text-red-600 space-y-0.5">
          <p className="font-medium">Error al generar</p>
          {data.error_log && (
            <pre className="text-xs text-red-500 whitespace-pre-wrap break-all bg-red-50 rounded p-1 max-h-32 overflow-y-auto">
              {data.error_log}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function MisReportesPage() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [formato, setFormato] = useState<"pdf" | "excel">("pdf");
  const [sortModal, setSortModal] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortValue>("variedad_anilla");

  const generate = async (orden?: SortValue) => {
    setGenerating(true);
    try {
      const res = await reportsApi.inventory(undefined, formato, orden);
      setJobId(res.job_id);
    } finally {
      setGenerating(false);
    }
  };

  const handleClick = () => {
    if (formato === "pdf") {
      setSortModal(true);
    } else {
      generate();
    }
  };

  const handleConfirmSort = async () => {
    setSortModal(false);
    await generate(sortOrder);
  };

  return (
    <>
      {sortModal && (
        <SortOrderModal
          value={sortOrder}
          onChange={setSortOrder}
          onConfirm={handleConfirmSort}
          onCancel={() => setSortModal(false)}
          loading={generating}
        />
      )}

      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mis Reportes</h1>
          <p className="text-sm text-gray-500">
            Genera documentos con el listado de tus animales registrados
          </p>
        </div>

        <div className="max-w-sm">
          <div className="card space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-700 text-white p-2.5 rounded-xl">
                <FileText size={24} />
              </div>
              <div>
                <div className="font-semibold text-gray-900 text-sm">Inventario</div>
                <div className="text-xs text-gray-500">Listado completo de tus animales</div>
              </div>
            </div>

            {/* Format selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Formato:</span>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                {(["pdf", "excel"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setFormato(fmt)}
                    className={`px-3 py-1 transition-colors ${
                      formato === fmt
                        ? "bg-blue-700 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {fmt === "pdf" ? "PDF" : "Excel"}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleClick}
              disabled={generating}
              className="btn-primary w-full disabled:opacity-50"
            >
              {generating ? (
                <><Loader2 size={16} className="animate-spin" /> Iniciando...</>
              ) : (
                "Generar"
              )}
            </button>

            {jobId && <ReportJobStatus jobId={jobId} />}
          </div>
        </div>
      </div>
    </>
  );
}
