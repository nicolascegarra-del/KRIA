import { Link } from "react-router-dom";
import { Bird, Camera } from "lucide-react";
import clsx from "clsx";
import type { Animal } from "../types";
import AnimalStateChip from "./AnimalStateChip";

interface Props {
  animal: Animal;
  showSocio?: boolean;
}

export default function AnimalCard({ animal, showSocio = false }: Props) {
  const firstPhoto = animal.fotos?.[0]?.url;
  const sexoLabel = animal.sexo === "M" ? "♂ Macho" : "♀ Hembra";
  const variedadLabel = animal.variedad === "SALMON" ? "Salmón" : animal.variedad === "PLATA" ? "Plata" : "Otra";

  return (
    <Link
      to={`/mis-animales/${animal.id}`}
      className="card hover:shadow-md transition-shadow block"
    >
      <div className="flex gap-3">
        {/* Photo or placeholder */}
        <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
          {firstPhoto ? (
            <img src={firstPhoto} alt={animal.numero_anilla} className="w-full h-full object-cover" />
          ) : (
            <Camera size={24} className="text-gray-400" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <div className="font-semibold text-gray-900 text-sm">
                {animal.numero_anilla}
              </div>
              <div className="text-xs text-gray-500">
                {animal.fecha_nacimiento ? new Date(animal.fecha_nacimiento).getFullYear() : "—"} · {sexoLabel} · {variedadLabel}
              </div>
            </div>
            <AnimalStateChip estado={animal.estado} />
          </div>

          {showSocio && (
            <div className="text-xs text-gray-500 mt-1">{animal.socio_nombre}</div>
          )}

          <div className="flex items-center gap-3 mt-2">
            {animal.padre_anilla && (
              <span className="text-xs text-gray-400">
                ♂ {animal.padre_anilla}
              </span>
            )}
            {animal.madre_anilla && (
              <span className="text-xs text-gray-400">
                ♀ {animal.madre_anilla}
              </span>
            )}
            {animal.candidato_reproductor && (
              <span className="text-xs font-medium text-amber-600">★ Candidato</span>
            )}
            {animal.granja_nombre && (
              <span className="text-xs text-gray-400">🏠 {animal.granja_nombre}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
