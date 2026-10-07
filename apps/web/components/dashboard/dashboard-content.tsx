"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { LiveOnCallPanel } from "@/components/dashboard/live-on-call-panel";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { OpenIncidentsPanel } from "@/components/dashboard/open-incidents-panel";
import { ServiceHealth } from "@/components/dashboard/service-health";
import { WeekSummary } from "@/components/dashboard/week-summary";
import { LoadError } from "@/components/shared/load-error";
import { useAuth } from "@/context/auth-context";
import { getAnalyticsSummaryApi } from "@/lib/api/analytics";
import { getIncidentsApi } from "@/lib/api/incidents";
import { getOrganizationApi } from "@/lib/api/organization";
import { getTeamsApi } from "@/lib/api/teams";
import { canManageMembers } from "@/lib/roles";

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
  const waiting = summary.openTriggered;
  const inProgress = summary.openAcknowledged;

  // One plain sentence that answers "is anything on fire?".
  let headline = "Nothing is waiting on anyone right now.";
  if (waiting > 0 && inProgress > 0) {
    headline = `${waiting} ${waiting === 1 ? "incident is" : "incidents are"} waiting for someone, and ${inProgress} ${inProgress === 1 ? "is" : "are"} being worked on.`;
  } else if (waiting > 0) {
    headline = `${waiting} ${waiting === 1 ? "incident is" : "incidents are"} waiting for someone.`;
  } else if (inProgress > 0) {
    headline = `Nothing new. ${inProgress} ${inProgress === 1 ? "incident is" : "incidents are"} being worked on.`;
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="space-y-1.5">
        <p className="text-sm text-zinc-500">{today}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {greeting}, {firstName}
        </h1>
        <p className="text-[15px] text-zinc-600 dark:text-zinc-300">
          {headline}
        </p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <OpenIncidentsPanel incidents={open} canRespond={canRespond} />
          <WeekSummary summary={summary} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <LiveOnCallPanel />
          <ServiceHealth />
        </div>
      </div>

      <RecentActivity />
    </div>
  );
}
