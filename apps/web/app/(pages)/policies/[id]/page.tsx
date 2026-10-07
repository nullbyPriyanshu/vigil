"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  CalendarClockIcon,
  PencilIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";

import { PolicyFormDialog } from "@/components/policies/policy-form-dialog";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { deletePolicyApi, getPolicyApi } from "@/lib/api/policies";
import { formatMinutes, formatRepeat } from "@/lib/duration";
import { canManageMembers } from "@/lib/roles";

type OpenDialog = "edit" | "delete" | null;

export default function PolicyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [dialog, setDialog] = useState<OpenDialog>(null);

  const { data: policy, error, isLoading, refetch } = useQuery({
    queryKey: ["policy", id],
    queryFn: async () => (await getPolicyApi(id)).data,
    retry: false,
  });

  const canManage = canManageMembers(session?.role);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  if (!policy) {
    const status = isAxiosError(error) ? error.response?.status : undefined;
    const missing = status === 404 || status === 400;
    return (
      <div className="flex flex-col gap-6">
        <BackToPolicies />
        <div className="rounded-xl border border-dashed border-black/15 px-6 py-16 text-center dark:border-white/15">
          <p className="text-sm font-medium text-foreground">
            {missing ? "Policy not found" : "Couldn't load this policy"}
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

  const services = policy.services ?? [];
  const lastStep = policy.steps.length;

  return (
    <div className="flex flex-col gap-6">
      <BackToPolicies />

      <PageHeader
        title={policy.name}
        description={`${lastStep} ${lastStep === 1 ? "step" : "steps"} · ${formatRepeat(policy.repeatCount)} · Used by ${services.length} ${services.length === 1 ? "service" : "services"}`}
        action={
          canManage ? (
            <Button
              variant="outline"
              onClick={() => setDialog("edit")}
              className="h-9 cursor-pointer px-3.5"
            >
              <PencilIcon className="size-3.5" />
              Edit policy
            </Button>
          ) : undefined
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <ol>
              {policy.steps.map((step) => (
                <li key={step.id} className="relative flex gap-3.5 pb-6 last:pb-0">
                  {/* The line joining this step's number to the next one. */}
                  {step.position !== lastStep && (
                    <span className="absolute top-7 bottom-0 left-3.5 w-px -translate-x-1/2 bg-black/10 dark:bg-white/10" />
                  )}
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-black/10 text-xs font-medium text-foreground tabular-nums dark:border-white/15">
                    {step.position}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      {step.targetType === "TEAM" ? (
                        <UsersIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      ) : step.targetType === "SCHEDULE" ? (
                        <CalendarClockIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <UserIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate">
                        Notify {step.target.name}
                        {step.targetType === "TEAM" && " (everyone on the team)"}
                        {step.targetType === "SCHEDULE" && " (whoever is on call)"}
                      </span>
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {step.position === lastStep
                        ? `Waits ${formatMinutes(step.delayMinutes)} for a response`
                        : `If nobody responds in ${formatMinutes(step.delayMinutes)}, go to step ${step.position + 1}`}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-5 border-t border-black/[0.06] pt-4 text-sm text-muted-foreground dark:border-white/[0.06]">
              {policy.repeatCount === 0
                ? "After the last step, the policy stops."
                : `After the last step, it starts again from step 1, ${policy.repeatCount === 1 ? "once" : `up to ${policy.repeatCount} times`}.`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Used by</CardTitle>
          </CardHeader>
          {services.length === 0 ? (
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No service uses this policy yet.
              </p>
            </CardContent>
          ) : (
            <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
              {services.map((service) => (
                <li key={service.id}>
                  <Link
                    href={`/services/${service.id}`}
                    className="block px-(--card-spacing) py-3 text-sm text-foreground transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                  >
                    {service.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {dialog === "edit" && (
        <PolicyFormDialog
          policy={policy}
          onClose={() => setDialog(null)}
          onDelete={() => setDialog("delete")}
        />
      )}
      {dialog === "delete" && (
        <ConfirmDeleteDialog
          name={policy.name}
          description="The policy and its steps are removed for good."
          actionLabel="Delete policy"
          onDelete={() => deletePolicyApi(policy.id)}
          onDeleted={() => {
            queryClient.invalidateQueries({ queryKey: ["policies"] });
            toast.success(`${policy.name} deleted`);
            router.push("/policies");
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function BackToPolicies() {
  return (
    <Link
      href="/policies"
      className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-emerald-400/60"
    >
      <ArrowLeftIcon className="size-3.5" />
      Escalation Policies
    </Link>
  );
}
