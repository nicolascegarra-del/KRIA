import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.svg"],
      manifest: {
        name: "KRIA — Libros Genealógicos",
        short_name: "KRIA",
        description: "Plataforma de gestión de libros genealógicos avícolas",
        theme_color: "#1565C0",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/v1\/animals/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "animals-cache",
              expiration: { maxEntries: 200, maxAgeSeconds: 86400 },
            },
          },
          {
            urlPattern: /^https?:\/\/.*\/api\/v1\/socios/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "socios-cache",
              expiration: { maxEntries: 100, maxAgeSeconds: 3600 },
            },
          },
          {
            urlPattern: /\.(png|jpg|jpeg|gif|webp|svg)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: { maxEntries: 500, maxAgeSeconds: 604800 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.BACKEND_URL || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
