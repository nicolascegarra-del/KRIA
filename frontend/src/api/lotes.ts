import { apiClient } from "./client";
import type { Lote, PaginatedResponse } from "../types";

export interface LoteCreate {
  nombre: string;
  macho: string | null;
  hembras: string[];
  fecha_inicio: string;
  socio?: string;
}

export const lotesApi = {
  list: () =>
    apiClient.get<PaginatedResponse<Lote>>("/lotes/").then((r) => r.data),

  get: (id: string) =>
    apiClient.get<Lote>(`/lotes/${id}/`).then((r) => r.data),

  create: (data: LoteCreate) =>
    apiClient.post<Lote>("/lotes/", data).then((r) => r.data),

  close: (id: string) =>
    apiClient.post<Lote>(`/lotes/${id}/close/`).then((r) => r.data),
};
