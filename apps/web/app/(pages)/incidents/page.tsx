"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SirenIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SeverityBadge } from "@/components/shared/severity-badge";
import { StatusDot } from "@/components/shared/status-dot";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getIncidentsApi, type IncidentRow } from "@/lib/api/incidents";
import { getServicesApi } from "@/lib/api/services";
import { timeAgo } from "@/lib/time";
import type { IncidentStatus, Severity } from "@/types/incident";

const PAGE_SIZE = 25;

// "ALL" stands for "no filter"; it is never sent to the API.
const STATUS_ITEMS = [
  { value: "ALL", label: "Any status" },
  { value: "TRIGGERED", label: "Triggered" },
  { value: "ACKNOWLEDGED", label: "Acknowledged" },
  { value: "RESOLVED", label: "Resolved" },
];

const SEVERITY_ITEMS = [
  { value: "ALL", label: "Any severity" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "LOW", label: "Low" },
];

export default function IncidentsPage() {
  const [status, setStatus] = useState("ALL");
  const [severity, setSeverity] = useState("ALL");
  const [service, setService] = useState("ALL");
  const [page, setPage] = useState(1);

  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: async () => (await getServicesApi()).data.data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["incidents", { status, severity, service, page }],
    queryFn: async () =>
      (
        await getIncidentsApi({
          status: status === "ALL" ? undefined : (status as IncidentStatus),
          severity: severity === "ALL" ? undefined : (severity as Severity),
          service: service === "ALL" ? undefined : service,
          page,
          pageSize: PAGE_SIZE,
        })
      ).data,
    // Keep showing the current rows while the next page or filter loads.
    placeholderData: keepPreviousData,
    // There's no live connection yet, so ask again every 15 seconds.
    refetchInterval: 15 * 1000,
    staleTime: 0,
  });

  const serviceItems = [
    { value: "ALL", label: "Any service" },
    ...(services ?? []).map((s) => ({ value: s.id, label: s.name })),
  ];

  const filtered = status !== "ALL" || severity !== "ALL" || service !== "ALL";

  // Changing a filter goes back to the first page.
  const changeFilter = (set: (value: string) => void) => (value: unknown) => {
    set(value as string);
    setPage(1);
  };

  const clearFilters = () => {
    setStatus("ALL");
    setSeverity("ALL");
    setService("ALL");
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Incidents"
        description="Every problem your services have reported, newest first."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Filter
          label="Status"
          items={STATUS_ITEMS}
          value={status}
          onChange={changeFilter(setStatus)}
        />
        <Filter
          label="Severity"
          items={SEVERITY_ITEMS}
          value={severity}
          onChange={changeFilter(setSeverity)}
        />
        <Filter
          label="Service"
          items={serviceItems}
          value={service}
          onChange={changeFilter(setService)}
        />
        {filtered && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear
          </Button>
        )}
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : data.data.length === 0 ? (
        <EmptyState
          icon={SirenIcon}
          title={filtered ? "No incidents match these filters" : "No incidents yet"}
          description={
            filtered
              ? "Try a different status, severity or service."
              : "When a service sends an alert, the incident shows up here. Create an API key on a service to start sending."
          }
          action={
            filtered ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="gap-0 py-0">
          <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
            {data.data.map((incident) => (
              <li key={incident.id}>
                <IncidentListRow incident={incident} />
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between gap-4 border-t border-black/[0.06] px-(--card-spacing) py-3 dark:border-white/[0.06]">
            <p className="text-sm text-muted-foreground tabular-nums">
              {(data.meta.page - 1) * data.meta.pageSize + 1}–
              {(data.meta.page - 1) * data.meta.pageSize + data.data.length} of{" "}
              {data.meta.total}
            </p>
            {data.meta.totalPages > 1 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.meta.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function Filter({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: { value: string; label: string }[];
  value: string;
  onChange: (value: unknown) => void;
}) {
  return (
    <Select items={items} value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="min-w-36 data-[size=default]:h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} className="max-h-72">
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function IncidentListRow({ incident }: { incident: IncidentRow }) {
  // What happened to it last, in a few words.
  const state =
    incident.status === "RESOLVED"
      ? `Resolved${incident.resolvedBy ? ` by ${incident.resolvedBy.name}` : ""}`
      : incident.status === "ACKNOWLEDGED"
        ? `Acknowledged${incident.acknowledgedBy ? ` by ${incident.acknowledgedBy.name}` : ""}`
        : "Waiting for someone to acknowledge";

  return (
    <Link
      href={`/incidents/${incident.number}`}
      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-(--card-spacing) py-3 transition-colors outline-none hover:bg-black/[0.02] focus-visible:bg-black/[0.03] dark:hover:bg-white/[0.02] dark:focus-visible:bg-white/[0.03]"
    >
      <StatusDot status={incident.status} />
      <span className="w-16 shrink-0 font-mono text-xs text-zinc-500">
        INC-{incident.number}
      </span>
      {/* Fixed width so every title starts at the same place. */}
      <div className="w-20 shrink-0">
        <SeverityBadge severity={incident.severity} />
      </div>

      <div className="min-w-48 flex-1">
        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {incident.title}
        </p>
        <p className="truncate text-xs text-zinc-500">
          {incident.service.name} · {state}
        </p>
      </div>

      <span className="hidden w-20 shrink-0 text-right text-sm text-muted-foreground tabular-nums md:block">
        {incident.alertCount} {incident.alertCount === 1 ? "alert" : "alerts"}
      </span>
      <span className="w-16 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
        {timeAgo(incident.createdAt)}
      </span>
    </Link>
  );
}
