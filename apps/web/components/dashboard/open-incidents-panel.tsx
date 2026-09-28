import {
  Card,
  CardAction,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IncidentRow } from "@/components/dashboard/incident-row";
import type { IncidentSummary } from "@/types/incident";

// The "live" pill is decorative until day 46/47 wire up the WebSocket feed
// that actually makes this list update itself; kept here now so the visual
// design doesn't have to change when the real feed lands.
function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full rounded-full bg-emerald-400/70 motion-safe:animate-ping" />
        <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
      </span>
      live
    </span>
  );
}

export function OpenIncidentsPanel({
  incidents,
}: {
  incidents: IncidentSummary[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Open Incidents List</CardTitle>
        <CardAction>
          <LiveBadge />
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
            <IncidentRow key={incident.id} incident={incident} />
          ))}
        </div>
      )}
    </Card>
  );
}
