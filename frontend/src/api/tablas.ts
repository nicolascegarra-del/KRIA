import { apiClient } from "./client";
import type {
  TablaControlList,
  TablaControl,
  TablaEntrada,
  TablaControlWrite,
  SocioFieldOption,
} from "../types";

export const tablasApi = {
  // ── Tablas ─────────────────────────────────────────────────────────────────
  list: () =>
    apiClient.get<TablaControlList[]>("/tablas/").then((r) => r.data),

  create: (data: TablaControlWrite) =>
    apiClient.post<TablaControl>("/tablas/", data).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<TablaControl>(`/tablas/${id}/`).then((r) => r.data),

  update: (id: string, data: TablaControlWrite) =>
    apiClient.put<TablaControl>(`/tablas/${id}/`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/tablas/${id}/`),

  // ── Filas ──────────────────────────────────────────────────────────────────
  getFilas: (
    id: string,
    params?: { search?: string; estado?: string; ordering?: string }
  ) =>
    apiClient
      .get<TablaEntrada[]>(`/tablas/${id}/filas/`, { params })
      .then((r) => r.data),

  updateEntrada: (
    tablaId: string,
    socioId: string,
    valores: Record<string, boolean | string | number | null>
  ) =>
    apiClient
      .patch<TablaEntrada>(`/tablas/${tablaId}/filas/${socioId}/`, { valores })
      .then((r) => r.data),

  syncSocios: (id: string) =>
    apiClient.post<{ added: number }>(`/tablas/${id}/sync-socios/`).then((r) => r.data),

  // ── Exportar ───────────────────────────────────────────────────────────────
  export: async (id: string, formato: "pdf" | "excel", nombre: string) => {
    const res = await apiClient.post(
      `/tablas/${id}/export/`,
      { formato },
      { responseType: "blob" }
    );
    const ext = formato === "excel" ? "xlsx" : "pdf";
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nombre.replace(/\s+/g, "_")}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // ── Campos del socio disponibles ──────────────────────────────────────────
  getSocioFields: () =>
    apiClient.get<SocioFieldOption[]>("/tablas/socio-fields/").then((r) => r.data),
};
