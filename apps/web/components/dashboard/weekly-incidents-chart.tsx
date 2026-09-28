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
const TRACK_HEIGHT = 88;
const ROW_HEIGHT = TRACK_HEIGHT + 20;

// `data` is Monday-first (see lib/mock/dashboard.ts); Date#getDay() is
// Sunday-first (0-6), so shift it by one and wrap.
function todayIndex() {
  return (new Date().getDay() + 6) % 7;
}

export function WeeklyIncidentsChart({ data }: { data: DayCount[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const today = todayIndex();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Incidents This Week</CardTitle>
        <CardAction>
          <span className="text-xs text-zinc-500">{total} total</span>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2" style={{ height: ROW_HEIGHT }}>
          {data.map((d, i) => {
            const barHeight = Math.max(
              Math.round((d.count / max) * TRACK_HEIGHT),
              4,
            );
            const isToday = i === today;
            return (
              <div
                key={d.day}
                className="flex flex-1 flex-col items-center justify-end gap-1.5"
                style={{ height: ROW_HEIGHT }}
              >
                <Tooltip>
                  <TooltipTrigger
                    delay={200}
                    render={
                      <div
                        className={cn(
                          "w-full rounded-t-sm transition-colors",
                          isToday ? "bg-emerald-400" : "bg-emerald-400/40",
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
                <span
                  className={cn(
                    "text-[11px]",
                    isToday
                      ? "font-medium text-zinc-700 dark:text-zinc-300"
                      : "text-zinc-500",
                  )}
                >
                  {d.day}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
