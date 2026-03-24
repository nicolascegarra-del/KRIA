import { apiClient } from "./client";
import type { Tenant, PaginatedResponse, ImpersonateResponse, TenantCreatePayload, GestionUser, PlatformSettings } from "../types";

export const superadminApi = {
  listTenants: async (params?: { page?: number }) => {
    const { data } = await apiClient.get<PaginatedResponse<Tenant>>("/superadmin/tenants/", { params });
    return data;
  },
  createTenant: async (payload: TenantCreatePayload) => {
    const { data } = await apiClient.post<Tenant>("/superadmin/tenants/", payload);
    return data;
  },
  updateTenant: async (id: string, payload: Partial<Tenant>) => {
    const { data } = await apiClient.patch<Tenant>(`/superadmin/tenants/${id}/`, payload);
    return data;
  },
  deleteTenant: async (id: string) => {
    await apiClient.delete(`/superadmin/tenants/${id}/`);
  },
  deleteTenantSocios: async (id: string): Promise<{ detail: string; count: number }> => {
    const { data } = await apiClient.post(`/superadmin/tenants/${id}/delete-socios/`);
    return data;
  },
  suspendTenant: async (id: string) => {
    const { data } = await apiClient.post<Tenant>(`/superadmin/tenants/${id}/suspend/`);
    return data;
  },
  activateTenant: async (id: string) => {
    const { data } = await apiClient.post<Tenant>(`/superadmin/tenants/${id}/activate/`);
    return data;
  },
  impersonate: async (id: string): Promise<ImpersonateResponse> => {
    const { data } = await apiClient.post<ImpersonateResponse>(`/superadmin/tenants/${id}/impersonate/`);
    return data;
  },
  stats: async () => {
    const { data } = await apiClient.get<{
      tenants: number;
      usuarios: number;
      socios: number;
      animales: number;
      por_asociacion: { id: string; name: string; slug: string; is_active: boolean; max_socios: number; socios_count: number }[];
    }>("/superadmin/stats/");
    return data;
  },
  resetPassword: async (userId: string) => {
    const { data } = await apiClient.post<{ reset_token: string; email: string }>(`/superadmin/users/${userId}/reset-password/`);
    return data;
  },
  uploadLogo: async (id: string, file: File): Promise<Tenant> => {
    const form = new FormData();
    form.append("logo", file);
    const { data } = await apiClient.post<Tenant>(`/superadmin/tenants/${id}/logo/`, form);
    return data;
  },

  // Gestión users per tenant
  listUsers: async (tenantId: string): Promise<GestionUser[]> => {
    const { data } = await apiClient.get<GestionUser[]>(`/superadmin/tenants/${tenantId}/users/`);
    return data;
  },
  createUser: async (tenantId: string, payload: { email: string; first_name?: string; last_name?: string; password: string }): Promise<GestionUser> => {
    const { data } = await apiClient.post<GestionUser>(`/superadmin/tenants/${tenantId}/users/`, payload);
    return data;
  },
  updateUser: async (userId: string, payload: { email?: string; first_name?: string; last_name?: string; password?: string }): Promise<GestionUser> => {
    const { data } = await apiClient.patch<GestionUser>(`/superadmin/users/${userId}/`, payload);
    return data;
  },
  deleteUser: async (userId: string): Promise<void> => {
    await apiClient.delete(`/superadmin/users/${userId}/`);
  },
  suspendUser: async (userId: string): Promise<GestionUser> => {
    const { data } = await apiClient.post<GestionUser>(`/superadmin/users/${userId}/suspend/`);
    return data;
  },
  activateUser: async (userId: string): Promise<GestionUser> => {
    const { data } = await apiClient.post<GestionUser>(`/superadmin/users/${userId}/activate/`);
    return data;
  },

  // Lista global de usuarios admin (no superadmin) de todas las asociaciones
  listAdminUsers: async (): Promise<(GestionUser & { tenant_name: string; tenant_id: string })[]> => {
    const { data } = await apiClient.get(`/superadmin/admin-users/`);
    return data;
  },

  // SMTP test por tenant
  testTenantSmtp: async (id: string): Promise<{ detail: string }> => {
    const { data } = await apiClient.post<{ detail: string }>(`/superadmin/tenants/${id}/test-smtp/`);
    return data;
  },

  // Platform settings (SMTP global)
  getPlatformSettings: async (): Promise<PlatformSettings> => {
    const { data } = await apiClient.get<PlatformSettings>("/superadmin/settings/");
    return data;
  },
  updatePlatformSettings: async (payload: Partial<PlatformSettings>): Promise<PlatformSettings> => {
    const { data } = await apiClient.patch<PlatformSettings>("/superadmin/settings/", payload);
    return data;
  },
  testPlatformSmtp: async (): Promise<{ detail: string }> => {
    const { data } = await apiClient.post<{ detail: string }>("/superadmin/settings/test-smtp/");
    return data;
  },

  // SuperAdmins CRUD
  listSuperAdmins: async (): Promise<GestionUser[]> => {
    const { data } = await apiClient.get<GestionUser[]>("/superadmin/superadmins/");
    return data;
  },
  createSuperAdmin: async (payload: { email: string; first_name?: string; last_name?: string; password: string }): Promise<GestionUser> => {
    const { data } = await apiClient.post<GestionUser>("/superadmin/superadmins/", payload);
    return data;
  },
  updateSuperAdmin: async (id: string, payload: { email?: string; first_name?: string; last_name?: string; password?: string }): Promise<GestionUser> => {
    const { data } = await apiClient.patch<GestionUser>(`/superadmin/superadmins/${id}/`, payload);
    return data;
  },
  deleteSuperAdmin: async (id: string): Promise<void> => {
    await apiClient.delete(`/superadmin/superadmins/${id}/`);
  },
};
