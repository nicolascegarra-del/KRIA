import { apiClient } from "./client";
import type { Lote, PaginatedResponse } from "../types";

export interface LoteCreate {
  nombre: string;
  macho: string | null;
  hembras: string[];
  fecha_inicio: string;
  socio?: string;
}

export interface LoteCria {
  id: string;
  numero_anilla: string;
  fecha_nacimiento: string | null;
  sexo: "M" | "H";
  variedad: string;
  estado: string;
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

  rename: (id: string, nombre: string) =>
    apiClient.patch<Lote>(`/lotes/${id}/`, { nombre }).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/lotes/${id}/`),

  crias: (id: string) =>
    apiClient.get<LoteCria[]>(`/lotes/${id}/crias/`).then((r) => r.data),
};
