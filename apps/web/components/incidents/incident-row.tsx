"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/shared/severity-badge";
import { StatusDot } from "@/components/shared/status-dot";
import type { IncidentSummary } from "@/types/incident";

// One row of an incident list — used on the dashboard's open-incidents
// panel today, and meant to be the same row the real /incidents page
// (day 26) renders later, so styling only has to be decided once.
//
// The whole row is a link to the incident (via a click/keyboard handler on
// a plain div, not a real <a>, since it needs to contain real <button>s —
// nesting interactive elements inside an anchor is invalid HTML). That's a
// real tradeoff: middle-click / "open in new tab" won't work here the way
// it would on a normal link. Acceptable for now; worth a real <Link> with a
// stretched-overlay technique if that starts to matter.
export function IncidentRow({ incident }: { incident: IncidentSummary }) {
  const router = useRouter();

  const meta =
    incident.status === "RESOLVED"
      ? `resolved by ${incident.resolvedBy} · ${incident.timeAgo}`
      : incident.status === "ACKNOWLEDGED"
        ? `ack'd by ${incident.acknowledgedBy} · ${incident.timeAgo}`
        : incident.timeAgo;

  const href = `/incidents/${incident.number}`;
  const goToIncident = () => router.push(href);

  // Buttons stopPropagation so a click on them never reaches the row's own
  // handler. There's no real acknowledge/resolve endpoint yet (day 30), so
  // this stays UI-only — a toast confirms the click registered rather than
  // the button doing nothing at all.
  const handleAction = (action: "Acknowledge" | "Resolve") => (
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    toast.info(`${action} — wire this up once the API supports it.`);
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={goToIncident}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToIncident();
        }
      }}
      className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 px-(--card-spacing) py-3 outline-none transition-colors hover:bg-black/[0.02] focus-visible:bg-black/[0.02] focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:-outline-offset-2 dark:hover:bg-white/[0.02] dark:focus-visible:bg-white/[0.02]"
    >
      <StatusDot status={incident.status} />
      <span className="font-mono text-xs text-zinc-500">
        INC-{incident.number}
      </span>
      {/* Fixed-width column, not the badge's own natural size — "CRITICAL"
          and "HIGH" are different widths, and without this the title after
          it would start at a different x position on every row. */}
      <div className="w-20 shrink-0">
        <SeverityBadge severity={incident.severity} />
      </div>

      <div className="min-w-48 flex-1">
        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {incident.title}
        </p>
        <p className="truncate text-xs text-zinc-500">
          {incident.service ? `${incident.service} · ` : ""}
          {meta}
        </p>
      </div>

      {incident.status !== "RESOLVED" && (
        <div className="flex shrink-0 gap-2">
          {incident.status === "TRIGGERED" && (
            <Button size="sm" variant="brand" onClick={handleAction("Acknowledge")}>
              Acknowledge
            </Button>
          )}
          <Button
            size="sm"
            variant={incident.status === "ACKNOWLEDGED" ? "brand" : "outline"}
            onClick={handleAction("Resolve")}
          >
            Resolve
          </Button>
        </div>
      )}
    </div>
  );
}
