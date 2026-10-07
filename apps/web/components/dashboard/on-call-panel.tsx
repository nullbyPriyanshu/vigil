import Link from "next/link";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OnCallEntry } from "@/lib/mock/dashboard";

// "Who is on call right now" across every schedule — GET /v1/on-call once
// day 33's endpoint exists (it's what makes this panel possible: it reads
// every schedule and asks the resolver who covers this instant).
export function OnCallPanel({ entries }: { entries: OnCallEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>On call now</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nobody is on call. A schedule decides who gets paged when an
              incident opens.
            </p>
            <Link href="/schedules" className="mt-3 inline-flex items-center gap-1 rounded-md text-sm font-medium text-zinc-900 underline decoration-black/20 underline-offset-4 outline-none hover:decoration-black/60 focus-visible:ring-2 focus-visible:ring-emerald-400/60 dark:text-zinc-100 dark:decoration-white/25 dark:hover:decoration-white/70">
              Create a schedule
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
            {entries.map((entry) => (
              <li
                key={entry.team}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <UserAvatar name={entry.user} className="size-9 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {entry.user}
                  </p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {entry.team}
                  </p>
                </div>
                <p className="shrink-0 text-right text-xs text-zinc-500">
                  until
                  <span className="block text-zinc-700 dark:text-zinc-300">
                    {entry.until}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
