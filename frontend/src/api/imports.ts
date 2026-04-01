import { apiClient } from "./client";
import type { ImportJob, ImportValidateResult } from "../types";

export const importsApi = {
  /** GET /imports/template/ — descargar plantilla Excel socios */
  downloadTemplate: async (): Promise<Blob> => {
    const { data } = await apiClient.get("/imports/template/", { responseType: "blob" });
    return data;
  },

  /** POST /imports/validate/ — fase 1: validar socios sin guardar */
  validate: async (file: File): Promise<ImportValidateResult> => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await apiClient.post<ImportValidateResult>("/imports/validate/", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  /** POST /imports/confirm/ — fase 2: ejecutar importación socios */
  confirm: async (tempKey: string): Promise<{ job_id: string; status: string }> => {
    const { data } = await apiClient.post("/imports/confirm/", { temp_key: tempKey });
    return data;
  },

  /** GET /imports/job/:id/ — estado de un job */
  jobStatus: async (jobId: string): Promise<ImportJob> => {
    const { data } = await apiClient.get(`/imports/job/${jobId}/`);
    return data;
  },

  // ── Animal import ───────────────────────────────────────────────────────────

  /** GET /imports/animales/template/ — descargar plantilla Excel animales */
  downloadAnimalTemplate: async (): Promise<Blob> => {
    const { data } = await apiClient.get("/imports/animales/template/", { responseType: "blob" });
    return data;
  },

  /** POST /imports/animales/validate/ — fase 1: validar animales sin guardar */
  validateAnimales: async (file: File): Promise<ImportValidateResult> => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await apiClient.post<ImportValidateResult>("/imports/animales/validate/", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  /** POST /imports/animales/confirm/ — fase 2: ejecutar importación animales */
  confirmAnimales: async (tempKey: string): Promise<{ job_id: string; status: string }> => {
    const { data } = await apiClient.post("/imports/animales/confirm/", { temp_key: tempKey });
    return data;
  },
};
