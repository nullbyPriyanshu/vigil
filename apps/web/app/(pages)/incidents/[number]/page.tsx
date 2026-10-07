"use client";

import { use, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeftIcon, Loader2 } from "lucide-react";

import { EscalationCountdown } from "@/components/incidents/escalation-countdown";
import { IncidentAlerts } from "@/components/incidents/incident-alerts";
import { IncidentTimeline } from "@/components/incidents/incident-timeline";
import { ResolveIncidentDialog } from "@/components/incidents/resolve-incident-dialog";
import { StatusLabel } from "@/components/incidents/status-label";
import { SeverityBadge } from "@/components/shared/severity-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  acknowledgeIncidentApi,
  getIncidentApi,
  resolveIncidentApi,
  type Incident,
} from "@/lib/api/incidents";
import { formatMinutes, formatRepeat } from "@/lib/duration";
import { formatDateTime } from "@/lib/time";

const linkClass =
  "rounded-sm text-foreground underline decoration-black/20 underline-offset-4 outline-none hover:decoration-black/60 focus-visible:ring-2 focus-visible:ring-emerald-400/60 dark:decoration-white/25 dark:hover:decoration-white/70";

export default function IncidentPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number: numberParam } = use(params);
  const number = Number(numberParam);
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [resolving, setResolving] = useState(false);

  const { data: incident, error, isLoading, refetch } = useQuery({
    queryKey: ["incident", number],
    queryFn: async () => (await getIncidentApi(number)).data,
    enabled: Number.isInteger(number),
    retry: false,
    // Live updates reload an incident when it changes; the timer is only
    // a safety net while it's still open.
    refetchInterval: (query) =>
      query.state.data && query.state.data.status !== "RESOLVED"
        ? 30 * 1000
        : false,
    staleTime: 0,
  });

  // Viewers can read incidents but not act on them.
  const canRespond = !!session && session.role !== "VIEWER";

  // After acknowledge or resolve, win or lose, show the incident as it is now.
  const refresh = (updated?: Incident) => {
    if (updated) queryClient.setQueryData(["incident", number], updated);
    else queryClient.invalidateQueries({ queryKey: ["incident", number] });
    queryClient.invalidateQueries({ queryKey: ["incident-events"] });
    queryClient.invalidateQueries({ queryKey: ["incidents"] });
  };

  // A 409 means someone else got there first. The API says who.
  const onActionError = (fallback: string) => (err: unknown) => {
    const message = getApiErrorMessage(err, fallback);
    if (isAxiosError(err) && err.response?.status === 409) {
      toast.info(message);
      refresh();
    } else {
      toast.error(message);
    }
  };

  const acknowledge = useMutation({
    mutationFn: async () =>
      (await acknowledgeIncidentApi(incident!.id)).data.incident,
    onSuccess: (updated) => {
      refresh(updated);
      toast.success(`INC-${updated.number} acknowledged`);
    },
    onError: onActionError("Couldn't acknowledge the incident."),
  });

  const resolve = useMutation({
    mutationFn: async (note?: string) =>
      (await resolveIncidentApi(incident!.id, note)).data.incident,
    onSuccess: (updated) => {
      refresh(updated);
      setResolving(false);
      toast.success(`INC-${updated.number} resolved`);
    },
    onError: (err) => {
      setResolving(false);
      onActionError("Couldn't resolve the incident.")(err);
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-80" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!incident) {
    const status = isAxiosError(error) ? error.response?.status : undefined;
    const missing = !error || status === 404 || status === 400;
    return (
      <div className="flex flex-col gap-6">
        <BackToIncidents />
        <div className="rounded-xl border border-dashed border-black/15 px-6 py-16 text-center dark:border-white/15">
          <p className="text-sm font-medium text-foreground">
            {missing ? "Incident not found" : "Couldn't load this incident"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {missing
              ? "There's no incident with that number here."
              : "Please try again in a moment."}
          </p>
          {!missing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="mt-4"
            >
              Try again
            </Button>
          )}
        </div>
      </div>
    );
  }

  const { escalation } = incident;

  // What the countdown is counting down to.
  const following = escalation.steps.find(
    (step) => step.position === escalation.currentStepPosition + 1,
  );
  let nextStepText = "the policy ends";
  if (following) {
    nextStepText = `it escalates to ${following.targetName}`;
  } else if (escalation.round < escalation.repeatCount) {
    nextStepText = `it starts again with ${escalation.steps[0]?.targetName ?? "step 1"}`;
  }
  const open = incident.status !== "RESOLVED";

  return (
    <div className="flex flex-col gap-6">
      <BackToIncidents />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-sm text-zinc-500">
              INC-{incident.number}
            </span>
            <StatusLabel status={incident.status} />
            <SeverityBadge severity={incident.severity} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight break-words text-zinc-900 dark:text-zinc-100">
            {incident.title}
          </h1>
          {incident.description && (
            <p className="max-w-2xl text-sm break-words text-zinc-500 dark:text-zinc-400">
              {incident.description}
            </p>
          )}
        </div>

        {canRespond && open && (
          <div className="flex shrink-0 gap-2">
            {incident.status === "TRIGGERED" && (
              <Button
                variant="brand"
                disabled={acknowledge.isPending}
                onClick={() => acknowledge.mutate()}
                className="h-9 px-3.5"
              >
                {acknowledge.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Acknowledge
              </Button>
            )}
            <Button
              variant={incident.status === "ACKNOWLEDGED" ? "brand" : "outline"}
              onClick={() => setResolving(true)}
              className="h-9 px-3.5"
            >
              Resolve
            </Button>
          </div>
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <IncidentTimeline
            incidentId={incident.id}
            canRespond={canRespond}
            live={open}
          />
          <IncidentAlerts
            incidentId={incident.id}
            alertCount={incident.alertCount}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3.5 text-sm">
                <Detail label="Service">
                  <Link href={`/services/${incident.service.id}`} className={linkClass}>
                    {incident.service.name}
                  </Link>
                </Detail>
                <Detail label="Team">
                  <Link href={`/teams/${incident.team.id}`} className={linkClass}>
                    {incident.team.name}
                  </Link>
                </Detail>
                <Detail label="Started">{formatDateTime(incident.createdAt)}</Detail>
                <Detail label="Last alert">
                  {formatDateTime(incident.lastAlertAt)}
                </Detail>
                {incident.acknowledgedAt && (
                  <Detail label="Acknowledged">
                    {incident.acknowledgedBy
                      ? `${incident.acknowledgedBy.name}, `
                      : ""}
                    {formatDateTime(incident.acknowledgedAt)}
                  </Detail>
                )}
                {incident.resolvedAt && (
                  <Detail label="Resolved">
                    {incident.resolvedBy ? `${incident.resolvedBy.name}, ` : ""}
                    {formatDateTime(incident.resolvedAt)}
                  </Detail>
                )}
                {incident.dedupKey && (
                  <Detail label="Dedup key">
                    <span className="font-mono text-xs">{incident.dedupKey}</span>
                  </Detail>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Escalation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Follows{" "}
                <Link
                  href={`/policies/${escalation.policy.id}`}
                  className={linkClass}
                >
                  {escalation.policy.name}
                </Link>
                {" · "}
                {formatRepeat(escalation.repeatCount)}
              </p>
              <ol className="mt-4 space-y-3">
                {escalation.steps.map((step) => (
                  <li key={step.position} className="flex gap-3 text-sm">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-black/10 text-xs font-medium tabular-nums dark:border-white/15">
                      {step.position}
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="truncate text-foreground">
                        {step.targetName}
                        {open &&
                          incident.status === "TRIGGERED" &&
                          step.position === escalation.currentStepPosition && (
                            <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                              Current
                            </span>
                          )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {step.notifiedUsers.length > 0
                          ? `Notified ${step.notifiedUsers.map((u) => u.name).join(", ")}`
                          : `Waits ${formatMinutes(step.delayMinutes)} for a response`}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              {incident.status === "TRIGGERED" &&
                escalation.nextEscalationAt && (
                  <EscalationCountdown
                    nextEscalationAt={escalation.nextEscalationAt}
                    next={nextStepText}
                  />
                )}
            </CardContent>
          </Card>
        </div>
      </div>

      {resolving && (
        <ResolveIncidentDialog
          number={incident.number}
          pending={resolve.isPending}
          onResolve={(note) => resolve.mutate(note)}
          onClose={() => setResolving(false)}
        />
      )}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right text-foreground">{children}</dd>
    </div>
  );
}

function BackToIncidents() {
  return (
    <Link
      href="/incidents"
      className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-emerald-400/60"
    >
      <ArrowLeftIcon className="size-3.5" />
      Incidents
    </Link>
  );
}
