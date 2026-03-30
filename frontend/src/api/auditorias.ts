import { apiClient } from "./client";
import type {
  AuditoriaAnimal,
  AuditoriaRespuesta,
  AuditoriaSession,
  AuditoriaSessionDetail,
  CriterioEvaluacion,
  PreguntaInstalacion,
} from "../types";

export const auditoriasApi = {
  // ── Configuración ────────────────────────────────────────────────────────────
  criterios: {
    list: async (): Promise<CriterioEvaluacion[]> => {
      const { data } = await apiClient.get("/auditorias/criterios/");
      return data;
    },
    create: async (payload: Omit<CriterioEvaluacion, "id">): Promise<CriterioEvaluacion> => {
      const { data } = await apiClient.post("/auditorias/criterios/", payload);
      return data;
    },
    update: async (id: string, payload: Partial<CriterioEvaluacion>): Promise<CriterioEvaluacion> => {
      const { data } = await apiClient.patch(`/auditorias/criterios/${id}/`, payload);
      return data;
    },
    delete: async (id: string): Promise<void> => {
      await apiClient.delete(`/auditorias/criterios/${id}/`);
    },
  },

  preguntas: {
    list: async (): Promise<PreguntaInstalacion[]> => {
      const { data } = await apiClient.get("/auditorias/preguntas/");
      return data;
    },
    create: async (payload: Omit<PreguntaInstalacion, "id">): Promise<PreguntaInstalacion> => {
      const { data } = await apiClient.post("/auditorias/preguntas/", payload);
      return data;
    },
    update: async (id: string, payload: Partial<PreguntaInstalacion>): Promise<PreguntaInstalacion> => {
      const { data } = await apiClient.patch(`/auditorias/preguntas/${id}/`, payload);
      return data;
    },
    delete: async (id: string): Promise<void> => {
      await apiClient.delete(`/auditorias/preguntas/${id}/`);
    },
  },

  // ── Sesiones ─────────────────────────────────────────────────────────────────
  list: async (params?: { socio?: string; estado?: string }): Promise<AuditoriaSession[]> => {
    const { data } = await apiClient.get("/auditorias/", { params });
    return data;
  },
  get: async (id: string): Promise<AuditoriaSessionDetail> => {
    const { data } = await apiClient.get(`/auditorias/${id}/`);
    return data;
  },
  create: async (payload: Partial<AuditoriaSession>): Promise<AuditoriaSession> => {
    const { data } = await apiClient.post("/auditorias/", payload);
    return data;
  },
  update: async (id: string, payload: Partial<AuditoriaSession>): Promise<AuditoriaSession> => {
    const { data } = await apiClient.patch(`/auditorias/${id}/`, payload);
    return data;
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/auditorias/${id}/`);
  },

  // ── Animales evaluados ───────────────────────────────────────────────────────
  animales: {
    list: async (auditoriaId: string): Promise<AuditoriaAnimal[]> => {
      const { data } = await apiClient.get(`/auditorias/${auditoriaId}/animales/`);
      return data;
    },
    create: async (auditoriaId: string, payload: Partial<AuditoriaAnimal>): Promise<AuditoriaAnimal> => {
      const { data } = await apiClient.post(`/auditorias/${auditoriaId}/animales/`, payload);
      return data;
    },
    update: async (auditoriaId: string, animalId: string, payload: Partial<AuditoriaAnimal>): Promise<AuditoriaAnimal> => {
      const { data } = await apiClient.patch(`/auditorias/${auditoriaId}/animales/${animalId}/`, payload);
      return data;
    },
    delete: async (auditoriaId: string, animalId: string): Promise<void> => {
      await apiClient.delete(`/auditorias/${auditoriaId}/animales/${animalId}/`);
    },
  },

  // ── Respuestas instalación ───────────────────────────────────────────────────
  respuestas: {
    get: async (auditoriaId: string): Promise<AuditoriaRespuesta[]> => {
      const { data } = await apiClient.get(`/auditorias/${auditoriaId}/respuestas/`);
      return data;
    },
    save: async (auditoriaId: string, items: { pregunta: string; respuesta: string }[]): Promise<AuditoriaRespuesta[]> => {
      const { data } = await apiClient.post(`/auditorias/${auditoriaId}/respuestas/`, items);
      return data;
    },
  },
};
