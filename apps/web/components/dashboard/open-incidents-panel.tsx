import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
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
        <CardTitle>Open incidents</CardTitle>
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
        <p className="px-(--card-spacing) pb-1 text-sm text-zinc-500 dark:text-zinc-400">
          Nothing open. A triggered alert will show up here the moment it
          arrives.
        </p>
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
