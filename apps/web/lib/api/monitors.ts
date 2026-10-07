import api from "./axios";

// PENDING = not checked yet.
export type MonitorStatus = "PENDING" | "UP" | "DOWN";

// One row on the monitors list.
export type MonitorSummary = {
  id: string;
  name: string;
  url: string;
  // How often it is checked: 1, 5 or 15.
  intervalMinutes: number;
  status: MonitorStatus;
  lastCheckedAt: string | null;
  // null while it is down or not checked yet.
  lastResponseMs: number | null;
  service: { id: string; name: string };
};

// One visit to the URL.
export type MonitorCheck = {
  id: string;
  up: boolean;
  statusCode: number | null;
  responseMs: number;
  // Why it failed, e.g. "No answer within 10 seconds".
  error: string | null;
  checkedAt: string;
};

// One monitor in full, with its latest checks (newest first).
export type Monitor = MonitorSummary & {
  createdAt: string;
  // Share of checks in the last 30 days that passed. null before any check.
  uptimePercent: number | null;
  checks: MonitorCheck[];
};

export type MonitorInput = {
  name: string;
  url: string;
  intervalMinutes: number;
  serviceId: string;
};

export const getMonitorsApi = () =>
  api.get<{ data: MonitorSummary[] }>("/monitors");

export const getMonitorApi = (id: string) => api.get<Monitor>(`/monitors/${id}`);

export const createMonitorApi = (data: MonitorInput) =>
  api.post<Monitor>("/monitors", data);

export const updateMonitorApi = (id: string, data: Partial<MonitorInput>) =>
  api.patch<Monitor>(`/monitors/${id}`, data);

export const deleteMonitorApi = (id: string) => api.delete(`/monitors/${id}`);

// Visits the URL right now instead of waiting for the next turn.
export const checkMonitorNowApi = (id: string) =>
  api.post<Monitor>(`/monitors/${id}/check`);
