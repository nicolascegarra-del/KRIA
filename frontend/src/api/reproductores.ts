import { apiClient } from "./client";
import type { Animal, PaginatedResponse } from "../types";

export const reproductoresApi = {
  /** GET /reproductores/ — catálogo público (animales aprobados + evaluados) */
  catalogo: async (params?: { page?: number; page_size?: number }) => {
    const { data } = await apiClient.get<PaginatedResponse<Animal>>("/reproductores/", { params });
    return data;
  },

  /** GET /reproductores/candidatos/ — candidatos pendientes de revisión (gestión) */
  candidatos: async (params?: { page?: number }) => {
    const { data } = await apiClient.get<PaginatedResponse<Animal>>("/reproductores/candidatos/", { params });
    return data;
  },

  /** POST /animals/:id/aprobar-reproductor/ — aprobar o denegar candidato */
  aprobar: async (animalId: string, aprobado: boolean, notas?: string) => {
    const { data } = await apiClient.post(`/animals/${animalId}/aprobar-reproductor/`, {
      aprobado,
      notas_decision: notas ?? "",
    });
    return data;
  },
};
