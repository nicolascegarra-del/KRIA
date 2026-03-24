/**
 * Axios client with JWT interceptors.
 * Tenant is resolved on the backend from the JWT token — no slug header needed.
 * API calls use relative paths — nginx proxies /api/ to backend internally.
 */
import axios, { AxiosError, AxiosRequestConfig } from "axios";

export const apiClient = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
});

// ── Request interceptor: inject auth header ────────────────────────────────
apiClient.interceptors.request.use((config) => {
  const impersonationToken = localStorage.getItem("impersonation_token");

  if (impersonationToken) {
    // Impersonation mode: use short-lived token (tenant_id already embedded in it)
    config.headers.Authorization = `Bearer ${impersonationToken}`;
  } else {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

// ── Response interceptor: auto-refresh token on 401 ───────────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      // If we are in impersonation mode, the short-lived token expired → notify
      if (localStorage.getItem("impersonation_token")) {
        window.dispatchEvent(new Event("impersonation:expired"));
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers = {
            ...originalRequest.headers,
            Authorization: `Bearer ${token}`,
          };
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) {
        isRefreshing = false;
        window.dispatchEvent(new Event("auth:logout"));
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post("/api/v1/auth/token/refresh/", {
          refresh: refreshToken,
        });

        localStorage.setItem("access_token", data.access);
        processQueue(null, data.access);

        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${data.access}`,
        };
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.dispatchEvent(new Event("auth:logout"));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
