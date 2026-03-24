import { apiClient } from "./client";
import type { Animal, PaginatedResponse } from "../types";

export interface AnimalFilters {
  estado?: string;
  variedad?: string;
  sexo?: string;
  search?: string;
  page?: number;
  socio_id?: string;
}

export const animalsApi = {
  list: async (params?: AnimalFilters): Promise<PaginatedResponse<Animal>> => {
    const { data } = await apiClient.get("/animals/", { params });
    return data;
  },

  get: async (id: string): Promise<Animal> => {
    const { data } = await apiClient.get(`/animals/${id}/`);
    return data;
  },

  create: async (payload: Partial<Animal>): Promise<Animal> => {
    const { data } = await apiClient.post("/animals/", payload);
    return data;
  },

  update: async (id: string, payload: Partial<Animal>): Promise<Animal> => {
    const { data } = await apiClient.patch(`/animals/${id}/`, payload);
    return data;
  },

  approve: async (id: string): Promise<Animal> => {
    const { data } = await apiClient.post(`/animals/${id}/approve/`);
    return data;
  },

  reject: async (id: string, razon_rechazo: string): Promise<Animal> => {
    const { data } = await apiClient.post(`/animals/${id}/reject/`, { razon_rechazo });
    return data;
  },

  genealogy: async (id: string) => {
    const { data } = await apiClient.get(`/animals/${id}/genealogy/`);
    return data;
  },

  searchGlobal: async (anilla: string, anio: number): Promise<Animal[]> => {
    const { data } = await apiClient.get("/animals/search-global/", {
      params: { anilla, anio },
    });
    return data;
  },

  uploadFoto: async (id: string, file: File, tipo: string): Promise<Animal> => {
    const form = new FormData();
    form.append("foto", file);
    form.append("tipo", tipo);
    const { data } = await apiClient.post(`/animals/${id}/foto/`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  deleteFoto: async (id: string, key: string): Promise<Animal> => {
    const { data } = await apiClient.delete(`/animals/${id}/foto/`, { data: { key } });
    return data;
  },

  addPesaje: async (id: string, fecha: string, peso: number): Promise<Animal> => {
    const { data } = await apiClient.post(`/animals/${id}/pesaje/`, { fecha, peso });
    return data;
  },

  darBaja: async (id: string, fecha_baja: string, motivo_baja: string): Promise<Animal> => {
    const { data } = await apiClient.post(`/animals/${id}/dar-baja/`, { fecha_baja, motivo_baja });
    return data;
  },
};
