import { StatusDot } from "@/components/shared/status-dot";
import type { IncidentStatus } from "@/types/incident";

const LABELS: Record<IncidentStatus, string> = {
  TRIGGERED: "Triggered",
  ACKNOWLEDGED: "Acknowledged",
  RESOLVED: "Resolved",
};

// The status dot with its word next to it.
export function StatusLabel({ status }: { status: IncidentStatus }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-foreground">
      <StatusDot status={status} />
      {LABELS[status]}
    </span>
  );
}
