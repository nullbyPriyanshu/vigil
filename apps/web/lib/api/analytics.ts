import api from "./axios";

export type DayCount = { date: string; count: number };

export type AnalyticsSummary = {
  days: number;
  openTriggered: number;
  openAcknowledged: number;
  totalIncidents: number;
  // The same number of days just before this period, to compare against.
  previousTotalIncidents: number;
  // Seconds. null when nothing was acknowledged / resolved in the period.
  mttaSeconds: number | null;
  mttrSeconds: number | null;
  // 0.22 = 22% of incidents went past the first step.
  escalationRate: number;
  bySeverity: { CRITICAL: number; HIGH: number; LOW: number };
  incidentsByDay: DayCount[];
};

export type ServiceStats = {
  service: { id: string; name: string };
  count: number;
  mttaSeconds: number | null;
  mttrSeconds: number | null;
};

export type AnalyticsDays = 7 | 30 | 90;

export const getAnalyticsSummaryApi = (days: AnalyticsDays = 7) =>
  api.get<AnalyticsSummary>("/analytics/summary", { params: { days } });

export const getIncidentsOverTimeApi = (days: AnalyticsDays = 30) =>
  api.get<{ days: number; series: DayCount[] }>(
    "/analytics/incidents-over-time",
    { params: { days } },
  );

export const getAnalyticsByServiceApi = (days: AnalyticsDays = 30) =>
  api.get<{ data: ServiceStats[] }>("/analytics/by-service", {
    params: { days },
  });
