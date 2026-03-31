import { apiClient } from "./client";
import type { ReportJob } from "../types";

export const reportsApi = {
  inventory: async (socio_id?: string, formato: "pdf" | "excel" = "pdf"): Promise<{ job_id: string }> => {
    const { data } = await apiClient.post("/reports/inventory/", { socio_id, formato });
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

  catalogoReproductores: async (formato: "pdf" | "excel" = "pdf"): Promise<{ job_id: string }> => {
    const { data } = await apiClient.post("/reports/catalogo-reproductores/", { formato });
    return data;
  },

  auditoria: async (auditoria_id: string): Promise<{ job_id: string }> => {
    const { data } = await apiClient.post(`/reports/auditoria/${auditoria_id}/`);
    return data;
  },

  jobStatus: async (job_id: string): Promise<ReportJob> => {
    const { data } = await apiClient.get(`/reports/job/${job_id}/`);
    return data;
  },
};
