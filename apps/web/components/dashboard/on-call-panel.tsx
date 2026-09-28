import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OnCallEntry } from "@/lib/mock/dashboard";

// "Who is on call right now" across every schedule — GET /v1/on-call once
// day 33's endpoint exists (it's what makes this panel possible: it reads
// every schedule and asks the resolver who covers this instant).
export function OnCallPanel({ entries }: { entries: OnCallEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>On Call Right Now</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Nobody is on call. Create a schedule so incidents have somewhere
            to route.
          </p>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.team}
              className="flex items-center justify-between gap-3 rounded-lg border border-black/[0.08] bg-black/[0.015] px-3 py-2.5 transition-colors duration-300 dark:border-white/[0.08] dark:bg-white/[0.02]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {entry.team}
                </p>
                <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                  {entry.user}
                </p>
              </div>
              <p className="shrink-0 text-xs whitespace-nowrap text-zinc-500">
                until {entry.until}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
