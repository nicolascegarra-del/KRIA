import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reproductoresApi } from "../../api/reproductores";
import AnimalStateChip from "../../components/AnimalStateChip";
import { Bird, ChevronLeft, ChevronRight } from "lucide-react";
import type { Animal } from "../../types";

export default function CatalogoReproductoresPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["reproductores-catalogo", page],
    queryFn: () => reproductoresApi.catalogo({ page }),
  });

  const animals: Animal[] = data?.results ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Bird size={22} className="text-purple-600" />
          Catálogo de Reproductores
        </h1>
        <p className="text-sm text-gray-500">
          {total} reproductores aprobados
        </p>
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
          <span className="text-sm text-gray-500">/ {animal.anio_nacimiento}</span>
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
