"use client";

import { useState } from "react";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DayCount } from "@/lib/api/analytics";
import { cn } from "@/lib/utils";

const GRID_LINES = 4;

// Rounds the busiest day up to an axis maximum that splits into four even
// steps (7 -> 8, 19 -> 20, 46 -> 60), so every grid line is a whole number.
function axisMax(max: number) {
  const step = max <= 40 ? GRID_LINES : GRID_LINES * 5;
  return Math.max(Math.ceil(max / step) * step, GRID_LINES);
}

// "2026-01-12" -> a Date at local midnight, so the weekday is right
// wherever the viewer is.
function toDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

type Point = { x: number; y: number };

// A smooth curve through the points that never dips below a day's real
// value or swings above it (a "monotone" curve), so a quiet day next to a
// busy one doesn't make the line appear to go negative.
function smoothPath(points: Point[]) {
  if (points.length === 1) return `M0,${points[0].y} L100,${points[0].y}`;

  const slopes = points
    .slice(0, -1)
    .map((p, i) => (points[i + 1].y - p.y) / (points[i + 1].x - p.x));
  const tangents = points.map((_, i) => {
    if (i === 0) return slopes[0];
    if (i === points.length - 1) return slopes[i - 1];
    // A peak or a dip gets a flat tangent, which is what stops overshoot.
    if (slopes[i - 1] * slopes[i] <= 0) return 0;
    return (slopes[i - 1] + slopes[i]) / 2;
  });
  for (let i = 0; i < slopes.length; i++) {
    if (slopes[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const a = tangents[i] / slopes[i];
    const b = tangents[i + 1] / slopes[i];
    const length = a * a + b * b;
    if (length > 9) {
      const scale = 3 / Math.sqrt(length);
      tangents[i] = scale * a * slopes[i];
      tangents[i + 1] = scale * b * slopes[i];
    }
  }

  let path = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    const third = (to.x - from.x) / 3;
    path += ` C${from.x + third},${from.y + tangents[i] * third} ${to.x - third},${to.y - tangents[i + 1] * third} ${to.x},${to.y}`;
  }
  return path;
}

// Incidents per day as a line, oldest day on the left and today on the
// right. Move the pointer over it to read any day.
export function IncidentsLine({
  data,
  height = 200,
}: {
  data: DayCount[];
  height?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const last = data.length - 1;
  const top = axisMax(Math.max(...data.map((d) => d.count), 1));
  // Axis labels from the top line down to 0.
  const ticks = Array.from({ length: GRID_LINES + 1 }, (_, i) =>
    Math.round((top / GRID_LINES) * (GRID_LINES - i)),
  );
  // Positions in percent of the plot: x across, y from the top.
  const points = data.map((d, i) => ({
    x: last === 0 ? 50 : (i / last) * 100,
    y: 100 - (d.count / top) * 100,
  }));
  const line = smoothPath(points);

  // With many days there's no room for a label under every one.
  const labelEvery = data.length <= 7 ? 1 : data.length <= 31 ? 5 : 15;
  const shown = hovered ?? last;

  return (
    <div className="flex gap-3">
      <div
        aria-hidden
        className="flex flex-col justify-between text-right text-[11px] leading-none text-zinc-500 tabular-nums"
        style={{ height }}
      >
        {ticks.map((tick, i) => (
          <span key={i} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
            {tick}
          </span>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div
          className="relative cursor-crosshair touch-none text-zinc-900 dark:text-zinc-100"
          style={{ height }}
          onPointerMove={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            const ratio = (event.clientX - box.left) / box.width;
            setHovered(Math.min(last, Math.max(0, Math.round(ratio * last))));
          }}
          onPointerLeave={() => setHovered(null)}
        >
          <div aria-hidden className="absolute inset-0 flex flex-col justify-between">
            {ticks.map((_, i) => (
              <span key={i} className="h-px w-full bg-black/[0.06] dark:bg-white/[0.06]" />
            ))}
          </div>

          <svg
            aria-hidden
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="animate-chart-reveal absolute inset-0 size-full overflow-visible"
          >
            <path d={`${line} L100,100 L0,100 Z`} fill="currentColor" opacity={0.07} />
            <path
              d={line}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* The day being read: a guide line, a dot on the curve and a label. */}
          <span
            aria-hidden
            className={cn(
              "absolute inset-y-0 w-px bg-black/15 transition-opacity dark:bg-white/20",
              hovered === null ? "opacity-0" : "opacity-100",
            )}
            style={{ left: `${points[shown].x}%` }}
          />
          <span
            aria-hidden
            className="animate-chart-dot absolute size-2.5 -translate-1/2 rounded-full border-2 border-current bg-card"
            style={{ left: `${points[shown].x}%`, top: `${points[shown].y}%` }}
          />
          {hovered !== null && (
            <div
              className={cn(
                "pointer-events-none absolute z-10 -translate-y-full rounded-lg border border-black/10 bg-popover px-2.5 py-1.5 whitespace-nowrap shadow-sm dark:border-white/10",
                // Flip to the other side near the right edge.
                points[hovered].x > 70 ? "-translate-x-full" : "",
              )}
              style={{
                left: `calc(${points[hovered].x}% + ${points[hovered].x > 70 ? -10 : 10}px)`,
                top: `max(${points[hovered].y}%, 34px)`,
              }}
            >
              <p className="text-sm font-medium text-foreground tabular-nums">
                {data[hovered].count} incident{data[hovered].count === 1 ? "" : "s"}
              </p>
              <p className="text-xs text-muted-foreground">
                {hovered === last
                  ? "Today"
                  : toDate(data[hovered].date).toLocaleDateString(undefined, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
              </p>
            </div>
          )}
        </div>

        <div aria-hidden className="relative mt-2 h-4">
          {data.map((d, i) =>
            // Counted from the right so today's end always has a label.
            (last - i) % labelEvery !== 0 ? null : (
              <span
                key={d.date}
                className={cn(
                  "absolute text-[11px] whitespace-nowrap text-zinc-500",
                  i === 0 ? "" : i === last ? "-translate-x-full" : "-translate-x-1/2",
                )}
                style={{ left: `${points[i].x}%` }}
              >
                {i === last
                  ? "Today"
                  : data.length <= 7
                    ? toDate(d.date).toLocaleDateString(undefined, { weekday: "short" })
                    : toDate(d.date).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })}
              </span>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

// The line chart in its own card, for the Analytics page.
export function IncidentsChart({
  data,
  title = "Incidents per day",
  className,
}: {
  data: DayCount[];
  title?: string;
  className?: string;
}) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const busiest = data.reduce((best, d) => (d.count > best.count ? d : best), data[0]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardAction className="flex items-center gap-4 text-xs text-zinc-500 tabular-nums">
          {busiest && busiest.count > 0 && (
            <span className="hidden sm:inline">
              Busiest day{" "}
              {toDate(busiest.date).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
              })}{" "}
              ({busiest.count})
            </span>
          )}
          <span>
            {total} in the last {data.length} days
          </span>
        </CardAction>
      </CardHeader>
      <CardContent>
        <IncidentsLine data={data} height={240} />
      </CardContent>
    </Card>
  );
}
