"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { MonitorDot, MonitorStatusLabel } from "@/components/monitors/monitor-status";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMonitorsApi } from "@/lib/api/monitors";

// The addresses Vigil is checking for this service.
export function MonitorsCard({ serviceId }: { serviceId: string }) {
  const { data: monitors } = useQuery({
    queryKey: ["monitors"],
    queryFn: async () => (await getMonitorsApi()).data.data,
  });

  const mine = (monitors ?? []).filter((m) => m.service.id === serviceId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monitors</CardTitle>
        <CardAction>
          <Link
            href="/monitors"
            className="rounded-md text-xs text-zinc-500 transition-colors outline-none hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-emerald-400/60 dark:hover:text-zinc-100"
          >
            All monitors
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No addresses are being checked for this service. Add one under
            Monitors and Vigil will raise the alert itself.
          </p>
        ) : (
          <ul className="space-y-3">
            {mine.map((monitor) => (
              <li key={monitor.id}>
                <Link
                  href={`/monitors/${monitor.id}`}
                  className="flex items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                >
                  <MonitorDot status={monitor.status} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">
                      {monitor.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {monitor.url}
                    </span>
                  </span>
                  <MonitorStatusLabel status={monitor.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
