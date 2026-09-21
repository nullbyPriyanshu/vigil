import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const onAuthPage = ["/login", "/signup"].includes(window.location.pathname);
    const isMeCall = err.config?.url === "/auth/me";

    if (err.response?.status === 401 && !onAuthPage && !isMeCall) {
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);

export default api;
