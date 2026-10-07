"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { StatusDot } from "@/components/shared/status-dot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getIncidentsApi } from "@/lib/api/incidents";
import { latestChange } from "@/lib/incident-latest";
import { timeAgo } from "@/lib/time";

// The last few things that happened across all incidents: who picked what
// up, what got resolved. Shares its data with the bell in the top bar.
export function RecentActivity() {
  const { data: incidents } = useQuery({
    queryKey: ["incidents", "bell"],
    queryFn: async () => (await getIncidentsApi({ pageSize: 30 })).data.data,
    refetchInterval: 60 * 1000,
  });

  const items = (incidents ?? [])
    .map((incident) => ({ incident, ...latestChange(incident) }))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
      </CardHeader>
      <CardContent>
        {!incidents ? (
          <p className="py-6 text-sm text-zinc-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="py-6 text-sm text-zinc-500">
            Nothing yet. What happens to incidents shows up here.
          </p>
        ) : (
          <ul className="grid gap-x-10 sm:grid-cols-2">
            {items.map(({ incident, at, text }) => (
              <li key={incident.id}>
                <Link
                  href={`/incidents/${incident.number}`}
                  className="-mx-2 flex gap-3 rounded-lg px-2 py-2.5 transition-colors outline-none hover:bg-black/[0.03] focus-visible:ring-2 focus-visible:ring-emerald-400/60 dark:hover:bg-white/[0.04]"
                >
                  <StatusDot status={incident.status} className="mt-1.5" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-900 dark:text-zinc-100">
                      {text}
                    </span>
                    <span className="block truncate text-xs text-zinc-500">
                      INC-{incident.number} · {incident.title}
                    </span>
                  </span>
                  <span className="shrink-0 pt-0.5 text-xs text-zinc-500 tabular-nums">
                    {timeAgo(at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
