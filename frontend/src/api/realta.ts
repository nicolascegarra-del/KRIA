import { apiClient } from "./client";
import type { SolicitudRealta } from "../types";

export const realtaApi = {
  /** POST /animals/:id/solicitar-realta/ — socio solicita re-alta */
  solicitar: async (animalId: string) => {
    const { data } = await apiClient.post<SolicitudRealta>(`/animals/${animalId}/solicitar-realta/`);
    return data;
  },

  /** GET /solicitudes-realta/ — lista pendientes (gestión) */
  list: async () => {
    const { data } = await apiClient.get<SolicitudRealta[]>("/solicitudes-realta/");
    return data;
  },

  /** POST /solicitudes-realta/:id/resolver/ — aprobar o denegar */
  resolver: async (id: string, aprobado: boolean, notas?: string) => {
    const { data } = await apiClient.post<SolicitudRealta>(`/solicitudes-realta/${id}/resolver/`, {
      aprobado,
      notas: notas ?? "",
    });
    return data;
  },
};
