"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRightIcon,
  CheckCheckIcon,
  CircleAlertIcon,
  EyeIcon,
  TimerIcon,
} from "lucide-react";

import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { LiveOnCallPanel } from "@/components/dashboard/live-on-call-panel";
import { OpenIncidentsPanel } from "@/components/dashboard/open-incidents-panel";
import { ServiceHealth } from "@/components/dashboard/service-health";
import { TargetBar } from "@/components/dashboard/target-bar";
import { StatCard } from "@/components/dashboard/stat-card";
import { WeeklyIncidentsChart } from "@/components/dashboard/weekly-incidents-chart";
import { LoadError } from "@/components/shared/load-error";
import { useAuth } from "@/context/auth-context";
import { getAnalyticsSummaryApi } from "@/lib/api/analytics";
import { getIncidentsApi } from "@/lib/api/incidents";
import { getOrganizationApi } from "@/lib/api/organization";
import { getTeamsApi } from "@/lib/api/teams";
import { MTTA_TARGET_SECONDS, MTTR_TARGET_SECONDS } from "@/lib/constants";
import { formatSeconds } from "@/lib/duration";
import { canManageMembers } from "@/lib/roles";
import { cn } from "@/lib/utils";

const SEVERITIES = [
  { key: "CRITICAL", label: "Critical", bar: "bg-red-500" },
  { key: "HIGH", label: "High", bar: "bg-amber-500" },
  { key: "LOW", label: "Low", bar: "bg-slate-400" },
] as const;

// "Good morning" and today's date, worked out once in the browser so the
// server and the browser never disagree about what time it is.
function useGreeting() {
  const [now] = useState(() => new Date());
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return { greeting, today };
}

