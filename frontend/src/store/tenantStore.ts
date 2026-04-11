import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TenantBranding } from "../types";

interface TenantState {
  branding: TenantBranding | null;
  slug: string | null;
  setBranding: (branding: TenantBranding) => void;
  clearBranding: () => void;
  setSlug: (slug: string) => void;
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      branding: null,
      slug: null,
      setBranding: (branding) => set({ branding, slug: branding.slug }),
      clearBranding: () => set({ branding: null }),
      setSlug: (slug) => set({ slug }),
    }),
    { name: "kria-tenant" }
  )
);

/**
 * Apply branding colors to CSS custom properties so Tailwind + inline styles
 * can use tenant colors.
 */
export function applyBranding(branding: TenantBranding) {
  document.documentElement.style.setProperty("--color-primary", branding.primary_color);
  document.documentElement.style.setProperty("--color-secondary", branding.secondary_color);
  document.title = `${branding.name} — KRIA`;
}

/**
 * Reset CSS custom properties to defaults (superadmin / no-tenant context).
 */
export function resetBranding() {
  document.documentElement.style.removeProperty("--color-primary");
  document.documentElement.style.removeProperty("--color-secondary");
}
