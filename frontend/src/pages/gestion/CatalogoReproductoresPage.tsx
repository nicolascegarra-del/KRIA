import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reproductoresApi } from "../../api/reproductores";
import AnimalStateChip from "../../components/AnimalStateChip";
import { Bird, ChevronLeft, ChevronRight, Printer, Loader2 } from "lucide-react";
import type { Animal } from "../../types";

export default function CatalogoReproductoresPage() {
  const [page, setPage] = useState(1);
  const [printing, setPrinting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["reproductores-catalogo", page],
    queryFn: () => reproductoresApi.catalogo({ page }),
  });

  const animals: Animal[] = data?.results ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.ceil(total / 20);

  const handlePrint = async () => {
    setPrinting(true);
    try {
      // Fetch all reproducers
      const allData = await reproductoresApi.catalogo({ page: 1, page_size: 200 });
      const all: Animal[] = allData.results ?? [];

      const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Catálogo de Reproductores</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; }
  .page { width: 210mm; min-height: 297mm; padding: 20mm; page-break-after: always; display: flex; flex-direction: column; }
  .page:last-child { page-break-after: avoid; }
  .header { border-bottom: 3px solid #1565C0; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
  .header-title { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .header-num { font-size: 11px; color: #1565C0; font-weight: 700; }
  .animal-id { font-family: monospace; font-size: 28px; font-weight: 900; color: #1565C0; margin-bottom: 4px; }
  .animal-year { font-size: 16px; color: #666; margin-bottom: 16px; }
  .content { display: flex; gap: 24px; flex: 1; }
  .photo-area { width: 160px; flex-shrink: 0; }
  .photo { width: 160px; height: 180px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb; }
  .photo-placeholder { width: 160px; height: 180px; background: #f3f4f6; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #d1d5db; font-size: 40px; border: 1px solid #e5e7eb; }
  .info { flex: 1; }
  .section-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 2px; margin-top: 12px; }
  .section-label:first-child { margin-top: 0; }
  .section-value { font-size: 14px; color: #111; font-weight: 500; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; background: #dcfce7; color: #166534; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
  .footer { border-top: 1px solid #e5e7eb; padding-top: 10px; margin-top: 20px; font-size: 9px; color: #9ca3af; display: flex; justify-content: space-between; }
  @media print {
    @page { size: A4; margin: 0; }
    .page { width: 210mm; min-height: 297mm; }
  }
</style>
</head>
<body>
${all.map((a, i) => {
  const perfilFoto = a.fotos?.find(f => f.tipo === 'PERFIL');
  const cabezaFoto = a.fotos?.find(f => f.tipo === 'CABEZA');
  const year = a.fecha_nacimiento ? new Date(a.fecha_nacimiento).getFullYear() : '—';
  return `<div class="page">
  <div class="header">
    <div>
      <div class="header-title">Catálogo de Reproductores Aprobados</div>
    </div>
    <div class="header-num">Nº ${i + 1} / ${all.length}</div>
  </div>
  <div class="animal-id">${a.numero_anilla}</div>
  <div class="animal-year">Nacimiento: ${a.fecha_nacimiento ? new Date(a.fecha_nacimiento).toLocaleDateString('es-ES') : '—'} &nbsp;·&nbsp; Año ${year}</div>
  <div class="content">
    <div class="photo-area">
      ${perfilFoto ? `<img class="photo" src="${perfilFoto.url}" alt="Foto perfil" crossorigin="anonymous" />` : `<div class="photo-placeholder">🐦</div>`}
      ${cabezaFoto ? `<img class="photo" src="${cabezaFoto.url}" alt="Foto cabeza" crossorigin="anonymous" style="margin-top:8px" />` : ''}
    </div>
    <div class="info">
      <div class="section-label">Estado</div>
      <div><span class="badge">Reproductor Aprobado</span></div>
      <div class="grid2">
        <div>
          <div class="section-label">Sexo</div>
          <div class="section-value">${a.sexo === 'M' ? '♂ Macho' : '♀ Hembra'}</div>
        </div>
        <div>
          <div class="section-label">Variedad</div>
          <div class="section-value">${a.variedad ?? '—'}</div>
        </div>
        <div>
          <div class="section-label">Ganadería propietaria</div>
          <div class="section-value">${a.socio_nombre ?? '—'}</div>
        </div>
        <div>
          <div class="section-label">Ganadería actual</div>
          <div class="section-value">${a.ganaderia_actual ?? '—'}</div>
        </div>
        <div>
          <div class="section-label">Ganadería nacimiento</div>
          <div class="section-value">${a.ganaderia_nacimiento ?? '—'}</div>
        </div>
        <div>
          <div class="section-label">Anilla</div>
          <div class="section-value" style="font-family:monospace">${a.numero_anilla}</div>
        </div>
      </div>
      ${(a.padre_anilla || a.madre_anilla) ? `
      <div style="margin-top:12px; padding-top:12px; border-top:1px solid #f3f4f6;">
        <div class="section-label">Genealogía</div>
        ${a.padre_anilla ? `<div class="section-value" style="font-size:13px">Padre: <span style="font-family:monospace">${a.padre_anilla}</span>${a.padre_anio_nacimiento ? ` (${a.padre_anio_nacimiento})` : ''}</div>` : ''}
        ${a.madre_anilla ? `<div class="section-value" style="font-size:13px">Madre: <span style="font-family:monospace">${a.madre_anilla}</span>${a.madre_anio_nacimiento ? ` (${a.madre_anio_nacimiento})` : ''}</div>` : ''}
      </div>` : ''}
    </div>
  </div>
  <div class="footer">
    <span>KRIA — Catálogo de Reproductores</span>
    <span>Generado el ${new Date().toLocaleDateString('es-ES')}</span>
  </div>
</div>`;
}).join('')}
</body>
</html>`;

      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        setTimeout(() => { win.focus(); win.print(); }, 800);
      }
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Bird size={22} className="text-purple-600" />
            Catálogo de Reproductores
          </h1>
          <p className="text-sm text-gray-500">{total} reproductores aprobados</p>
        </div>
        {total > 0 && (
          <button onClick={handlePrint} disabled={printing} className="btn-secondary flex items-center gap-2 text-sm">
            {printing ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
            Imprimir catálogo
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card h-28 animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : animals.length === 0 ? (
        <div className="card text-center py-16">
          <Bird size={48} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No hay reproductores en el catálogo.</p>
          <p className="text-sm text-gray-400 mt-1">
            Los animales aprobados como reproductores aparecerán aquí.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {animals.map((animal) => (
              <ReproductorCard key={animal.id} animal={animal} />
            ))}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary flex items-center gap-1 disabled:opacity-40"
              >
                <ChevronLeft size={16} /> Anterior
              </button>
              <span className="text-sm text-gray-500">
                Página {page} de {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary flex items-center gap-1 disabled:opacity-40"
              >
                Siguiente <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReproductorCard({ animal }: { animal: Animal }) {
  const perfilFoto = animal.fotos?.find((f) => f.tipo === "PERFIL");

  return (
    <div className="card flex gap-3">
      {perfilFoto ? (
        <img
          src={perfilFoto.url}
          alt={`Foto de ${animal.numero_anilla}`}
          className="w-20 h-20 object-cover rounded-lg shrink-0"
        />
      ) : (
        <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
          <Bird size={28} className="text-gray-300" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-mono font-semibold text-gray-900">{animal.numero_anilla}</span>
          <span className="text-sm text-gray-500">/ {animal.fecha_nacimiento ? new Date(animal.fecha_nacimiento).getFullYear() : "—"}</span>
          <AnimalStateChip estado={animal.estado} />
        </div>
        <div className="text-sm text-gray-600">
          {animal.sexo === "M" ? "♂ Macho" : "♀ Hembra"} · {animal.variedad}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">{animal.socio_nombre}</div>
        {animal.ganaderia_actual && (
          <div className="text-xs text-gray-400 truncate">{animal.ganaderia_actual}</div>
        )}
      </div>
    </div>
  );
}