// The dashboard, filled from the API: one summary call for the four cards
// and the chart, the open incidents, and who is on call.
export function DashboardContent() {
  const router = useRouter();
  const { session } = useAuth();
  const { greeting, today } = useGreeting();

  // A brand-new organization (nothing set up, wizard never finished or
  // skipped) goes to the setup wizard first.
  const { data: organization, isLoading: organizationLoading } = useQuery({
    queryKey: ["organization"],
    queryFn: async () => (await getOrganizationApi()).data,
  });
  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => (await getTeamsApi()).data.data,
  });
  const needsSetup =
    canManageMembers(session?.role) &&
    organization?.onboardingCompletedAt === null &&
    teams?.length === 0;
  useEffect(() => {
    if (needsSetup) router.replace("/onboarding");
  }, [needsSetup, router]);

  const {
    data: summary,
    isError: summaryFailed,
    refetch: retrySummary,
  } = useQuery({
    queryKey: ["analytics", "summary", 7],
    queryFn: async () => (await getAnalyticsSummaryApi(7)).data,
    refetchInterval: 60 * 1000,
  });

  // Triggered first, then acknowledged; newest first within each.
  const {
    data: open,
    isError: openFailed,
    refetch: retryOpen,
  } = useQuery({
    queryKey: ["incidents", "open"],
    queryFn: async () => {
      const [triggered, acknowledged] = await Promise.all([
        getIncidentsApi({ status: "TRIGGERED", pageSize: 10 }),
        getIncidentsApi({ status: "ACKNOWLEDGED", pageSize: 10 }),
      ]);
      return [...triggered.data.data, ...acknowledged.data.data];
    },
    refetchInterval: 60 * 1000,
  });

  if ((summaryFailed && !summary) || (openFailed && !open)) {
    return (
      <LoadError
        what="the dashboard"
        onRetry={() => {
          retrySummary();
          retryOpen();
        }}
      />
    );
  }
  if (!summary || !open || organizationLoading || teamsLoading || needsSetup) {
    return <DashboardSkeleton />;
  }

  const canRespond = !!session && session.role !== "VIEWER";

  const firstName = session?.user.name.split(" ")[0] ?? "";
  const needAttention = summary.openTriggered;
  const severityTotal =
    summary.bySeverity.CRITICAL + summary.bySeverity.HIGH + summary.bySeverity.LOW;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{today}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {greeting}, {firstName}
          </h1>
        </div>

        {/* The one-line answer to "is anything on fire?" */}
        <Link
          href={needAttention > 0 ? "/incidents?status=TRIGGERED" : "/incidents"}
          className={cn(
            "inline-flex h-9 items-center gap-2.5 rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60",
            needAttention > 0
              ? "border-red-500/30 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:text-red-300"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300",
          )}
        >
          <span className="relative flex size-2">
            {needAttention > 0 && (
              <span className="absolute inline-flex size-full rounded-full bg-red-500/70 motion-safe:animate-ping" />
            )}
            <span
              className={cn(
                "relative inline-flex size-2 rounded-full",
                needAttention > 0 ? "bg-red-500" : "bg-emerald-500",
              )}
            />
          </span>
          {needAttention > 0
            ? `${needAttention} ${needAttention === 1 ? "incident needs" : "incidents need"} someone`
            : "All clear. Nothing is waiting"}
          <ArrowRightIcon className="size-3.5" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Triggered"
          value={summary.openTriggered}
          icon={CircleAlertIcon}
          tone={summary.openTriggered > 0 ? "critical" : "neutral"}
          footer={
            <p className="text-xs text-zinc-500">
              {summary.openTriggered > 0
                ? "Waiting for someone to acknowledge"
                : "Nobody is being paged"}
            </p>
          }
        />
        <StatCard
          label="Acknowledged"
          value={summary.openAcknowledged}
          icon={EyeIcon}
          tone={summary.openAcknowledged > 0 ? "warning" : "neutral"}
          footer={
            <p className="text-xs text-zinc-500">
              {summary.openAcknowledged > 0
                ? "Someone is working on these"
                : "Nothing in progress"}
            </p>
          }
        />
        <StatCard
          label="MTTA (7d)"
          value={formatSeconds(summary.mttaSeconds)}
          icon={TimerIcon}
          target={
            summary.mttaSeconds === null
              ? undefined
              : {
                  actualSeconds: summary.mttaSeconds,
                  targetSeconds: MTTA_TARGET_SECONDS,
                }
          }
          footer={
            <TargetBar
              actualSeconds={summary.mttaSeconds}
              targetSeconds={MTTA_TARGET_SECONDS}
            />
          }
        />
        <StatCard
          label="MTTR (7d)"
          value={formatSeconds(summary.mttrSeconds)}
          icon={CheckCheckIcon}
          target={
            summary.mttrSeconds === null
              ? undefined
              : {
                  actualSeconds: summary.mttrSeconds,
                  targetSeconds: MTTR_TARGET_SECONDS,
                }
          }
          footer={
            <TargetBar
              actualSeconds={summary.mttrSeconds}
              targetSeconds={MTTR_TARGET_SECONDS}
            />
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <WeeklyIncidentsChart
          data={summary.incidentsByDay}
          className="lg:col-span-2"
          footer={
            severityTotal > 0 && (
              <div className="mt-5 border-t border-black/[0.06] pt-4 dark:border-white/[0.06]">
                {/* One bar split by severity, with the counts spelled out. */}
                <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
                  {SEVERITIES.map(
                    (severity) =>
                      summary.bySeverity[severity.key] > 0 && (
                        <span
                          key={severity.key}
                          className={severity.bar}
                          style={{ flexGrow: summary.bySeverity[severity.key] }}
                        />
                      ),
                  )}
                </div>
                <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-500">
                  {SEVERITIES.map((severity) => (
                    <li key={severity.key} className="flex items-center gap-1.5">
                      <span className={`size-2 rounded-full ${severity.bar}`} />
                      {severity.label}
                      <span className="font-medium text-zinc-800 tabular-nums dark:text-zinc-200">
                        {summary.bySeverity[severity.key]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          }
        />
        <LiveOnCallPanel />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OpenIncidentsPanel incidents={open} canRespond={canRespond} />
        </div>
        <ServiceHealth />
      </div>
    </div>
  );
}
