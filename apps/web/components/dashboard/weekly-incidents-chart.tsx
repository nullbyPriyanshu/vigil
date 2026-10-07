import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DayCount } from "@/lib/api/analytics";
import { cn } from "@/lib/utils";

// Fixed pixel sizing throughout (rather than percentage heights) because a
// bar's height percentage only resolves against a parent with a definite
// height, and a flex column sized by its own content doesn't reliably give
// browsers one.
const TRACK_HEIGHT = 176;
const GRID_LINES = 4;

// Rounds the tallest bar up to a tidy axis maximum (19 -> 20, 7 -> 8).
function axisMax(max: number) {
  const step = max <= 8 ? 2 : max <= 20 ? 5 : 10;
  return Math.max(Math.ceil(max / step) * step, GRID_LINES);
}

// "2026-01-12" -> a Date at local midnight, so the weekday is right
// wherever the viewer is.
function toDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// One bar per day, oldest first; the last bar is today. Used for the
// dashboard's week and the analytics page's 30 and 90 days.
export function WeeklyIncidentsChart({
  data,
  title = "Incident activity",
  className,
  footer,
}: {
  data: DayCount[];
  title?: string;
  className?: string;
  footer?: React.ReactNode;
}) {
  const top = axisMax(Math.max(...data.map((d) => d.count), 1));
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const last = data.length - 1;
  // With many days there's no room for a label under every bar.
  const labelEvery = data.length <= 7 ? 1 : data.length <= 31 ? 5 : 15;
  // Axis labels from the top line down to 0.
  const ticks = Array.from({ length: GRID_LINES + 1 }, (_, i) =>
    Math.round((top / GRID_LINES) * (GRID_LINES - i)),
  );

  const label = (d: DayCount) =>
    data.length <= 7
      ? toDate(d.date).toLocaleDateString(undefined, { weekday: "short" })
      : toDate(d.date).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
        });

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardAction className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 tabular-nums">
            {total} in the last {data.length} days
          </span>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3">
          <div
            aria-hidden
            className="flex flex-col justify-between text-right text-[11px] leading-none text-zinc-500 tabular-nums"
            style={{ height: TRACK_HEIGHT }}
          >
            {ticks.map((tick, i) => (
              <span key={i} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
                {tick}
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <div className="relative" style={{ height: TRACK_HEIGHT }}>
              <div
                aria-hidden
                className="absolute inset-0 flex flex-col justify-between"
              >
                {ticks.map((_, i) => (
                  <span
                    key={i}
                    className="h-px w-full bg-black/[0.06] dark:bg-white/[0.06]"
                  />
                ))}
              </div>

              <div
                className={cn(
                  "absolute inset-0 flex items-end",
                  data.length <= 7 ? "gap-2 sm:gap-4" : "gap-px sm:gap-0.5",
                )}
              >
                {data.map((d, i) => {
                  // An empty day still gets a sliver, so the day is visible.
                  const barHeight = Math.max(
                    Math.round((d.count / top) * TRACK_HEIGHT),
                    2,
                  );
                  const isToday = i === last;
                  return (
                    <Tooltip key={d.date}>
                      <TooltipTrigger
                        delay={100}
                        render={
                          // The whole column is the hover target, not just
                          // the bar, so short bars are easy to hit.
                          <div className="group flex h-full flex-1 items-end justify-center">
                            <div
                              className={cn(
                                "w-full max-w-10 rounded-t transition-colors",
                                d.count === 0
                                  ? "bg-black/10 dark:bg-white/10"
                                  : isToday
                                    ? "bg-emerald-500 dark:bg-emerald-400"
                                    : "bg-emerald-500/35 group-hover:bg-emerald-500/60 dark:bg-emerald-400/30 dark:group-hover:bg-emerald-400/55",
                              )}
                              style={{ height: barHeight }}
                            />
                          </div>
                        }
                      />
                      <TooltipContent side="top">
                        {d.count} incident{d.count === 1 ? "" : "s"} ·{" "}
                        {isToday
                          ? "today"
                          : toDate(d.date).toLocaleDateString(undefined, {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>

            <div
              className={cn(
                "mt-2 flex",
                data.length <= 7 ? "gap-2 sm:gap-4" : "gap-px sm:gap-0.5",
              )}
            >
              {data.map((d, i) => (
                <span
                  key={d.date}
                  className={cn(
                    "flex-1 overflow-visible text-center text-[11px] whitespace-nowrap",
                    i === last && data.length <= 7
                      ? "font-medium text-zinc-800 dark:text-zinc-200"
                      : "text-zinc-500",
                  )}
                >
                  {/* Counted from the right so today's end always has a label. */}
                  {(last - i) % labelEvery === 0 ? label(d) : ""}
                </span>
              ))}
            </div>
          </div>
        </div>
        {footer}
      </CardContent>
    </Card>
  );
}
