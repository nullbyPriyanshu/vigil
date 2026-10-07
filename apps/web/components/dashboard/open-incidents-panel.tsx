import Link from "next/link";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import {
  Card,
  CardAction,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IncidentRow } from "@/components/incidents/incident-row";
import { LiveBadge } from "@/components/incidents/live-badge";
import type { IncidentRow as Incident } from "@/lib/api/incidents";

export function OpenIncidentsPanel({
  incidents,
  canRespond,
}: {
  incidents: Incident[];
  canRespond: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs attention</CardTitle>
        <CardAction className="flex items-center gap-3">
          <LiveBadge />
          <Link
            href="/incidents"
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            View all
            <ArrowRightIcon className="size-3" />
          </Link>
        </CardAction>
      </CardHeader>

      {incidents.length === 0 ? (
        <div className="flex flex-col items-center px-(--card-spacing) py-8 text-center">
          <CheckIcon className="size-5 text-zinc-400" />
          <p className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            All clear
          </p>
          <p className="mt-1 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
            Nothing is open. A new incident shows up here the moment an
            alert arrives.
          </p>
          <Link href="/services" className="mt-3 inline-flex items-center gap-1 rounded-md text-sm font-medium text-zinc-900 underline decoration-black/20 underline-offset-4 outline-none hover:decoration-black/60 focus-visible:ring-2 focus-visible:ring-emerald-400/60 dark:text-zinc-100 dark:decoration-white/25 dark:hover:decoration-white/70">
            Send a test alert from a service
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
          {incidents.map((incident) => (
            <IncidentRow
              key={incident.id}
              incident={incident}
              canRespond={canRespond}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
