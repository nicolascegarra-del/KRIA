import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditoriasApi } from "../../api/auditorias";
import { reportsApi } from "../../api/reports";
import type { AuditoriaSession, AuditoriaEstado, ReportJob } from "../../types";
import {
  ClipboardCheck, Calendar, FileText, Download, Loader2,
} from "lucide-react";

const ESTADO_CONFIG: Record<AuditoriaEstado, { label: string; color: string }> = {
  PLANIFICADA: { label: "Planificada",  color: "bg-blue-100 text-blue-800" },
  EN_CURSO:    { label: "En curso",     color: "bg-amber-100 text-amber-800" },
  COMPLETADA:  { label: "Completada",   color: "bg-green-100 text-green-800" },
  CANCELADA:   { label: "Cancelada",    color: "bg-gray-100 text-gray-500" },
};

function PdfJobInline({ jobId }: { jobId: string }) {
  const { data } = useQuery<ReportJob>({
    queryKey: ["report-job", jobId],
    queryFn: () => reportsApi.jobStatus(jobId),
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "PENDING" || s === "PROCESSING" ? 2000 : false;
    },
  });

  if (!data || data.status === "PENDING" || data.status === "PROCESSING") {
    return (
      <span className="flex items-center gap-1 text-xs text-blue-600">
        <Loader2 size={12} className="animate-spin" /> Generando...
      </span>
    );
  }
  if (data.status === "DONE" && data.download_url) {
    return (
      <a
        href={data.download_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-xs text-blue-700 font-semibold hover:underline"
      >
        <Download size={12} /> Descargar PDF
      </a>
    );
  }
  return <span className="text-xs text-red-500">Error al generar</span>;
}

export default function MisAuditoriasPage() {
  const [pdfJobs, setPdfJobs] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState<Record<string, boolean>>({});

  const { data: auditorias = [], isLoading } = useQuery<AuditoriaSession[]>({
    queryKey: ["mis-auditorias"],
    queryFn: () => auditoriasApi.list(),
  });

  const handleGeneratePdf = async (auditoriaId: string) => {
    setGenerating(g => ({ ...g, [auditoriaId]: true }));
    try {
      const res = await reportsApi.auditoria(auditoriaId);
      setPdfJobs(j => ({ ...j, [auditoriaId]: res.job_id }));
    } finally {
      setGenerating(g => ({ ...g, [auditoriaId]: false }));
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardCheck size={22} className="text-blue-700" />
          Mis Auditorías
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Visitas técnicas de evaluación realizadas por la asociación
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10 text-gray-400">
          <Loader2 size={28} className="animate-spin" />
        </div>
      ) : auditorias.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <ClipboardCheck size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No tienes auditorías registradas</p>
          <p className="text-sm mt-1">La asociación registrará aquí las visitas técnicas a tus instalaciones</p>
        </div>
      ) : (
        <div className="space-y-3">
          {auditorias.map(a => {
            const cfg = ESTADO_CONFIG[a.estado];
            const jobId = pdfJobs[a.id];
            return (
              <div key={a.id} className="card space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar size={11} />
                        {new Date(a.fecha_planificada).toLocaleDateString("es-ES")}
                      </span>
                    </div>
                    {a.auditores && (
                      <p className="text-xs text-gray-400 mt-1">Auditores: {a.auditores}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {a.animales_count} animal{a.animales_count !== 1 ? "es" : ""} evaluado{a.animales_count !== 1 ? "s" : ""}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    {jobId ? (
                      <PdfJobInline jobId={jobId} />
                    ) : (
                      <button
                        onClick={() => handleGeneratePdf(a.id)}
                        disabled={generating[a.id]}
                        className="flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-900 font-medium"
                      >
                        {generating[a.id]
                          ? <><Loader2 size={12} className="animate-spin" /> Generando...</>
                          : <><FileText size={12} /> Generar informe PDF</>
                        }
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
