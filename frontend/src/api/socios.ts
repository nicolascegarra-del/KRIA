import { apiClient } from "./client";
import type { Socio, PaginatedResponse } from "../types";

export const sociosApi = {
  list: async (params?: {
    search?: string;
    estado?: string;
    cuota?: string;
    ordering?: string;
    page?: number;
  }): Promise<PaginatedResponse<Socio>> => {
    const { data } = await apiClient.get("/socios/", { params });
    return data;
  },

  get: async (id: string): Promise<Socio> => {
    const { data } = await apiClient.get(`/socios/${id}/`);
    return data;
  },

  create: async (payload: Partial<Socio>): Promise<Socio> => {
    const { data } = await apiClient.post("/socios/", payload);
    return data;
  },

  update: async (id: string, payload: Partial<Socio>): Promise<Socio> => {
    const { data } = await apiClient.patch(`/socios/${id}/`, payload);
    return data;
  },

  darBaja: async (id: string, razon_baja: string, fecha_baja: string): Promise<void> => {
    await apiClient.post(`/socios/${id}/dar-baja/`, { razon_baja, fecha_baja });
  },

  reactivar: async (id: string): Promise<void> => {
    await apiClient.post(`/socios/${id}/reactivar/`);
  },

  import: async (file: File): Promise<{ job_id: string; status: string }> => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await apiClient.post("/socios/import/", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
};
