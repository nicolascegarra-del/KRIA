import { apiClient } from "./client";
import type { Granja, PaginatedResponse } from "../types";

export interface GranjaFilters {
  search?: string;
  page?: number;
  socio_id?: string;
}

export const granjasApi = {
  list: async (params?: GranjaFilters): Promise<PaginatedResponse<Granja>> => {
    const { data } = await apiClient.get("/granjas/", { params });
    return data;
  },

  get: async (id: string): Promise<Granja> => {
    const { data } = await apiClient.get(`/granjas/${id}/`);
    return data;
  },

  create: async (payload: Partial<Granja> & { socio?: string }): Promise<Granja> => {
    const { data } = await apiClient.post("/granjas/", payload);
    return data;
  },

  update: async (id: string, payload: Partial<Granja>): Promise<Granja> => {
    const { data } = await apiClient.patch(`/granjas/${id}/`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/granjas/${id}/`);
  },
};
