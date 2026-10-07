"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SirenIcon } from "lucide-react";

import { IncidentRow } from "@/components/incidents/incident-row";
import { LiveBadge } from "@/components/incidents/live-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadError } from "@/components/shared/load-error";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
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
import { useAuth } from "@/context/auth-context";
import { getIncidentsApi } from "@/lib/api/incidents";
import { getServicesApi } from "@/lib/api/services";
import { cn } from "@/lib/utils";
import type { IncidentStatus, Severity } from "@/types/incident";

const PAGE_SIZE = 25;

const STATUS_TABS = [
  { value: "ALL", label: "All" },
  { value: "TRIGGERED", label: "Triggered" },
  { value: "ACKNOWLEDGED", label: "Acknowledged" },
  { value: "RESOLVED", label: "Resolved" },
];

// "ALL" stands for "no filter"; it is never sent to the API.
const SEVERITY_ITEMS = [
  { value: "ALL", label: "Any severity" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "LOW", label: "Low" },
];

// useSearchParams needs a Suspense boundary above it.
export default function IncidentsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Incidents />
    </Suspense>
  );
}

function Incidents() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { session } = useAuth();

  // The filters live in the address (?status=TRIGGERED&page=2), so a reload
  // or a shared link shows the same list.
  const status = params.get("status") ?? "ALL";
  const severity = params.get("severity") ?? "ALL";
  const service = params.get("service") ?? "ALL";
  const page = Number(params.get("page") ?? "1") || 1;

  const setParams = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === "ALL" || value === "1") next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  // Changing a filter goes back to the first page.
  const setFilter = (key: string) => (value: unknown) =>
    setParams({ [key]: value as string, page: "1" });

  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: async () => (await getServicesApi()).data.data,
  });

  const { data, isLoading, isError, refetch } = useQuery({
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
    // Live updates reload this list; the timer is only a safety net.
    refetchInterval: 60 * 1000,
    staleTime: 0,
  });

  const serviceItems = [
    { value: "ALL", label: "Any service" },
    ...(services ?? []).map((s) => ({ value: s.id, label: s.name })),
  ];

  const filtered = status !== "ALL" || severity !== "ALL" || service !== "ALL";
  const canRespond = !!session && session.role !== "VIEWER";
  const clearFilters = () => router.replace(pathname, { scroll: false });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Incidents"
        description="Every problem your services have reported, newest first."
        action={<LiveBadge />}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Status"
          className="flex max-w-full overflow-x-auto rounded-lg border border-black/[0.08] p-0.5 dark:border-white/[0.08]"
        >
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              aria-selected={status === tab.value}
              onClick={() => setFilter("status")(tab.value)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60",
                status === tab.value
                  ? "bg-black/[0.06] font-medium text-foreground dark:bg-white/[0.08]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Filter
            label="Severity"
            items={SEVERITY_ITEMS}
            value={severity}
            onChange={setFilter("severity")}
          />
          <Filter
            label="Service"
            items={serviceItems}
            value={service}
            onChange={setFilter("service")}
          />
        </div>
      </div>

      {isError && !data ? (
        <LoadError what="the incidents" onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : data.data.length === 0 ? (
        <EmptyState
          icon={SirenIcon}
          title={filtered ? "No incidents match these filters" : "No incidents yet"}
          description={
            filtered
              ? "Try a different status, severity or service."
              : "When a service sends an alert, the incident shows up here. Open a service and press Send a test alert to try it."
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
          <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
            {data.data.map((incident) => (
              <IncidentRow
                key={incident.id}
                incident={incident}
                canRespond={canRespond}
              />
            ))}
          </div>

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
                  onClick={() => setParams({ page: String(page - 1) })}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.meta.totalPages}
                  onClick={() => setParams({ page: String(page + 1) })}
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
