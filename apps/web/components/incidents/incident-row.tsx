"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { SeverityBadge } from "@/components/shared/severity-badge";
import { StatusDot } from "@/components/shared/status-dot";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  acknowledgeIncidentApi,
  resolveIncidentApi,
  type IncidentRow as Incident,
} from "@/lib/api/incidents";
import { formatDateTime, timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

// Rows this new get a brief highlight, so an incident that just arrived
// catches the eye.
const NEW_FOR_MS = 15 * 1000;

// One incident in a list: the dashboard's open incidents and the incidents
// page both use it. The whole row opens the incident (a click handler on a
// div rather than a real <a>, because it contains real buttons, and buttons
// inside a link are invalid HTML).
export function IncidentRow({
  incident,
  canRespond,
}: {
  incident: Incident;
  canRespond: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  // When this row first appeared on screen.
  const [shownAt] = useState(() => Date.now());

  const goToIncident = () => router.push(`/incidents/${incident.number}`);

  const mutation = useMutation({
    mutationFn: (action: "acknowledge" | "resolve") =>
      action === "acknowledge"
        ? acknowledgeIncidentApi(incident.id)
        : resolveIncidentApi(incident.id),
    onSuccess: (_, action) => {
      toast.success(
        `INC-${incident.number} ${action === "acknowledge" ? "acknowledged" : "resolved"}`,
      );
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "That didn't work.");
      // 409: someone else got there first, which isn't really an error.
      if (isAxiosError(error) && error.response?.status === 409) {
        toast.info(message);
      } else {
        toast.error(message);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });

  // Stops the click from also opening the incident.
  const act = (action: "acknowledge" | "resolve") => (e: React.MouseEvent) => {
    e.stopPropagation();
    mutation.mutate(action);
  };

  let detail = `step ${Math.max(incident.currentStepPosition, 1)} of ${incident.totalSteps}`;
  if (incident.status === "ACKNOWLEDGED") {
    detail = incident.acknowledgedBy
      ? `ack'd by ${incident.acknowledgedBy.name}`
      : "acknowledged";
  }
  if (incident.status === "RESOLVED") {
    detail = incident.resolvedBy
      ? `resolved by ${incident.resolvedBy.name}`
      : "resolved automatically";
  }

  const alerts = `${incident.alertCount} ${incident.alertCount === 1 ? "alert" : "alerts"}`;
  const open = incident.status !== "RESOLVED";
  const isNew =
    incident.status === "TRIGGERED" &&
    shownAt - new Date(incident.createdAt).getTime() < NEW_FOR_MS;

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
      className={cn(
        "flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 px-(--card-spacing) py-3 outline-none transition-colors hover:bg-black/[0.02] focus-visible:bg-black/[0.02] focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:-outline-offset-2 dark:hover:bg-white/[0.02] dark:focus-visible:bg-white/[0.02]",
        isNew && "animate-row-flash",
      )}
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
        <p
          className={cn(
            "truncate text-sm font-medium",
            open
              ? "text-zinc-900 dark:text-zinc-100"
              : "text-zinc-500 dark:text-zinc-400",
          )}
        >
          {incident.title}
        </p>
        <p className="truncate text-xs text-zinc-500">
          {incident.service.name} · {detail} · {alerts}
        </p>
      </div>

      {/* Relative at a glance; the exact time on hover. */}
      <time
        dateTime={incident.createdAt}
        title={formatDateTime(incident.createdAt)}
        className="shrink-0 text-xs text-zinc-500 tabular-nums"
      >
        {timeAgo(incident.createdAt)}
      </time>

      {canRespond && open && (
        <div className="flex shrink-0 gap-2">
          {incident.status === "TRIGGERED" && (
            <Button
              size="sm"
              variant="brand"
              disabled={mutation.isPending}
              onClick={act("acknowledge")}
            >
              Acknowledge
            </Button>
          )}
          <Button
            size="sm"
            variant={incident.status === "ACKNOWLEDGED" ? "brand" : "outline"}
            disabled={mutation.isPending}
            onClick={act("resolve")}
          >
            Resolve
          </Button>
        </div>
      )}
    </div>
  );
}
