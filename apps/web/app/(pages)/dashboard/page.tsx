import {
  CalendarDaysIcon,
  CheckCheckIcon,
  CircleAlertIcon,
  TimerIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { OnCallPanel } from "@/components/dashboard/on-call-panel";
import { WeeklyIncidentsChart } from "@/components/dashboard/weekly-incidents-chart";
import { OpenIncidentsPanel } from "@/components/dashboard/open-incidents-panel";
import {
  dashboardStats,
  incidentsThisWeek,
  onCallNow,
  openIncidents,
} from "@/lib/mock/dashboard";
import { MTTA_TARGET_SECONDS, MTTR_TARGET_SECONDS } from "@/lib/constants";

// Static mock data for now (see lib/mock/dashboard.ts) — the layout below
// is what GET /v1/analytics/summary, /v1/on-call and /v1/incidents (days
// 25, 33, 49) will fill with real numbers, so wiring them up later only
// touches this data-fetching layer, not the components.
// "Sep 29 – Oct 5, 2026": Monday to Sunday of the current week, the same
// seven days the chart below covers.
function thisWeekLabel() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const short = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${short(monday)} – ${short(sunday)}, ${sunday.getFullYear()}`;
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overview"
        description="What's on fire, who's covering it, and how fast your team is responding."
        action={
          <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-black/[0.08] px-3 text-sm text-zinc-700 dark:border-white/[0.08] dark:text-zinc-300">
            <CalendarDaysIcon className="size-4 text-zinc-400 dark:text-zinc-500" />
            {thisWeekLabel()}
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active alerts"
          value={dashboardStats.activeAlerts}
          icon={TriangleAlertIcon}
          tone="critical"
          trend={dashboardStats.trends.activeAlerts}
        />
        <StatCard
          label="Open incidents"
          value={dashboardStats.openIncidents}
          icon={CircleAlertIcon}
          tone="warning"
          trend={dashboardStats.trends.openIncidents}
        />
        <StatCard
          label="MTTA (7d)"
          value={dashboardStats.mtta}
          icon={TimerIcon}
          trend={dashboardStats.trends.mtta}
          target={{
            actualSeconds: dashboardStats.mttaSeconds,
            targetSeconds: MTTA_TARGET_SECONDS,
          }}
        />
        <StatCard
          label="MTTR (7d)"
          value={dashboardStats.mttr}
          icon={CheckCheckIcon}
          trend={dashboardStats.trends.mttr}
          target={{
            actualSeconds: dashboardStats.mttrSeconds,
            targetSeconds: MTTR_TARGET_SECONDS,
          }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <WeeklyIncidentsChart
          data={incidentsThisWeek}
          className="lg:col-span-2"
        />
        <OnCallPanel entries={onCallNow} />
      </div>

      <OpenIncidentsPanel incidents={openIncidents} />
    </div>
  );
}
