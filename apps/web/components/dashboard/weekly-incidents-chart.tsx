import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DayCount } from "@/lib/mock/dashboard";

// Fixed pixel sizing throughout (rather than percentage heights) because a
// bar's height percentage only resolves against a parent with a definite
// height, and a flex column sized by its own content doesn't reliably give
// browsers one. GET /v1/analytics/incidents-over-time (day 49) supplies the
// real counts; this component only needs the {day, count} shape to change.
const TRACK_HEIGHT = 176;
const GRID_LINES = 4;

// `data` is Monday-first (see lib/mock/dashboard.ts); Date#getDay() is
// Sunday-first (0-6), so shift it by one and wrap.
function todayIndex() {
  return (new Date().getDay() + 6) % 7;
}

// Rounds the tallest bar up to a tidy axis maximum (19 -> 20, 7 -> 8).
function axisMax(max: number) {
  const step = max <= 8 ? 2 : max <= 20 ? 5 : 10;
  return Math.max(Math.ceil(max / step) * step, GRID_LINES);
}

export function WeeklyIncidentsChart({
  data,
  className,
}: {
  data: DayCount[];
  className?: string;
}) {
  const top = axisMax(Math.max(...data.map((d) => d.count), 1));
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const today = todayIndex();
  // Axis labels from the top line down to 0.
  const ticks = Array.from({ length: GRID_LINES + 1 }, (_, i) =>
    Math.round((top / GRID_LINES) * (GRID_LINES - i)),
  );

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Incident activity</CardTitle>
        <CardAction className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 tabular-nums">
            {total} this week
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
            {ticks.map((tick) => (
              <span key={tick} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
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
                {ticks.map((tick) => (
                  <span
                    key={tick}
                    className="h-px w-full bg-black/[0.06] dark:bg-white/[0.06]"
                  />
                ))}
              </div>

              <div className="absolute inset-0 flex items-end gap-2 sm:gap-4">
                {data.map((d, i) => {
                  const barHeight = Math.max(
                    Math.round((d.count / top) * TRACK_HEIGHT),
                    3,
                  );
                  const isToday = i === today;
                  return (
                    <div
                      key={d.day}
                      className="flex h-full flex-1 items-end justify-center"
                    >
                      <Tooltip>
                        <TooltipTrigger
                          delay={150}
                          render={
                            <div
                              className={cn(
                                "w-full max-w-10 rounded-t transition-colors",
                                isToday
                                  ? "bg-emerald-500 dark:bg-emerald-400"
                                  : "bg-emerald-500/30 hover:bg-emerald-500/50 dark:bg-emerald-400/25 dark:hover:bg-emerald-400/45",
                              )}
                              style={{ height: barHeight }}
                            />
                          }
                        />
                        <TooltipContent side="top">
                          {d.count} incident{d.count === 1 ? "" : "s"}
                          {isToday ? " · today" : ` · ${d.day}`}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-2 flex gap-2 sm:gap-4">
              {data.map((d, i) => (
                <span
                  key={d.day}
                  className={cn(
                    "flex-1 text-center text-[11px]",
                    i === today
                      ? "font-medium text-zinc-800 dark:text-zinc-200"
                      : "text-zinc-500",
                  )}
                >
                  {d.day}
                </span>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
