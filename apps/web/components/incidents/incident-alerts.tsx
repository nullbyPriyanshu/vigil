"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getIncidentAlertsApi } from "@/lib/api/incidents";
import { formatDateTime } from "@/lib/time";

// The raw alerts grouped into this incident. Each one opens to show exactly
// what the monitoring tool sent.
export function IncidentAlerts({
  incidentId,
  alertCount,
}: {
  incidentId: string;
  alertCount: number;
}) {
  const [page, setPage] = useState(1);

  // alertCount is in the key so the list reloads when another alert joins.
  const { data } = useQuery({
    queryKey: ["incident-alerts", incidentId, page, alertCount],
    queryFn: async () => (await getIncidentAlertsApi(incidentId, page)).data,
    placeholderData: keepPreviousData,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Alerts
          <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
            {alertCount}
          </span>
        </CardTitle>
      </CardHeader>

      {!data ? (
        <CardContent>
          <div className="h-16 animate-pulse rounded-lg bg-black/[0.04] dark:bg-white/[0.04]" />
        </CardContent>
      ) : (
        <>
          <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
            {data.data.map((alert) => (
              <li key={alert.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-(--card-spacing) py-3 text-sm transition-colors outline-none hover:bg-black/[0.02] focus-visible:bg-black/[0.03] dark:hover:bg-white/[0.02] dark:focus-visible:bg-white/[0.03] [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 truncate text-foreground">
                      {alert.title}
                      {alert.status === "RESOLVED" && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          resolve signal
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(alert.receivedAt)}
                      <span className="ml-3 group-open:hidden">Show</span>
                      <span className="ml-3 hidden group-open:inline">Hide</span>
                    </span>
                  </summary>
                  <pre className="mx-(--card-spacing) mb-3 max-h-72 overflow-auto rounded-lg bg-black/[0.04] p-3 font-mono text-xs leading-relaxed text-zinc-700 dark:bg-white/[0.04] dark:text-zinc-300">
                    {JSON.stringify(alert.payload, null, 2)}
                  </pre>
                </details>
              </li>
            ))}
          </ul>

          {data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between gap-4 border-t border-black/[0.06] px-(--card-spacing) pt-3 dark:border-white/[0.06]">
              <p className="text-sm text-muted-foreground tabular-nums">
                Page {data.meta.page} of {data.meta.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Newer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.meta.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Older
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
