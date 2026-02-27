import { apiClient } from "./client";
import type { ReportJob } from "../types";

export const reportsApi = {
  inventory: async (socio_id?: string): Promise<{ job_id: string }> => {
    const { data } = await apiClient.post("/reports/inventory/", { socio_id });
    return data;
  },

  individual: async (animal_id: string): Promise<{ job_id: string }> => {
    const { data } = await apiClient.post(`/reports/individual/${animal_id}/`);
    return data;
  },

  genealogyCert: async (animal_id: string): Promise<{ job_id: string }> => {
    const { data } = await apiClient.post(`/reports/genealogical-certificate/${animal_id}/`);
    return data;
  },

  libroGenealogico: async (): Promise<{ job_id: string }> => {
    const { data } = await apiClient.post("/reports/libro-genealogico/");
    return data;
  },

  catalogoReproductores: async (): Promise<{ job_id: string }> => {
    const { data } = await apiClient.post("/reports/catalogo-reproductores/");
    return data;
  },

  jobStatus: async (job_id: string): Promise<ReportJob> => {
    const { data } = await apiClient.get(`/reports/job/${job_id}/`);
    return data;
  },
};
