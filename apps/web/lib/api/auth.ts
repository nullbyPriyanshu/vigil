import api from "./axios";
import type { Session } from "@/types/auth";

export const loginApi = (email: string, password: string) =>
  api.post("/auth/login", { email, password });

export const signupApi = (data: {
  name: string;
  email: string;
  password: string;
  organizationName: string;
  timezone?: string;
}) => api.post("/auth/signup", data);

export const getMeApi = () => api.get<Session>("/auth/me");

export const logoutApi = () => api.post("/auth/logout");

export const forgotPasswordApi = (email: string) =>
  api.post<{ message: string }>("/auth/forgot-password", { email });

export const resetPasswordApi = (token: string, password: string) =>
  api.post<{ message: string }>("/auth/reset-password", { token, password });

// Swaps the session cookies for fresh ones. Call after something changed
// the user's role, so the new login token carries the new role.
export const refreshSessionApi = () => api.post("/auth/refresh");
