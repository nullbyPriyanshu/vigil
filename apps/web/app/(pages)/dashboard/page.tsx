import {
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
export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overview"
        description="What's on fire, who's covering it, and how fast your team is responding."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Alerts"
          value={dashboardStats.activeAlerts}
          icon={TriangleAlertIcon}
          tone="critical"
        />
        <StatCard
          label="Open Incidents"
          value={dashboardStats.openIncidents}
          icon={CircleAlertIcon}
          tone="warning"
        />
        <StatCard
          label="MTTA (7d)"
          value={dashboardStats.mtta}
          icon={TimerIcon}
          target={{
            actualSeconds: dashboardStats.mttaSeconds,
            targetSeconds: MTTA_TARGET_SECONDS,
          }}
        />
        <StatCard
          label="MTTR (7d)"
          value={dashboardStats.mttr}
          icon={CheckCheckIcon}
          target={{
            actualSeconds: dashboardStats.mttrSeconds,
            targetSeconds: MTTR_TARGET_SECONDS,
          }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <OnCallPanel entries={onCallNow} />
        <WeeklyIncidentsChart data={incidentsThisWeek} />
      </div>

      <OpenIncidentsPanel incidents={openIncidents} />
    </div>
  );
}
