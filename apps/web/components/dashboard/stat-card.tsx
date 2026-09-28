import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "critical" | "warning" | "neutral";

// Colors spelled out in full so Tailwind's build can see them.
const TONE_STYLES: Record<Tone, string> = {
  critical: "bg-red-500/10 text-red-600 dark:text-red-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  neutral: "bg-zinc-500/10 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400",
};

// One of the four top-row numbers (active alerts, open incidents, MTTA,
// MTTR). `tone` is purely visual emphasis, independent of incident status
// colors (see StatusDot) — a stat card isn't an incident.
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  target,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: Tone;
  // Only meaningful for time-based stats (MTTA/MTTR): shows a small
  // under-/over-target indicator below the label. `actualSeconds` and
  // `targetSeconds` are compared directly — the target is emerald when met,
  // amber when missed (see lib/constants.ts for the placeholder targets).
  target?: { actualSeconds: number; targetSeconds: number };
}) {
  const underTarget = target ? target.actualSeconds <= target.targetSeconds : null;

  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors duration-300",
            TONE_STYLES[tone],
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {value}
          </p>
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            {label}
          </p>
          {underTarget !== null && (
            <p
              className={cn(
                "mt-1 inline-flex items-center gap-1 text-[11px] font-medium",
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
