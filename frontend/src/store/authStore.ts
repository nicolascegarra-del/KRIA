import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "../types";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isGestion: boolean;

  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isGestion: false,

      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem("access_token", accessToken);
        localStorage.setItem("refresh_token", refreshToken);
        localStorage.setItem("tenant_slug", user.tenant_slug);

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
        localStorage.removeItem("tenant_slug");
        set({ user: null, accessToken: null, refreshToken: null, isGestion: false });
      },
    }),
    {
      name: "kria-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isGestion: state.isGestion,
      }),
    }
  )
);
