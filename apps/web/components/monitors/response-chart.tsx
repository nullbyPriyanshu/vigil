"use client";

import { useState } from "react";

import type { MonitorCheck } from "@/lib/api/monitors";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

const HEIGHT = 140;

// One thin bar per check, oldest on the left. The height is how long the
// address took to answer; a failed check is a full-height red bar.
export function ResponseChart({ checks }: { checks: MonitorCheck[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  // The API sends newest first; a chart reads left to right.
  const ordered = [...checks].reverse();
  const slowest = Math.max(...ordered.filter((c) => c.up).map((c) => c.responseMs), 1);
  const shown = hovered === null ? null : ordered[hovered];

  return (
    <div>
      <div
        className="flex items-end gap-[3px]"
        style={{ height: HEIGHT }}
        onPointerLeave={() => setHovered(null)}
      >
        {ordered.map((check, index) => (
          <div
            key={check.id}
            onPointerEnter={() => setHovered(index)}
            className="flex h-full max-w-3 min-w-0 flex-1 items-end"
          >
            <div
              className={cn(
                "w-full rounded-sm transition-opacity",
                check.up ? "bg-emerald-500" : "bg-red-500",
                hovered !== null && hovered !== index && "opacity-40",
              )}
              style={{
                height: check.up
                  ? Math.max(4, Math.round((check.responseMs / slowest) * HEIGHT))
                  : HEIGHT,
              }}
            />
          </div>
        ))}
      </div>

      {/* What the bar under the pointer means, or how to read the chart. */}
      <p className="mt-3 h-5 text-xs text-zinc-500 tabular-nums">
        {shown
          ? `${formatDateTime(shown.checkedAt)} · ${
              shown.up ? `answered in ${shown.responseMs} ms` : (shown.error ?? "failed")
            }`
          : `Last ${ordered.length} checks, oldest on the left. Taller is slower; red is a failed check.`}
      </p>
    </div>
  );
}
