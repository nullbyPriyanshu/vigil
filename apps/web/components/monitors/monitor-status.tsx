import type { MonitorStatus } from "@/lib/api/monitors";
import { cn } from "@/lib/utils";

const LABELS: Record<MonitorStatus, string> = {
  UP: "Up",
  DOWN: "Down",
  PENDING: "Not checked yet",
};

// "Up" or "Down" as a coloured word, the same quiet style as severity.
export function MonitorStatusLabel({
  status,
  className,
}: {
  status: MonitorStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-xs font-medium whitespace-nowrap",
        status === "DOWN" && "text-red-600 dark:text-red-400",
        status === "UP" && "text-zinc-900 dark:text-zinc-100",
        status === "PENDING" && "text-zinc-500",
        className,
      )}
    >
      {LABELS[status]}
    </span>
  );
}

// The small dot in front of a monitor's name.
export function MonitorDot({ status }: { status: MonitorStatus }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2 shrink-0 rounded-full",
        status === "DOWN" && "bg-red-500",
        status === "UP" && "bg-emerald-500",
        status === "PENDING" && "bg-zinc-400",
      )}
    />
  );
}
