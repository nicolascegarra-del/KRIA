import { apiClient } from "./client";
import type { AuthUser, LoginResponse } from "../types";

export const authApi = {
  login: async (email: string, password: string, access_as_gestion: boolean): Promise<LoginResponse> => {
    const { data } = await apiClient.post<LoginResponse>("/auth/login/", {
      email,
      password,
      access_as_gestion,
    });
    return data;
  },

  me: async (): Promise<AuthUser> => {
    const { data } = await apiClient.get<AuthUser>("/auth/me/");
    return data;
  },

  requestPasswordReset: async (email: string): Promise<void> => {
    await apiClient.post("/auth/password-reset/request/", { email });
  },

  confirmPasswordReset: async (token: string, new_password: string): Promise<void> => {
    await apiClient.post("/auth/password-reset/confirm/", { token, new_password });
  },

  refreshToken: async (refresh: string): Promise<{ access: string }> => {
    const { data } = await apiClient.post("/auth/token/refresh/", { refresh });
    return data;
  },
};
