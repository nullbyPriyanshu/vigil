import api from "./axios";
import type { IncidentStatus, Severity } from "@/types/incident";

export type ActionLink = {
  action: "ACKNOWLEDGE" | "RESOLVE";
  incident: {
    number: number;
    title: string;
    severity: Severity;
    status: IncidentStatus;
    service: string;
  };
  user: { name: string };
  expiresAt: string;
};

export type ActionResult = {
  action: "ACKNOWLEDGE" | "RESOLVE";
  incident: { number: number; status: IncidentStatus };
  dashboardUrl: string;
};

// Looking at a link never performs it. Only the POST does.
export const getActionLinkApi = (token: string) =>
  api.get<ActionLink>(`/a/${token}`);

export const performActionLinkApi = (token: string) =>
  api.post<ActionResult>(`/a/${token}`);
