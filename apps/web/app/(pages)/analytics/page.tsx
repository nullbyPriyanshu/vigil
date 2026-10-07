"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRightIcon,
  BarChart3Icon,
  CheckCheckIcon,
  SirenIcon,
  TimerIcon,
} from "lucide-react";

import { StatCard } from "@/components/dashboard/stat-card";
import { TargetBar } from "@/components/dashboard/target-bar";
import { IncidentsChart } from "@/components/dashboard/incidents-chart";
import { PageHeader } from "@/components/shared/page-header";
import { LoadError } from "@/components/shared/load-error";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getAnalyticsByServiceApi,
  getAnalyticsSummaryApi,
  getIncidentsOverTimeApi,
  type AnalyticsDays,
} from "@/lib/api/analytics";
import { MTTA_TARGET_SECONDS, MTTR_TARGET_SECONDS } from "@/lib/constants";
import { formatSeconds } from "@/lib/duration";

const RANGE_ITEMS = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];

const SEVERITIES = [
  { key: "CRITICAL", label: "Critical", bar: "bg-red-500" },
  { key: "HIGH", label: "High", bar: "bg-amber-500" },
  { key: "LOW", label: "Low", bar: "bg-slate-400" },
] as const;

export default function AnalyticsPage() {
  const [days, setDays] = useState<AnalyticsDays>(30);

  const {
    data: summary,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["analytics", "summary", days],
    queryFn: async () => (await getAnalyticsSummaryApi(days)).data,
  });
  const { data: series } = useQuery({
    queryKey: ["analytics", "over-time", days],
    queryFn: async () => (await getIncidentsOverTimeApi(days)).data.series,
  });
  const { data: services } = useQuery({
    queryKey: ["analytics", "by-service", days],
    queryFn: async () => (await getAnalyticsByServiceApi(days)).data.data,
  });

  const loaded = summary && series && services;
  // The longest bar in each list fills the row; the rest are relative to it.
  const busiest = Math.max(...(services ?? []).map((s) => s.count), 1);
  const mostSevere = summary
    ? Math.max(...Object.values(summary.bySeverity), 1)
    : 1;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={BarChart3Icon}
        title="Analytics"
        description="How many incidents you get, and how fast they're picked up and fixed."
        action={
          <Select
            items={RANGE_ITEMS}
            value={days}
            onValueChange={(value) => setDays(value as AnalyticsDays)}
          >
            <SelectTrigger aria-label="Period" className="min-w-40 data-[size=default]:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {RANGE_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {isError && !summary ? (
        <LoadError what="the analytics" onRetry={() => refetch()} />
      ) : !loaded ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Incidents"
              value={summary.totalIncidents}
              icon={SirenIcon}
            />
            <StatCard
              label="Time to acknowledge"
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
              label="Time to resolve"
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
            <StatCard
              label="Escalated past step 1"
              value={`${Math.round(summary.escalationRate * 100)}%`}
              icon={ArrowUpRightIcon}
            />
          </div>

          <IncidentsChart data={series} />

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card>
              <CardHeader>
                <CardTitle>By service</CardTitle>
              </CardHeader>
              <CardContent>
                {services.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No services yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[30rem] text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground">
                          <th className="pb-2 font-medium">Service</th>
                          <th className="w-2/5 pb-2 font-medium">Incidents</th>
                          <th className="pb-2 text-right font-medium">
                            Acknowledge
                          </th>
                          <th className="pb-2 text-right font-medium">Resolve</th>
                        </tr>
                      </thead>
                      <tbody>
                        {services.map((row) => (
                          <tr
                            key={row.service.id}
                            className="border-t border-black/[0.06] dark:border-white/[0.06]"
                          >
                            <td className="max-w-40 truncate py-2.5 pr-4">
                              <Link
                                href={`/services/${row.service.id}`}
                                className="text-foreground hover:underline hover:underline-offset-4"
                              >
                                {row.service.name}
                              </Link>
                            </td>
                            <td className="py-2.5 pr-4">
                              <div className="flex items-center gap-2.5">
                                <div className="h-2 flex-1 rounded-full bg-black/[0.05] dark:bg-white/[0.06]">
                                  <div
                                    className="h-2 rounded-full bg-emerald-500 dark:bg-emerald-400"
                                    style={{
                                      width: `${(row.count / busiest) * 100}%`,
                                    }}
                                  />
                                </div>
                                <span className="w-6 text-right text-foreground tabular-nums">
                                  {row.count}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 text-right text-muted-foreground tabular-nums">
                              {formatSeconds(row.mttaSeconds)}
                            </td>
                            <td className="py-2.5 text-right text-muted-foreground tabular-nums">
                              {formatSeconds(row.mttrSeconds)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>By severity</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3.5">
                  {SEVERITIES.map((severity) => {
                    const count = summary.bySeverity[severity.key];
                    return (
                      <li key={severity.key} className="text-sm">
                        <div className="flex items-baseline justify-between gap-4">
                          <span className="text-foreground">{severity.label}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {count}
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 rounded-full bg-black/[0.05] dark:bg-white/[0.06]">
                          <div
                            className={`h-2 rounded-full ${severity.bar}`}
                            style={{ width: `${(count / mostSevere) * 100}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-5 border-t border-black/[0.06] pt-4 text-sm text-muted-foreground dark:border-white/[0.06]">
                  Open right now: {summary.openTriggered} triggered,{" "}
                  {summary.openAcknowledged} acknowledged.
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
