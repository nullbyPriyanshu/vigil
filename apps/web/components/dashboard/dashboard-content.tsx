"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCheckIcon, CircleAlertIcon, EyeIcon, TimerIcon } from "lucide-react";

import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { DemoDataBanner } from "@/components/dashboard/demo-data-banner";
import { LiveOnCallPanel } from "@/components/dashboard/live-on-call-panel";
import { OpenIncidentsPanel } from "@/components/dashboard/open-incidents-panel";
import { StatCard } from "@/components/dashboard/stat-card";
import { WeeklyIncidentsChart } from "@/components/dashboard/weekly-incidents-chart";
import { PageHeader } from "@/components/shared/page-header";
import { LoadError } from "@/components/shared/load-error";
import { useAuth } from "@/context/auth-context";
import { getAnalyticsSummaryApi } from "@/lib/api/analytics";
import { getIncidentsApi } from "@/lib/api/incidents";
import { getOrganizationApi } from "@/lib/api/organization";
import { getTeamsApi } from "@/lib/api/teams";
import { MTTA_TARGET_SECONDS, MTTR_TARGET_SECONDS } from "@/lib/constants";
import { formatSeconds } from "@/lib/duration";
import { canManageMembers } from "@/lib/roles";

// The dashboard, filled from the API: one summary call for the four cards
// and the chart, the open incidents, and who is on call.
export function DashboardContent() {
  const router = useRouter();
  const { session } = useAuth();

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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overview"
        description="What's on fire, who's covering it, and how fast your team is responding."
      />

      {session?.role === "OWNER" && <DemoDataBanner />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Triggered"
          value={summary.openTriggered}
          icon={CircleAlertIcon}
          tone={summary.openTriggered > 0 ? "critical" : "neutral"}
        />
        <StatCard
          label="Acknowledged"
          value={summary.openAcknowledged}
          icon={EyeIcon}
          tone={summary.openAcknowledged > 0 ? "warning" : "neutral"}
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
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <WeeklyIncidentsChart
          data={summary.incidentsByDay}
          className="lg:col-span-2"
        />
        <LiveOnCallPanel />
      </div>

      <OpenIncidentsPanel incidents={open} canRespond={canRespond} />
    </div>
  );
}
