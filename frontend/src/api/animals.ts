import { apiClient } from "./client";
import type { Animal, AnimalEstado, PaginatedResponse } from "../types";

export interface AnimalFilters {
  estado?: string;
  variedad?: string;
  sexo?: string;
  search?: string;
  anio?: number;
  ordering?: string;
  page?: number;
  page_size?: number;
  socio_id?: string;
}

export const animalsApi = {
  list: async (params?: AnimalFilters): Promise<PaginatedResponse<Animal>> => {
    const { data } = await apiClient.get("/animals/", { params });
    return data;
  },

  get: async (id: string): Promise<Animal> => {
    const { data } = await apiClient.get(`/animals/${id}/`);
    return data;
  },

  create: async (payload: Partial<Animal>): Promise<Animal> => {
    const { data } = await apiClient.post("/animals/", payload);
    return data;
  },

  update: async (id: string, payload: Partial<Animal>): Promise<Animal> => {
    const { data } = await apiClient.patch(`/animals/${id}/`, payload);
    return data;
  },

  approve: async (id: string): Promise<Animal> => {
    const { data } = await apiClient.post(`/animals/${id}/approve/`);
    return data;
  },

  reject: async (id: string, razon_rechazo: string): Promise<Animal> => {
    const { data } = await apiClient.post(`/animals/${id}/reject/`, { razon_rechazo });
    return data;
  },

  genealogy: async (id: string) => {
    const { data } = await apiClient.get(`/animals/${id}/genealogy/`);
    return data;
  },

  searchGlobal: async (anilla: string, anio: number): Promise<Animal[]> => {
    const { data } = await apiClient.get("/animals/search-global/", {
      params: { anilla, anio },
    });
    return data;
  },

  // Búsqueda de animales dentro del tenant actual (para el picker de reportes)
  searchByAnilla: async (search: string, anio?: number): Promise<Animal[]> => {
    const params: Record<string, any> = { search };
    if (anio && !isNaN(anio)) params.anio = anio;
    const { data } = await apiClient.get<PaginatedResponse<Animal>>("/animals/", { params });
    return data.results ?? [];
  },

  uploadFoto: async (id: string, file: File, tipo: string): Promise<Animal> => {
    const form = new FormData();
    form.append("foto", file);
    form.append("tipo", tipo);
    const { data } = await apiClient.post(`/animals/${id}/foto/`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  deleteFoto: async (id: string, key: string): Promise<Animal> => {
    const { data } = await apiClient.delete(`/animals/${id}/foto/`, { data: { key } });
    return data;
  },

  addPesaje: async (id: string, fecha: string, peso: number): Promise<Animal> => {
    const { data } = await apiClient.post(`/animals/${id}/pesaje/`, { fecha, peso });
    return data;
  },

  darBaja: async (id: string, fecha_baja: string, motivo_baja: string): Promise<Animal> => {
    const { data } = await apiClient.post(`/animals/${id}/dar-baja/`, { fecha_baja, motivo_baja });
    return data;
  },

  reactivar: async (id: string): Promise<Animal> => {
    const { data } = await apiClient.post(`/animals/${id}/reactivar/`);
    return data;
  },

  getGanaderiasNacimiento: async () => {
    const { data } = await apiClient.get("/animals/ganaderias-nacimiento/");
    return data as {
      ganaderia_nombre: string;
      animal_count: number;
      map_id: string | null;
      socio_real: string | null;
      socio_nombre: string | null;
      animals: { id: string; numero_anilla: string; estado: AnimalEstado; socio_id: string; socio_nombre: string }[];
    }[];
  },

  saveGanaderiaMap: async (ganaderia_nombre: string, socio_real: string | null) => {
    const { data } = await apiClient.post("/animals/ganaderias-nacimiento/", { ganaderia_nombre, socio_real });
    return data;
  },

  getLotesExternos: async () => {
    const { data } = await apiClient.get("/animals/lotes-externos/");
    return data as { descripcion: string; animal_count: number; map_id: string | null; lote_real: string | null; lote_nombre: string | null }[];
  },

  saveLoteExternoMap: async (descripcion: string, lote_real: string | null) => {
    const { data } = await apiClient.post("/animals/lotes-externos/", { descripcion, lote_real });
    return data;
  },
};

// ── Censo (módulo Animales) ───────────────────────────────────────────────────

export interface CensoColumnDef {
  key: string;
  label: string;
}

export interface CensoFilters {
  search?: string;
  activo?: "true" | "false" | "";
  variedad?: string;
  estado?: string;
  sexo?: string;
  propietario?: "con" | "sin" | "";
  fecha_desde?: string;
  fecha_hasta?: string;
  order_by?: string;
  order_dir?: "asc" | "desc";
  page?: number;
  page_size?: number;
}

export interface CensoAnimal {
  id: string;
  [key: string]: string;
}

export interface CensoResponse {
  count: number;
  page: number;
  page_size: number;
  results: CensoAnimal[];
}

export const censoApi = {
  getColumnas: async (): Promise<{ columns: CensoColumnDef[]; defaults: string[] }> => {
    const { data } = await apiClient.get("/animals/censo/columnas/");
    return data;
  },

  list: async (params?: CensoFilters): Promise<CensoResponse> => {
    const { data } = await apiClient.get("/animals/censo/", { params });
    return data;
  },

};
