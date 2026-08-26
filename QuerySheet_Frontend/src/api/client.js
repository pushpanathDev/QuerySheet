import axios from "axios";
import useAuthStore from "../store/auth.store";
import { log } from "../utils/logger.util";
import { toApiError } from "./ApiError";

const apiLog = log.scope("apiClient");

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  // Default timeout for normal endpoints (auth, chat, history).
  // Long-running endpoints (e.g. /analyze) should pass an explicit
  // `timeout` in their request config — see analyze.api.js.
  timeout: 15000,
  /**
   * CRITICAL: withCredentials: true instructs the browser to include the
   * httpOnly session cookie on every cross-origin request. Without this flag
   * the browser silently withholds cookies and all session validation fails.
   * The backend CORS config must pair this with credentials: true and a
   * non-wildcard allowed origin.
   */
  withCredentials: true,
});

// ---------- Request interceptor ----------
apiClient.interceptors.request.use(
  async (config) => {
    const token = await useAuthStore.getState().getIdToken();
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    apiLog.groupCollapsed(
      `→ ${config.method?.toUpperCase()} ${config.url}`,
      () => {
        apiLog.info("hasAuthToken:", Boolean(token));
        if (config.data !== undefined) {
          const preview =
            typeof config.data === "object" && config.data !== null
              ? { keys: Object.keys(config.data) }
              : config.data;
          apiLog.info("body preview:", preview);
        }
      },
    );
    return config;
  },
  (error) => {
    apiLog.error("request interceptor error:", error);
    return Promise.reject(toApiError(error));
  },
);

// ---------- Response interceptor ----------
let isRefreshing = false;

apiClient.interceptors.response.use(
  (response) => {
    apiLog.groupCollapsed(
      `← ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`,
      () => apiLog.info("data:", response.data),
    );

    // Unwrap the standard backend envelope { success, data, meta }
    // so callers can work directly with the inner payload.
    const body = response.data;
    if (
      body &&
      typeof body === "object" &&
      "success" in body &&
      "data" in body
    ) {
      if (body.success === false) {
        // Surface server-reported failures as rejected ApiErrors.
        return Promise.reject(toApiError({ response }));
      }
      response.data = body.data;
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    apiLog.error(
      `✗ ${error.response?.status ?? "NETWORK"} ${
        originalRequest?.method?.toUpperCase() ?? ""
      } ${originalRequest?.url ?? ""}`,
      error.response?.data ?? error.message,
    );

    // 401 → try refreshing the token once, then retry the original request.
    if (error.response?.status === 401 && !originalRequest?._retried) {
      if (isRefreshing) {
        useAuthStore.getState().clearUser();
        window.location.href = "/login";
        return Promise.reject(toApiError(error));
      }

      originalRequest._retried = true;
      isRefreshing = true;

      try {
        const newToken = await useAuthStore.getState().getIdToken();
        isRefreshing = false;

        if (!newToken) {
          useAuthStore.getState().clearUser();
          window.location.href = "/login";
          return Promise.reject(toApiError(error));
        }

        originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        isRefreshing = false;
        useAuthStore.getState().clearUser();
        window.location.href = "/login";
        return Promise.reject(toApiError(refreshErr));
      }
    }

    return Promise.reject(toApiError(error));
  },
);

export default apiClient;
