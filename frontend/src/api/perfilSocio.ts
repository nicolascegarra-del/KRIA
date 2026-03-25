import { apiClient } from "./client";
import type { Socio, SolicitudCambioDatos } from "../types";

export const perfilSocioApi = {
  /** GET /socios/me/ — datos del socio autenticado */
  getMe: async (): Promise<Socio> => {
    const { data } = await apiClient.get<Socio>("/socios/me/");
    return data;
  },

  /** POST /socios/me/solicitar-cambio/ — socio solicita cambio de datos */
  solicitarCambio: async (datos: Record<string, string>): Promise<void> => {
    await apiClient.post("/socios/me/solicitar-cambio/", datos);
  },

  /** GET /socios/solicitudes-cambio/ — gestión lista solicitudes pendientes */
  listSolicitudes: async (): Promise<{ count: number; results: SolicitudCambioDatos[] }> => {
    const { data } = await apiClient.get("/socios/solicitudes-cambio/");
    return data;
  },

  /** POST /socios/solicitudes-cambio/:id/resolver/ — gestión aprueba o deniega */
  resolver: async (id: string, accion: "aprobar" | "denegar"): Promise<void> => {
    await apiClient.post(`/socios/solicitudes-cambio/${id}/resolver/`, { accion });
  },
};
