import { apiClient } from "./client";
import type { ImportJob, ImportValidateResult } from "../types";

export const importsApi = {
  /** GET /imports/template/ — descargar plantilla Excel */
  downloadTemplate: async (): Promise<Blob> => {
    const { data } = await apiClient.get("/imports/template/", {
      responseType: "blob",
    });
    return data;
  },

  /** POST /imports/validate/ — fase 1: validar sin guardar */
  validate: async (file: File): Promise<ImportValidateResult> => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await apiClient.post<ImportValidateResult>("/imports/validate/", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  /** POST /imports/confirm/ — fase 2: ejecutar importación real */
  confirm: async (tempKey: string): Promise<{ job_id: string; status: string }> => {
    const { data } = await apiClient.post("/imports/confirm/", { temp_key: tempKey });
    return data;
  },

  /** GET /imports/job/:id/ — estado de un job */
  jobStatus: async (jobId: string): Promise<ImportJob> => {
    const { data } = await apiClient.get(`/imports/job/${jobId}/`);
    return data;
  },
};
