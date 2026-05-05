import clsx from "clsx";
import type { AnimalEstado } from "../types";

const STATE_CONFIG: Record<AnimalEstado, { label: string; classes: string }> = {
  REGISTRADO: { label: "Registrado",  classes: "bg-yellow-400 text-yellow-900" },
  MODIFICADO: { label: "Modificado",  classes: "bg-orange-500 text-white" },
  APROBADO:   { label: "Aprobado",    classes: "bg-green-800 text-white" },
  EVALUADO:   { label: "Evaluado",    classes: "bg-yellow-500 text-yellow-900" },
  RECHAZADO:  { label: "Rechazado",   classes: "bg-red-700 text-white" },
  SOCIO_EN_BAJA:    { label: "Socio en Baja",    classes: "bg-gray-500 text-white" },
  BAJA:             { label: "Baja",             classes: "bg-slate-700 text-white" },
  PENDIENTE_CESION: { label: "Cesión pendiente", classes: "bg-purple-600 text-white" },
};

export default function AnimalStateChip({ estado }: { estado: AnimalEstado }) {
  const config = STATE_CONFIG[estado] ?? { label: estado, classes: "bg-gray-300 text-gray-700" };
  return (
    <span className={clsx("estado-chip", config.classes)}>
      {config.label}
    </span>
  );
}
