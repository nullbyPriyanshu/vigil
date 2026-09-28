import { cn } from "@/lib/utils";
import type { IncidentStatus } from "@/types/incident";

// The build plan's one hard rule about color (day 9): red = triggered,
// amber = acknowledged, green = resolved — used consistently everywhere
// and nowhere else. This is the one place that mapping is defined.
const STATUS_STYLES: Record<IncidentStatus, { dot: string; label: string }> = {
  TRIGGERED: { dot: "bg-red-500", label: "Triggered" },
  ACKNOWLEDGED: { dot: "bg-amber-500", label: "Acknowledged" },
  RESOLVED: { dot: "bg-emerald-500", label: "Resolved" },
};

export function StatusDot({
  status,
  className,
}: {
  status: IncidentStatus;
  className?: string;
}) {
  const { dot, label } = STATUS_STYLES[status];
  return (
    <span
      className={cn("inline-flex size-2 shrink-0 rounded-full", dot, className)}
      role="img"
      aria-label={label}
      title={label}
    />
  );
}
