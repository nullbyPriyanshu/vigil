import api from "./axios";
import type { IncidentStatus, Severity } from "@/types/incident";

type Person = { id: string; name: string };

// One row on the incidents list.
export type IncidentRow = {
  id: string;
  number: number;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  service: { id: string; name: string };
  alertCount: number;
  currentStepPosition: number;
  totalSteps: number;
  acknowledgedBy: Person | null;
  acknowledgedAt: string | null;
  resolvedBy: Person | null;
  resolvedAt: string | null;
  lastAlertAt: string;
  createdAt: string;
};

export type EscalationStep = {
  position: number;
  delayMinutes: number;
  targetType: "USER" | "TEAM" | "SCHEDULE";
  targetName: string;
  state: "pending" | "notified";
  notifiedUsers: { name: string; at: string; status: string }[];
};

// One incident in full.
export type Incident = {
  id: string;
  number: number;
  title: string;
  description: string | null;
  severity: Severity;
  status: IncidentStatus;
  dedupKey: string | null;
  service: { id: string; name: string };
  team: { id: string; name: string };
  alertCount: number;
  createdAt: string;
  lastAlertAt: string;
  acknowledgedBy: Person | null;
  acknowledgedAt: string | null;
  resolvedBy: Person | null;
  resolvedAt: string | null;
  escalation: {
    policy: { id: string; name: string };
    currentStepPosition: number;
    round: number;
    repeatCount: number;
    nextEscalationAt: string | null;
    steps: EscalationStep[];
  };
};

// One line of the timeline.
export type IncidentEvent = {
  id: string;
  type:
    | "CREATED"
    | "ACKNOWLEDGED"
    | "RESOLVED"
    | "COMMENT"
    | "ESCALATED"
    | "NOTIFICATION_SENT";
  actorType: "USER" | "SYSTEM" | "INTEGRATION";
  actor: Person | null;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type IncidentAlert = {
  id: string;
  dedupKey: string | null;
  title: string;
  severity: Severity;
  status: "TRIGGERED" | "RESOLVED";
  payload: unknown;
  receivedAt: string;
};

export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type IncidentFilters = {
  status?: IncidentStatus;
  severity?: Severity;
  service?: string;
  page?: number;
  pageSize?: number;
};

export const getIncidentsApi = (filters: IncidentFilters = {}) =>
  api.get<{ data: IncidentRow[]; meta: PageMeta }>("/incidents", {
    params: filters,
  });

// Looked up by the human number: INC-142 -> 142.
export const getIncidentApi = (number: number) =>
  api.get<Incident>(`/incidents/${number}`);

export const getIncidentEventsApi = (id: string) =>
  api.get<{ data: IncidentEvent[] }>(`/incidents/${id}/events`);

export const getIncidentAlertsApi = (id: string, page = 1) =>
  api.get<{ data: IncidentAlert[]; meta: PageMeta }>(
    `/incidents/${id}/alerts`,
    { params: { page, pageSize: 10 } },
  );

export const acknowledgeIncidentApi = (id: string) =>
  api.post<{ incident: Incident }>(`/incidents/${id}/acknowledge`);

export const resolveIncidentApi = (id: string, note?: string) =>
  api.post<{ incident: Incident }>(`/incidents/${id}/resolve`, { note });

export const addIncidentNoteApi = (id: string, message: string) =>
  api.post<IncidentEvent>(`/incidents/${id}/notes`, { message });
