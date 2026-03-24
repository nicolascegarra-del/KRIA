import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser, ImpersonationTarget } from "../types";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isGestion: boolean;
  impersonationToken: string | null;
  impersonatingTenant: ImpersonationTarget | null;

  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  startImpersonation: (token: string, tenant: ImpersonationTarget) => void;
  endImpersonation: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isGestion: false,
      impersonationToken: null,
      impersonatingTenant: null,

      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem("access_token", accessToken);
        localStorage.setItem("refresh_token", refreshToken);
        set({
          user,
          accessToken,
          refreshToken,
          isGestion: user.is_gestion,
        });
      },

      clearAuth: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("impersonation_token");
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isGestion: false,
          impersonationToken: null,
          impersonatingTenant: null,
        });
      },

      startImpersonation: (token, tenant) => {
        localStorage.setItem("impersonation_token", token);
        set({ impersonationToken: token, impersonatingTenant: tenant });
      },

      endImpersonation: () => {
        localStorage.removeItem("impersonation_token");
        set({ impersonationToken: null, impersonatingTenant: null });
      },
    }),
    {
      name: "kria-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isGestion: state.isGestion,
        impersonationToken: state.impersonationToken,
        impersonatingTenant: state.impersonatingTenant,
      }),
    }
  )
);
