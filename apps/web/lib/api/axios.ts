import axios, { type InternalAxiosRequestConfig } from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

const AUTH_PAGES = ["/login", "/signup", "/forgot-password", "/reset-password"];

const NO_REFRESH_URLS = [
  "/auth/login",
  "/auth/signup",
  "/auth/refresh",
  "/auth/logout",
  "/auth/forgot-password",
  "/auth/reset-password",
];

// A 401 from these means "wrong password" or "log in first", not "your
// access token expired", so there's nothing a refresh could fix.
function skipsRefresh(url: string) {
  return NO_REFRESH_URLS.includes(url) || url.startsWith("/invitations/");
}

type RetryableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

let refreshPromise: Promise<unknown> | null = null;

function refreshSession() {
  refreshPromise ??= api.post("/auth/refresh").finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config as RetryableConfig | undefined;
    const is401 = err.response?.status === 401;

    if (
      is401 &&
      config &&
      !config._retried &&
      !skipsRefresh(config.url ?? "")
    ) {
      config._retried = true;
      try {
        await refreshSession();
        return api(config);
      } catch {
      }
    }

    const onAuthPage =
      AUTH_PAGES.includes(window.location.pathname) ||
      window.location.pathname.startsWith("/invite/") ||
      window.location.pathname.startsWith("/a/");
    const isMeCall = config?.url === "/auth/me";
    const isRefreshCall = config?.url === "/auth/refresh";

    if (is401 && !onAuthPage && !isMeCall && !isRefreshCall) {
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);

export default api;
