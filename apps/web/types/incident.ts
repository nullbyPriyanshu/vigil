// Mirrors the Prisma enums the API will expose (see the Incident model in
// the build plan, day 22). Keeping these in sync now means the dashboard's
// mock data already has the exact shape the real API response will have.
export type Severity = "CRITICAL" | "HIGH" | "LOW";

export type IncidentStatus = "TRIGGERED" | "ACKNOWLEDGED" | "RESOLVED";

// The subset of an incident the dashboard's open-incidents list needs. Once
// GET /v1/incidents exists, this is the type to reconcile against the real
// response rather than a starting point to throw away.
export type IncidentSummary = {
  id: string;
  number: number;
  title: string;
  service: string | null;
  severity: Severity;
  status: IncidentStatus;
  // Human-readable relative time ("2m ago"), and who last acted on it, when
  // applicable — the API will send a timestamp instead and the UI will
  // format it, but for static mock data a pre-formatted string is simpler.
  timeAgo: string;
  acknowledgedBy?: string;
  resolvedBy?: string;
};
