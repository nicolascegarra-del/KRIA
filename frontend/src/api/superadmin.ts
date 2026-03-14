import { apiClient } from "./client";
import type { Tenant, PaginatedResponse } from "../types";

export const superadminApi = {
  listTenants: async (params?: { page?: number }) => {
    const { data } = await apiClient.get<PaginatedResponse<Tenant>>("/superadmin/tenants/", { params });
    return data;
  },
  createTenant: async (payload: Partial<Tenant>) => {
    const { data } = await apiClient.post<Tenant>("/superadmin/tenants/", payload);
    return data;
  },
  updateTenant: async (id: string, payload: Partial<Tenant>) => {
    const { data } = await apiClient.patch<Tenant>(`/superadmin/tenants/${id}/`, payload);
    return data;
  },
  stats: async () => {
    const { data } = await apiClient.get<{ tenants: number; usuarios: number; socios: number; animales: number }>("/superadmin/stats/");
    return data;
  },
  resetPassword: async (userId: string) => {
    const { data } = await apiClient.post<{ reset_token: string; email: string }>(`/superadmin/users/${userId}/reset-password/`);
    return data;
  },
};
