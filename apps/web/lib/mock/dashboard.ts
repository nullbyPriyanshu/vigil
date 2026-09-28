import type { IncidentSummary } from "@/types/incident";

// Static placeholder data for the dashboard, standing in for
// GET /v1/analytics/summary, GET /v1/on-call and GET /v1/incidents until
// those endpoints exist (build plan days 25, 33 and 49). Every shape here
// is deliberately the shape the real response will have, so wiring up the
// API later is a data-fetching change, not a component rewrite.

export const dashboardStats = {
  activeAlerts: 2,
  openIncidents: 4,
  // Pre-formatted for display, plus the raw seconds the dashboard's
  // target-comparison indicator needs (see lib/constants.ts). The API will
  // return seconds only — formatting happens once analytics/summary
  // (day 49) is wired up, same as the display strings below.
  mtta: "4m 12s",
  mttaSeconds: 4 * 60 + 12,
  mttr: "38m",
  mttrSeconds: 38 * 60,
};

export type OnCallEntry = {
  team: string;
  user: string;
  until: string;
};

export const onCallNow: OnCallEntry[] = [
  { team: "Platform Team", user: "Priyanshu M.", until: "Mon 10:00 IST" },
  { team: "Payments Team", user: "Sneha K.", until: "Mon 10:00 IST" },
];

export type DayCount = { day: string; count: number };

export const incidentsThisWeek: DayCount[] = [
  { day: "Mon", count: 8 },
  { day: "Tue", count: 12 },
  { day: "Wed", count: 7 },
  { day: "Thu", count: 14 },
  { day: "Fri", count: 19 },
  { day: "Sat", count: 4 },
  { day: "Sun", count: 6 },
];

export const openIncidents: IncidentSummary[] = [
  {
    id: "1",
    number: 142,
    title: "Database connection pool exhausted",
    service: "Checkout API",
    severity: "CRITICAL",
    status: "TRIGGERED",
    timeAgo: "2m ago",
  },
  {
    id: "2",
    number: 141,
    title: "Payment webhook timeout",
    service: "Payments API",
    severity: "HIGH",
    status: "TRIGGERED",
    timeAgo: "14m ago",
  },
  {
    id: "3",
    number: 140,
    title: "Elevated 5xx rate on /api/orders",
    service: "Checkout API",
    severity: "HIGH",
    status: "ACKNOWLEDGED",
    timeAgo: "31m ago",
    acknowledgedBy: "Rahul",
  },
  {
    id: "4",
    number: 139,
    title: "Disk usage above 80%",
    service: null,
    severity: "LOW",
    status: "RESOLVED",
    timeAgo: "2h ago",
    resolvedBy: "Sneha",
  },
];
