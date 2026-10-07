"use client";

import { use, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeftIcon, Loader2, PencilIcon, SendIcon } from "lucide-react";

import { ApiKeysCard } from "@/components/services/api-keys-card";
import { ServiceFormDialog } from "@/components/services/service-form-dialog";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  deleteServiceApi,
  getServiceApi,
  sendTestAlertApi,
} from "@/lib/api/services";
import { formatMinutes } from "@/lib/duration";
import { formatDate, timeAgo } from "@/lib/time";
import { canManageMembers } from "@/lib/roles";

type OpenDialog = "edit" | "delete" | null;

const linkClass =
  "rounded-sm text-foreground underline decoration-black/20 underline-offset-4 outline-none hover:decoration-black/60 focus-visible:ring-2 focus-visible:ring-emerald-400/60 dark:decoration-white/25 dark:hover:decoration-white/70";

export default function ServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [dialog, setDialog] = useState<OpenDialog>(null);

  const { data: service, error, isLoading, refetch } = useQuery({
    queryKey: ["service", id],
    queryFn: async () => (await getServiceApi(id)).data,
    retry: false,
  });

  const canManage = canManageMembers(session?.role);
  const canRespond = !!session && session.role !== "VIEWER";

  // Fires a real alert at this service, exactly as a monitoring tool would.
  const testAlert = useMutation({
    mutationFn: async () => (await sendTestAlertApi(id)).data,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["service", id] });
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      toast.success(
        result.deduplicated
          ? `Test alert joined INC-${result.incidentNumber}`
          : `Test alert opened INC-${result.incidentNumber}`,
        {
          description: result.deduplicated
            ? "It's already open, so nobody is emailed again."
            : "Whoever is first on the escalation policy gets an email now.",
          action: {
            label: "Open",
            onClick: () => router.push(`/incidents/${result.incidentNumber}`),
          },
        },
      );
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Couldn't send the test alert."));
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  if (!service) {
    const status = isAxiosError(error) ? error.response?.status : undefined;
    const missing = status === 404 || status === 400;
    return (
      <div className="flex flex-col gap-6">
        <BackToServices />
        <div className="rounded-xl border border-dashed border-black/15 px-6 py-16 text-center dark:border-white/15">
          <p className="text-sm font-medium text-foreground">
            {missing ? "Service not found" : "Couldn't load this service"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {missing
              ? "It may have been deleted, or the link is wrong."
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

  return (
    <div className="flex flex-col gap-6">
      <BackToServices />

      <PageHeader
        title={service.name}
        description={service.description ?? undefined}
        action={
          canRespond ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={testAlert.isPending}
                onClick={() => testAlert.mutate()}
                className="h-9 cursor-pointer px-3.5"
              >
                {testAlert.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <SendIcon className="size-3.5" />
                )}
                Send a test alert
              </Button>
              {canManage && (
                <Button
                  variant="outline"
                  onClick={() => setDialog("edit")}
                  className="h-9 cursor-pointer px-3.5"
                >
                  <PencilIcon className="size-3.5" />
                  Edit service
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3.5 text-sm">
              <Detail label="Team">
                <Link href={`/teams/${service.team.id}`} className={linkClass}>
                  {service.team.name}
                </Link>
              </Detail>
              <Detail label="Escalation policy">
                <Link
                  href={`/policies/${service.escalationPolicy.id}`}
                  className={linkClass}
                >
                  {service.escalationPolicy.name}
                </Link>
              </Detail>
              <Detail label="Auto-resolve">
                {service.autoResolveMinutes
                  ? `After ${formatMinutes(service.autoResolveMinutes)}`
                  : "Never"}
              </Detail>
              <Detail label="Open incidents">{service.openIncidentCount}</Detail>
              <Detail label="Added">
                {formatDate(service.createdAt)}
              </Detail>
            </dl>
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          {canManage && <ApiKeysCard serviceId={service.id} />}

          <Card>
            <CardHeader>
              <CardTitle>Recent alerts</CardTitle>
            </CardHeader>
            {service.recentAlerts.length === 0 ? (
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  No alerts have arrived for this service yet.
                </p>
              </CardContent>
            ) : (
              <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
                {service.recentAlerts.map((alert) => (
                  <li
                    key={alert.id}
                    className="flex items-center gap-4 px-(--card-spacing) py-3 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate text-foreground">
                      {alert.title}
                    </span>
                    {/* "new" opened an incident; "dedup" joined an open one. */}
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                      {alert.kind === "dedup" ? "Joined" : "Opened"}
                    </span>
                    {alert.incidentNumber !== null ? (
                      <Link
                        href={`/incidents/${alert.incidentNumber}`}
                        className={`${linkClass} shrink-0 font-mono text-xs`}
                      >
                        INC-{alert.incidentNumber}
                      </Link>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        Nothing open
                      </span>
                    )}
                    <span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                      {timeAgo(alert.receivedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {dialog === "edit" && (
        <ServiceFormDialog
          service={service}
          onClose={() => setDialog(null)}
          onDelete={() => setDialog("delete")}
        />
      )}
      {dialog === "delete" && (
        <ConfirmDeleteDialog
          name={service.name}
          description="The service is removed for good, along with its API keys, alerts and past incidents. Its team and escalation policy are kept."
          actionLabel="Delete service"
          onDelete={() => deleteServiceApi(service.id)}
          onDeleted={() => {
            queryClient.invalidateQueries({ queryKey: ["services"] });
            queryClient.invalidateQueries({ queryKey: ["teams"] });
            queryClient.invalidateQueries({ queryKey: ["policies"] });
            toast.success(`${service.name} deleted`);
            router.push("/services");
          }}
          onClose={() => setDialog(null)}
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

function BackToServices() {
  return (
    <Link
      href="/services"
      className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-emerald-400/60"
    >
      <ArrowLeftIcon className="size-3.5" />
      Services
    </Link>
  );
}
