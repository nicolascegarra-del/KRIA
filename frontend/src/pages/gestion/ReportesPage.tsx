import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "../../api/reports";
import { FileText, Table, BookOpen, Download, Loader2, Clock, CheckCircle2 } from "lucide-react";
import type { ReportJob } from "../../types";

interface ReportTile {
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  action: () => Promise<{ job_id: string }>;
}

export default function ReportesPage() {
  const [jobs, setJobs] = useState<Record<string, string>>({}); // label → job_id
  const [generating, setGenerating] = useState<Record<string, boolean>>({});

  const tiles: ReportTile[] = [
    {
      label: "Inventario PDF",
      description: "Lista completa de animales (todos los socios)",
      icon: <FileText size={24} />,
      color: "bg-blue-700",
      action: () => reportsApi.inventory(),
    },
    {
      label: "Libro Genealógico",
      description: "Excel formato ARCA/Ministerio con toda la genealogía",
      icon: <Table size={24} />,
      color: "bg-green-700",
      action: () => reportsApi.libroGenealogico(),
    },
    {
      label: "Catálogo Reproductores",
      description: "PDF editorial: 1 página por animal con gráfico radar",
      icon: <BookOpen size={24} />,
      color: "bg-purple-700",
      action: () => reportsApi.catalogoReproductores(),
    },
  ];

  const handleGenerate = async (tile: ReportTile) => {
    setGenerating((prev) => ({ ...prev, [tile.label]: true }));
    try {
      const res = await tile.action();
      setJobs((prev) => ({ ...prev, [tile.label]: res.job_id }));
    } finally {
      setGenerating((prev) => ({ ...prev, [tile.label]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-500">Generación asíncrona — recibirás el enlace de descarga al completar</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="card space-y-3">
            <div className="flex items-center gap-3">
              <div className={`${tile.color} text-white p-2.5 rounded-xl`}>{tile.icon}</div>
              <div>
                <div className="font-semibold text-gray-900 text-sm">{tile.label}</div>
                <div className="text-xs text-gray-500">{tile.description}</div>
              </div>
            </div>
            <button
              onClick={() => handleGenerate(tile)}
              disabled={generating[tile.label]}
              className="btn-primary w-full"
            >
              {generating[tile.label] ? (
                <><Loader2 size={16} className="animate-spin" /> Iniciando...</>
              ) : (
                "Generar"
              )}
            </button>
            {jobs[tile.label] && (
              <ReportJobStatus jobId={jobs[tile.label]} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

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
        <a
          href={data.download_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-blue-700 hover:underline"
        >
          <Download size={12} />
          Descargar
        </a>
      )}
      {data.status === "FAILED" && (
        <p className="text-red-600">Error al generar</p>
      )}
    </div>
  );
}
