import { apiClient } from "./client";
import type { PaginatedResponse } from "../types";

export interface EntregaAnillas {
  id: string;
  socio: string;
  socio_nombre: string;
  anio_campana: number;
  rango_inicio: string;
  rango_fin: string;
  diametro: string;
  sexo?: "M" | "H" | null;
  created_by_nombre?: string;
  created_at: string;
}

export interface AnillaCheckResult {
  en_rango: boolean;
  diametro_correcto: boolean | null;
  entrega: EntregaAnillas | null;
  warnings: string[];
}

export const anillasApi = {
  list: async (params?: { anio?: number; socio?: string }): Promise<PaginatedResponse<EntregaAnillas>> => {
    const { data } = await apiClient.get("/anillas/", { params });
    return data;
  },

  create: async (payload: {
    socio: string;
    anio_campana: number;
    rango_inicio: string;
    rango_fin: string;
    diametro: "18" | "20";
  }): Promise<EntregaAnillas> => {
    const { data } = await apiClient.post("/anillas/", payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/anillas/${id}/`);
  },

  check: async (anilla: string, anio: number, socio_id: string): Promise<AnillaCheckResult> => {
    const { data } = await apiClient.get("/anillas/check/", {
      params: { anilla, anio, socio_id },
    });
    return data;
  },

  misAnillas: async (): Promise<EntregaAnillas[]> => {
    const { data } = await apiClient.get("/anillas/mis-anillas/");
    return Array.isArray(data) ? data : (data.results ?? []);
  },
};
