import { cn } from "@/lib/utils";
import type { Severity } from "@/types/incident";

// Severity says how bad the problem is (status, shown by StatusDot, says
// what state it's in). It's a plain coloured word, no box around it.
const SEVERITY_STYLES: Record<Severity, string> = {
  CRITICAL: "text-red-600 dark:text-red-400",
  HIGH: "text-amber-600 dark:text-amber-400",
  LOW: "text-zinc-500 dark:text-zinc-400",
};

const SEVERITY_LABELS: Record<Severity, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  LOW: "Low",
};

export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-xs font-medium whitespace-nowrap",
        SEVERITY_STYLES[severity],
        className,
      )}
    >
      {SEVERITY_LABELS[severity]}
    </span>
  );
}
