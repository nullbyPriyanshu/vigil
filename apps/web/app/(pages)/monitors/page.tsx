"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ActivityIcon, PlusIcon } from "lucide-react";

import { MonitorFormDialog } from "@/components/monitors/monitor-form-dialog";
import { MonitorDot, MonitorStatusLabel } from "@/components/monitors/monitor-status";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadError } from "@/components/shared/load-error";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { getMonitorsApi } from "@/lib/api/monitors";
import { canManageMembers } from "@/lib/roles";
import { timeAgo } from "@/lib/time";

export default function MonitorsPage() {
  const { session } = useAuth();
  const [creating, setCreating] = useState(false);

  const { data: monitors, isLoading, isError, refetch } = useQuery({
    queryKey: ["monitors"],
    queryFn: async () => (await getMonitorsApi()).data.data,
    // Checks run every minute on the server, so keep the list fresh.
    refetchInterval: 30 * 1000,
  });

  const canManage = canManageMembers(session?.role);
  const down = (monitors ?? []).filter((m) => m.status === "DOWN").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ActivityIcon}
        title="Monitors"
        description="Addresses Vigil checks for you. When one stops answering, an incident opens by itself."
        action={
          canManage ? (
            <Button onClick={() => setCreating(true)} className="h-9 px-3.5">
              <PlusIcon className="size-4" />
              New monitor
            </Button>
          ) : undefined
        }
      />

      {isError && !monitors ? (
        <LoadError what="the monitors" onRetry={() => refetch()} />
      ) : isLoading || !monitors ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : monitors.length === 0 ? (
        <EmptyState
          icon={ActivityIcon}
          title="Nothing is being watched yet"
          description={
            canManage
              ? "Add the address of your website or API. Vigil will visit it on a timer and page whoever is on call if it goes down."
              : "An owner or admin can add monitors. They'll show up here."
          }
          action={
            canManage ? (
              <Button onClick={() => setCreating(true)} className="h-9 px-3.5">
                <PlusIcon className="size-4" />
                Add your first monitor
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {down === 0
              ? `All ${monitors.length} ${monitors.length === 1 ? "address is" : "addresses are"} answering.`
              : `${down} of ${monitors.length} ${down === 1 ? "is" : "are"} down.`}
          </p>

          <Card className="gap-0 py-0">
            <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
              {monitors.map((monitor) => (
                <li key={monitor.id}>
                  <Link
                    href={`/monitors/${monitor.id}`}
                    className="flex flex-wrap items-center gap-x-6 gap-y-1 px-(--card-spacing) py-3.5 transition-colors outline-none hover:bg-black/[0.02] focus-visible:bg-black/[0.03] dark:hover:bg-white/[0.02] dark:focus-visible:bg-white/[0.03]"
                  >
                    <div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
                      <MonitorDot status={monitor.status} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {monitor.name}
                        </p>
                        <p className="truncate text-xs text-zinc-500">{monitor.url}</p>
                      </div>
                    </div>

                    <p className="hidden w-40 truncate text-sm text-zinc-700 md:block dark:text-zinc-300">
                      {monitor.service.name}
                    </p>
                    <p className="hidden w-20 text-right text-sm text-zinc-500 tabular-nums sm:block">
                      {monitor.lastResponseMs === null ? "" : `${monitor.lastResponseMs} ms`}
                    </p>
                    <p className="hidden w-24 text-right text-xs text-zinc-500 lg:block">
                      {monitor.lastCheckedAt ? timeAgo(monitor.lastCheckedAt) : ""}
                    </p>
                    <MonitorStatusLabel status={monitor.status} className="w-24 text-right" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {creating && <MonitorFormDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
