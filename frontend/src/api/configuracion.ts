import { apiClient } from "./client";
import type { MotivoBaja } from "../types";

export const configuracionApi = {
  listMotivosBaja: async (): Promise<MotivoBaja[]> => {
    const { data } = await apiClient.get("/configuracion/motivos-baja/");
    return data;
  },

  createMotivoBaja: async (nombre: string): Promise<MotivoBaja> => {
    const { data } = await apiClient.post("/configuracion/motivos-baja/", { nombre });
    return data;
  },

  updateMotivoBaja: async (id: string, payload: Partial<MotivoBaja>): Promise<MotivoBaja> => {
    const { data } = await apiClient.patch(`/configuracion/motivos-baja/${id}/`, payload);
    return data;
  },

  deleteMotivoBaja: async (id: string): Promise<void> => {
    await apiClient.delete(`/configuracion/motivos-baja/${id}/`);
  },
};
