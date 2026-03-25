import { apiClient } from "./client";
import type { SolicitudRealta } from "../types";

export const realtaApi = {
  /** POST /animals/:id/solicitar-realta/ — socio solicita reactivación */
  solicitar: async (animalId: string, notas: string) => {
    const { data } = await apiClient.post<SolicitudRealta>(`/animals/${animalId}/solicitar-realta/`, { notas });
    return data;
  },

  /** GET /dashboard/solicitudes-realta/ — lista pendientes (gestión) */
  list: async () => {
    const { data } = await apiClient.get<SolicitudRealta[]>("/dashboard/solicitudes-realta/");
    return Array.isArray(data) ? data : ((data as any).results ?? []);
  },

  /** POST /dashboard/solicitudes-realta/:id/resolver/ — aprobar o denegar */
  resolver: async (id: string, aprobado: boolean, notas?: string) => {
    const { data } = await apiClient.post<SolicitudRealta>(`/dashboard/solicitudes-realta/${id}/resolver/`, {
      accion: aprobado ? "aprobar" : "denegar",
      notas: notas ?? "",
    });
    return data;
  },
};
