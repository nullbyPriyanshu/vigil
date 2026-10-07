import type { IncidentRow } from "@/lib/api/incidents";

// What happened to an incident most recently, and when.
export function latestChange(incident: IncidentRow) {
  if (incident.status === "RESOLVED" && incident.resolvedAt) {
    return {
      at: incident.resolvedAt,
      text: incident.resolvedBy
        ? `Resolved by ${incident.resolvedBy.name}`
        : "Resolved automatically",
    };
  }
  if (incident.status === "ACKNOWLEDGED" && incident.acknowledgedAt) {
    return {
      at: incident.acknowledgedAt,
      text: incident.acknowledgedBy
        ? `Acknowledged by ${incident.acknowledgedBy.name}`
        : "Acknowledged",
    };
  }
  return { at: incident.createdAt, text: "Triggered, waiting for someone" };
}
