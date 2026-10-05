import { ArrowDownIcon, ArrowUpIcon, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "critical" | "warning" | "neutral";

// Colors spelled out in full so Tailwind's build can see them.
const TONE_STYLES: Record<Tone, string> = {
  critical: "bg-red-500/10 text-red-600 dark:text-red-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  neutral: "bg-zinc-500/10 text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300",
};

// One of the four top-row numbers (active alerts, open incidents, MTTA,
// MTTR). `tone` is purely visual emphasis, independent of incident status
// colors (see StatusDot) — a stat card isn't an incident.
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  trend,
  target,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: Tone;
  // Percent change against the previous period. Every stat here is "lower
  // is better", so a drop is shown in green and a rise in amber.
  trend?: number;
  // Only meaningful for time-based stats (MTTA/MTTR): shows a small
  // under-/over-target indicator below the label.
  target?: { actualSeconds: number; targetSeconds: number };
}) {
  const underTarget = target ? target.actualSeconds <= target.targetSeconds : null;
  const improved = trend !== undefined && trend <= 0;

  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between gap-3">
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-300",
              TONE_STYLES[tone],
            )}
          >
            <Icon className="size-[18px]" />
          </div>
          {trend !== undefined && (
            <span
              title="Compared with the previous 7 days"
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
                improved
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
              )}
            >
              {trend <= 0 ? (
                <ArrowDownIcon className="size-3" />
              ) : (
                <ArrowUpIcon className="size-3" />
              )}
              {Math.abs(trend)}%
            </span>
          )}
        </div>

        <p className="mt-4 text-[28px] leading-none font-semibold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-50">
          {value}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
          {underTarget !== null && (
            <p
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium",
                underTarget
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  underTarget ? "bg-emerald-500" : "bg-amber-500",
                )}
              />
              {underTarget ? "under target" : "over target"}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
