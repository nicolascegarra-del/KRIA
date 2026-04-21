import { apiClient } from "./client";
import type { ReportJob } from "../types";

export const reportsApi = {
  inventory: async (
    socio_id?: string,
    formato: "pdf" | "excel" = "pdf",
    orden?: string,
    filters?: { activo?: string; variedad?: string; sexo?: string; anio_desde?: string; anio_hasta?: string },
  ): Promise<{ job_id: string }> => {
    const { data } = await apiClient.post("/reports/inventory/", { socio_id, formato, orden, ...filters });
    return data;
  },

  individual: async (animal_id: string): Promise<{ job_id: string }> => {
    const { data } = await apiClient.post(`/reports/individual/${animal_id}/`);
    return data;
  },

  libroGenealogico: async (): Promise<{ job_id: string }> => {
    const { data } = await apiClient.post("/reports/libro-genealogico/");
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

  downloadFile: async (job_id: string, filename?: string): Promise<void> => {
    const response = await apiClient.get(`/reports/job/${job_id}/download/`, {
      responseType: "blob",
    });
    const contentType = response.headers["content-type"] || "application/octet-stream";
    const ext = contentType.includes("spreadsheetml") ? ".xlsx" : ".pdf";
    const blob = new Blob([response.data], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `informe_${job_id}${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
