"use client";

import { useEffect, useState } from "react";

// "3m 04s", counting down. Under a minute: "42s".
function formatLeft(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return minutes > 0 ? `${minutes}m ${rest}s` : `${seconds % 60}s`;
}

// Ticks down to the moment the incident moves on if nobody acknowledges.
// The API works out that moment; this only shows the time left.
export function EscalationCountdown({
  nextEscalationAt,
  next,
}: {
  nextEscalationAt: string;
  // What happens then, e.g. "escalates to Rahul Verma".
  next: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const left = new Date(nextEscalationAt).getTime() - now;

  return (
    <div className="mt-4 flex items-baseline justify-between gap-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5">
      <p className="min-w-0 text-sm text-foreground">
        If nobody acknowledges, {next}
      </p>
      <p
        role="timer"
        className="shrink-0 font-mono text-sm font-medium text-foreground tabular-nums"
      >
        {left > 0 ? `in ${formatLeft(left)}` : "any moment now"}
      </p>
    </div>
  );
}
