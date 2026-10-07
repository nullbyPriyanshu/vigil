"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightIcon } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getServicesApi } from "@/lib/api/services";

// Every service with a dot: green when nothing is open, red when it has
// incidents. Services with problems come first.
export function ServiceHealth() {
  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: async () => (await getServicesApi()).data.data,
  });

  const sorted = [...(services ?? [])].sort(
    (a, b) => b.openIncidentCount - a.openIncidentCount,
  );
  const healthy = sorted.filter((s) => s.openIncidentCount === 0).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service health</CardTitle>
        <CardAction className="flex items-center gap-3">
          {services && services.length > 0 && (
            <span className="text-xs text-zinc-500 tabular-nums">
              {healthy} of {services.length} healthy
            </span>
          )}
          <Link
            href="/services"
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            View all
            <ArrowRightIcon className="size-3" />
          </Link>
        </CardAction>
      </CardHeader>

      {!services ? (
        <CardContent>
          <div className="h-24 animate-pulse rounded-lg bg-black/[0.04] dark:bg-white/[0.04]" />
        </CardContent>
      ) : services.length === 0 ? (
        <CardContent>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No services yet. A service is something that can break, like an
            API or a database.
          </p>
          <Link href="/services" className="mt-3 inline-flex items-center gap-1 rounded-md text-sm font-medium text-zinc-900 underline decoration-black/20 underline-offset-4 outline-none hover:decoration-black/60 focus-visible:ring-2 focus-visible:ring-emerald-400/60 dark:text-zinc-100 dark:decoration-white/25 dark:hover:decoration-white/70">
            Add a service
          </Link>
        </CardContent>
      ) : (
        <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
          {sorted.slice(0, 7).map((service) => (
            <li key={service.id}>
              <Link
                href={`/services/${service.id}`}
                className="flex items-center gap-3 px-(--card-spacing) py-2.5 transition-colors outline-none hover:bg-black/[0.02] focus-visible:bg-black/[0.03] dark:hover:bg-white/[0.02] dark:focus-visible:bg-white/[0.03]"
              >
                <span
                  className={`size-2 shrink-0 rounded-full ${service.openIncidentCount > 0 ? "bg-red-500" : "bg-emerald-500"}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-zinc-900 dark:text-zinc-100">
                    {service.name}
                  </span>
                  <span className="block truncate text-xs text-zinc-500">
                    {service.team.name}
                  </span>
                </span>
                <span
                  className={
                    service.openIncidentCount > 0
                      ? "shrink-0 text-xs font-medium text-red-600 dark:text-red-400"
                      : "shrink-0 text-xs text-zinc-500"
                  }
                >
                  {service.openIncidentCount > 0
                    ? `${service.openIncidentCount} open`
                    : "Operational"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
