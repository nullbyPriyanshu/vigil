"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeftIcon, Loader2, PencilIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";

import { MonitorFormDialog } from "@/components/monitors/monitor-form-dialog";
import { MonitorDot, MonitorStatusLabel } from "@/components/monitors/monitor-status";
import { ResponseChart } from "@/components/monitors/response-chart";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { LoadError } from "@/components/shared/load-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { getApiErrorMessage } from "@/lib/api/errors";
import { checkMonitorNowApi, deleteMonitorApi, getMonitorApi } from "@/lib/api/monitors";
import { canManageMembers } from "@/lib/roles";
import { formatDateTime, timeAgo } from "@/lib/time";

const EVERY: Record<number, string> = {
  1: "Every minute",
  5: "Every 5 minutes",
  15: "Every 15 minutes",
};

export default function MonitorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: monitor, isLoading, isError, refetch } = useQuery({
    queryKey: ["monitor", id],
    queryFn: async () => (await getMonitorApi(id)).data,
    refetchInterval: 30 * 1000,
    retry: false,
  });

  const checkNow = useMutation({
    mutationFn: async () => (await checkMonitorNowApi(id)).data,
    onSuccess: (updated) => {
      queryClient.setQueryData(["monitor", id], updated);
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
      const latest = updated.checks[0];
      if (latest?.up) toast.success(`Answered in ${latest.responseMs} ms`);
      else toast.error(latest?.error ?? "The check failed");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't run the check.")),
  });

  const canManage = canManageMembers(session?.role);
  const canCheck = !!session && session.role !== "VIEWER";

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  if (!monitor) {
    return (
      <div className="flex flex-col gap-6">
        <BackToMonitors />
        {isError ? (
          <LoadError what="this monitor" onRetry={() => refetch()} />
        ) : (
          <p className="text-sm text-muted-foreground">Monitor not found.</p>
        )}
      </div>
    );
  }

  const failures = monitor.checks.filter((check) => !check.up);

  return (
    <div className="flex flex-col gap-6">
      <BackToMonitors />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2.5">
            <MonitorDot status={monitor.status} />
            <MonitorStatusLabel status={monitor.status} className="text-sm" />
          </div>
          <h1 className="text-xl font-semibold break-words text-zinc-900 dark:text-zinc-100">
            {monitor.name}
          </h1>
          <a
            href={monitor.url}
            target="_blank"
            rel="noreferrer"
            className="block text-sm break-all text-zinc-500 underline-offset-4 hover:underline"
          >
            {monitor.url}
          </a>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {canCheck && (
            <Button
              variant="outline"
              disabled={checkNow.isPending}
              onClick={() => checkNow.mutate()}
              className="h-9 px-3.5"
            >
              {checkNow.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCwIcon className="size-4" />
              )}
              Check now
            </Button>
          )}
          {canManage && (
            <>
              <Button variant="outline" onClick={() => setEditing(true)} className="h-9 px-3.5">
                <PencilIcon className="size-4" />
                Edit
              </Button>
              <Button
                variant="outline"
                onClick={() => setDeleting(true)}
                aria-label="Delete monitor"
                className="h-9 px-3"
              >
                <Trash2Icon className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
            <Figure
              label="Uptime, last 30 days"
              value={monitor.uptimePercent === null ? "–" : `${monitor.uptimePercent}%`}
            />
            <Figure
              label="Last response"
              value={monitor.lastResponseMs === null ? "–" : `${monitor.lastResponseMs} ms`}
            />
            <Figure
              label="Last checked"
              value={monitor.lastCheckedAt ? timeAgo(monitor.lastCheckedAt) : "–"}
            />
            <Figure label="Checked" value={EVERY[monitor.intervalMinutes] ?? "–"} />
          </dl>
        </CardContent>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Response time</CardTitle>
          </CardHeader>
          <CardContent>
            {monitor.checks.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No checks yet. The first one runs within a minute.
              </p>
            ) : (
              <ResponseChart checks={monitor.checks} />
            )}
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>When it goes down</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
              <p>
                After two failed checks in a row, an incident opens for{" "}
                <Link
                  href={`/services/${monitor.service.id}`}
                  className="font-medium text-zinc-900 underline decoration-black/20 underline-offset-4 hover:decoration-black/60 dark:text-zinc-100 dark:decoration-white/25 dark:hover:decoration-white/70"
                >
                  {monitor.service.name}
                </Link>{" "}
                and follows its escalation policy.
              </p>
              <p>It closes by itself as soon as the address answers again.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent failures</CardTitle>
            </CardHeader>
            <CardContent>
              {failures.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  None in the last {monitor.checks.length || ""} checks.
                </p>
              ) : (
                <ul className="space-y-3">
                  {failures.slice(0, 6).map((check) => (
                    <li key={check.id} className="text-sm">
                      <p className="text-zinc-900 dark:text-zinc-100">
                        {check.error ?? "Failed"}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {formatDateTime(check.checkedAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {editing && <MonitorFormDialog monitor={monitor} onClose={() => setEditing(false)} />}

      {deleting && (
        <ConfirmDeleteDialog
          name={monitor.name}
          description="Vigil stops checking this address and forgets its history. If it is down right now, its open incident is resolved."
          actionLabel="Delete monitor"
          onDelete={() => deleteMonitorApi(monitor.id)}
          onDeleted={() => {
            queryClient.invalidateQueries({ queryKey: ["monitors"] });
            toast.success(`Stopped watching ${monitor.name}`);
            router.push("/monitors");
          }}
          onClose={() => setDeleting(false)}
        />
      )}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dd className="text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-50">
        {value}
      </dd>
      <dt className="mt-0.5 text-xs text-zinc-500">{label}</dt>
    </div>
  );
}

function BackToMonitors() {
  return (
    <Link
      href="/monitors"
      className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-emerald-400/60"
    >
      <ArrowLeftIcon className="size-3.5" />
      Monitors
    </Link>
  );
}
