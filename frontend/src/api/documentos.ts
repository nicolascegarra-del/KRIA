import { apiClient } from "./client";
import type { Documento } from "../types";

export const documentosApi = {
  /** GET /documentos/general/ — repositorio general (gestión) */
  listGeneral: async () => {
    const { data } = await apiClient.get<Documento[]>("/documentos/general/");
    return data;
  },

  /** POST /documentos/general/upload/ — subir documento general */
  uploadGeneral: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await apiClient.post<Documento>("/documentos/general/upload/", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  /** GET /documentos/socios/:socioId/ — buzón de un socio */
  listSocio: async (socioId: string) => {
    const { data } = await apiClient.get<Documento[]>(`/documentos/socios/${socioId}/`);
    return data;
  },

  /** POST /documentos/socios/:socioId/upload/ — subir documento al buzón de un socio */
  uploadSocio: async (socioId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await apiClient.post<Documento>(`/documentos/socios/${socioId}/upload/`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  /** DELETE /documentos/:id/ */
  delete: async (id: string) => {
    await apiClient.delete(`/documentos/${id}/`);
  },

  /** GET /documentos/:id/download/ — obtener URL de descarga */
  downloadUrl: async (id: string): Promise<{ download_url: string; nombre_archivo: string }> => {
    const { data } = await apiClient.get(`/documentos/${id}/download/`);
    return data;
  },
};
