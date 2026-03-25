import { apiClient } from "./client";
import type { Notificacion } from "../types";

export const notificacionesApi = {
  list: async (): Promise<{ count: number; results: Notificacion[] }> => {
    const { data } = await apiClient.get("/notificaciones/");
    return data;
  },

  marcarLeidas: async (): Promise<void> => {
    await apiClient.post("/notificaciones/marcar-leidas/");
  },
};
