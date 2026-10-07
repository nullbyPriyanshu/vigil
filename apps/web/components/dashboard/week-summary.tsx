import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { IncidentsLine } from "@/components/dashboard/incidents-chart";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AnalyticsSummary } from "@/lib/api/analytics";
import { formatSeconds } from "@/lib/duration";

const SEVERITIES = [
  { key: "CRITICAL", label: "Critical", color: "bg-red-500" },
  { key: "HIGH", label: "High", color: "bg-amber-500" },
  { key: "LOW", label: "Low", color: "bg-zinc-400 dark:bg-zinc-500" },
] as const;

// The last seven days: the headline numbers, the daily line, and how the
// incidents split by severity. The longer view lives on the Analytics page.
export function WeekSummary({ summary }: { summary: AnalyticsSummary }) {
  const figures = [
    { label: "Incidents", value: String(summary.totalIncidents) },
    { label: "Time to acknowledge", value: formatSeconds(summary.mttaSeconds) },
    { label: "Time to resolve", value: formatSeconds(summary.mttrSeconds) },
    { label: "Escalated", value: `${Math.round(summary.escalationRate * 100)}%` },
  ];
  const total = summary.totalIncidents;

  return (
    <Card>
      <CardHeader>
        <CardTitle>This week</CardTitle>
        <CardAction>
          <Link
            href="/analytics"
            className="inline-flex items-center gap-1 rounded-md text-xs text-zinc-500 transition-colors outline-none hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-emerald-400/60 dark:hover:text-zinc-100"
          >
            Analytics
            <ArrowRightIcon className="size-3" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          {figures.map((figure) => (
            <div key={figure.label}>
              <dd className="text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-50">
                {figure.value}
              </dd>
              <dt className="mt-0.5 text-xs text-zinc-500">{figure.label}</dt>
            </div>
          ))}
        </dl>

        <IncidentsLine data={summary.incidentsByDay} height={150} />

        {total > 0 && (
          <div>
            {/* One bar, cut into the three severities. */}
            <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
              {SEVERITIES.map(({ key, color }) =>
                summary.bySeverity[key] === 0 ? null : (
                  <span
                    key={key}
                    className={color}
                    style={{ width: `${(summary.bySeverity[key] / total) * 100}%` }}
                  />
                ),
              )}
            </div>
            <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-500">
              {SEVERITIES.map(({ key, label, color }) => (
                <li key={key} className="flex items-center gap-1.5">
                  <span aria-hidden className={`size-2 rounded-sm ${color}`} />
                  {label}
                  <span className="text-zinc-900 tabular-nums dark:text-zinc-100">
                    {summary.bySeverity[key]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
