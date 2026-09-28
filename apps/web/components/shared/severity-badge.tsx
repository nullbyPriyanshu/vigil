import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Severity } from "@/types/incident";

// Severity is a separate visual channel from incident *status* (see
// StatusDot) — it says how bad the problem is, not what state it's in.
// Colors are spelled out in full so Tailwind's build can see them.
const SEVERITY_STYLES: Record<Severity, string> = {
  CRITICAL: "bg-red-500/15 text-red-700 ring-red-500/25 dark:text-red-400",
  HIGH: "bg-amber-500/15 text-amber-700 ring-amber-500/25 dark:text-amber-400",
  LOW: "bg-slate-400/15 text-slate-600 ring-slate-400/25 dark:text-slate-300",
};

export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn("ring-1 ring-inset", SEVERITY_STYLES[severity], className)}
    >
      {severity}
    </Badge>
  );
}
