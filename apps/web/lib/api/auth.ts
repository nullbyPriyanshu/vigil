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
