import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "../../api/reports";
import { animalsApi } from "../../api/animals";
import { FileText, Table, BookOpen, Download, Loader2, Clock, CheckCircle2, Search, User } from "lucide-react";
import type { ReportJob } from "../../types";

// ─── Animal search picker ───────────────────────────────────────────────────

function AnimalPicker({
  label,
  onSelect,
}: {
  label: string;
  onSelect: (id: string, label: string) => void;
}) {
  const [anilla, setAnilla] = useState("");
  const [anio, setAnio] = useState(String(new Date().getFullYear()));

  const { data: results, isFetching } = useQuery({
    queryKey: ["animals-search-report", anilla, anio],
    queryFn: () => animalsApi.searchByAnilla(anilla, anio ? parseInt(anio, 10) : undefined),
    enabled: anilla.length >= 2,
  });

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">{label}</p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="input-field pl-8 text-sm font-mono"
            placeholder="Nº anilla"
            value={anilla}
            onChange={(e) => setAnilla(e.target.value)}
          />
        </div>
        <input
          type="number"
          className="input-field w-20 text-sm"
          placeholder="Año"
          value={anio}
          onChange={(e) => setAnio(e.target.value)}
          min={2000}
          max={new Date().getFullYear()}
        />
        {isFetching && <Loader2 size={14} className="animate-spin self-center text-gray-400" />}
      </div>
      {results && results.length > 0 && (
        <ul className="bg-white border border-gray-200 rounded-lg shadow-sm divide-y divide-gray-100 max-h-32 overflow-y-auto">
          {results.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex gap-2 items-center"
                onClick={() => {
                  onSelect(a.id, `${a.numero_anilla} / ${a.fecha_nacimiento ? new Date(a.fecha_nacimiento).getFullYear() : "—"}`);
                  setAnilla("");
                }}
              >
                <span className="font-mono font-medium">{a.numero_anilla}</span>
                <span className="text-gray-400">{a.fecha_nacimiento ? new Date(a.fecha_nacimiento).getFullYear() : "—"} · {a.socio_nombre}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {results && results.length === 0 && anilla.length >= 2 && (
        <p className="text-xs text-gray-400">Sin resultados</p>
      )}
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

interface TileAnimalState {
  selectedId: string;
  selectedLabel: string;
}

export default function ReportesPage() {
  const [jobs, setJobs] = useState<Record<string, string>>({}); // label → job_id
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [animalState, setAnimalState] = useState<Record<string, TileAnimalState>>({});
  const [formato, setFormato] = useState<Record<string, "pdf" | "excel">>({});

  const handleGenerate = async (label: string, action: () => Promise<{ job_id: string }>) => {
    setGenerating((prev) => ({ ...prev, [label]: true }));
    try {
      const res = await action();
      setJobs((prev) => ({ ...prev, [label]: res.job_id }));
    } finally {
      setGenerating((prev) => ({ ...prev, [label]: false }));
    }
  };

  const setAnimalForTile = (tileLabel: string, id: string, label: string) => {
    setAnimalState((prev) => ({ ...prev, [tileLabel]: { selectedId: id, selectedLabel: label } }));
  };

  const getFmt = (label: string): "pdf" | "excel" => formato[label] ?? "pdf";

  const tiles = [
    {
      label: "Inventario",
      description: "Lista completa de animales (todos los socios)",
      icon: <FileText size={24} />,
      color: "bg-blue-700",
      requiresAnimal: false,
      hasFormatSelector: true,
      action: () => reportsApi.inventory(undefined, getFmt("Inventario")),
    },
    {
      label: "Libro Genealógico",
      description: "Excel formato ARCA/Ministerio con toda la genealogía",
      icon: <Table size={24} />,
      color: "bg-green-700",
      requiresAnimal: false,
      hasFormatSelector: false,
      action: () => reportsApi.libroGenealogico(),
    },
    {
      label: "Catálogo Reproductores",
      description: "Reproductores aprobados con puntuaciones",
      icon: <BookOpen size={24} />,
      color: "bg-purple-700",
      requiresAnimal: false,
      hasFormatSelector: true,
      action: () => reportsApi.catalogoReproductores(getFmt("Catálogo Reproductores")),
    },
    {
      label: "Ficha Individual",
      description: "PDF completo de un animal (datos, fotos, genealogía)",
      icon: <User size={24} />,
      color: "bg-orange-600",
      requiresAnimal: true,
      hasFormatSelector: false,
      action: () => {
        const id = animalState["Ficha Individual"]?.selectedId;
        if (!id) throw new Error("Selecciona un animal.");
        return reportsApi.individual(id);
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-500">
          Generación asíncrona — recibirás el enlace de descarga al completar
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((tile) => {
          const animalSel = animalState[tile.label];
          const canGenerate = !tile.requiresAnimal || !!animalSel?.selectedId;

          return (
            <div key={tile.label} className="card space-y-3">
              <div className="flex items-center gap-3">
                <div className={`${tile.color} text-white p-2.5 rounded-xl`}>{tile.icon}</div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{tile.label}</div>
                  <div className="text-xs text-gray-500">{tile.description}</div>
                </div>
              </div>

              {/* Format selector */}
              {tile.hasFormatSelector && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Formato:</span>
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                    {(["pdf", "excel"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setFormato((p) => ({ ...p, [tile.label]: fmt }))}
                        className={`px-3 py-1 transition-colors ${
                          getFmt(tile.label) === fmt
                            ? "bg-blue-700 text-white"
                            : "bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {fmt === "pdf" ? "PDF" : "Excel"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Animal picker for individual reports */}
              {tile.requiresAnimal && (
                animalSel?.selectedId ? (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs">
                    <span className="font-mono font-medium text-blue-800 flex-1">
                      {animalSel.selectedLabel}
                    </span>
                    <button
                      onClick={() => setAnimalState((p) => { const n = { ...p }; delete n[tile.label]; return n; })}
                      className="text-blue-400 hover:text-blue-700"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <AnimalPicker
                    label="Selecciona el animal"
                    onSelect={(id, label) => setAnimalForTile(tile.label, id, label)}
                  />
                )
              )}

              <button
                onClick={() => handleGenerate(tile.label, tile.action)}
                disabled={generating[tile.label] || !canGenerate}
                className="btn-primary w-full disabled:opacity-50"
              >
                {generating[tile.label] ? (
                  <><Loader2 size={16} className="animate-spin" /> Iniciando...</>
                ) : (
                  "Generar"
                )}
              </button>

              {jobs[tile.label] && <ReportJobStatus jobId={jobs[tile.label]} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
