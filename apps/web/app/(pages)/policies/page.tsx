"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRightIcon, PlusIcon, WorkflowIcon } from "lucide-react";

import { PolicyFormDialog } from "@/components/policies/policy-form-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { LoadError } from "@/components/shared/load-error";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { getPoliciesApi } from "@/lib/api/policies";
import { formatRepeat } from "@/lib/duration";
import { canManageMembers } from "@/lib/roles";

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

export default function PoliciesPage() {
  const { session } = useAuth();
  const [creating, setCreating] = useState(false);

  const { data: policies, isLoading, isError, refetch } = useQuery({
    queryKey: ["policies"],
    queryFn: async () => (await getPoliciesApi()).data.data,
  });

  const canManage = canManageMembers(session?.role);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={WorkflowIcon}
        title="Escalation Policies"
        description="Who gets notified about an incident, in what order, and how long to wait before moving on."
        action={
          canManage ? (
            <Button onClick={() => setCreating(true)} className="h-9 px-3.5">
              <PlusIcon className="size-4" />
              New policy
            </Button>
          ) : undefined
        }
      />

      {isError && !policies ? (
        <LoadError what="the policies" onRetry={() => refetch()} />
      ) : isLoading || !policies ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : policies.length === 0 ? (
        <EmptyState
          icon={WorkflowIcon}
          title="No escalation policies yet"
          description={
            canManage
              ? "Create one to decide who is notified first, and who's next if they don't respond."
              : "An owner or admin can create policies. They'll show up here."
          }
        />
      ) : (
        <Card className="gap-0 py-0">
          <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
            {policies.map((policy) => (
              <li key={policy.id}>
                <Link
                  href={`/policies/${policy.id}`}
                  className="flex items-center gap-4 px-(--card-spacing) py-3.5 transition-colors outline-none hover:bg-black/[0.02] focus-visible:bg-black/[0.03] dark:hover:bg-white/[0.02] dark:focus-visible:bg-white/[0.03]"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-black/[0.08] text-xs font-semibold text-foreground tabular-nums dark:border-white/[0.08]">
                    {policy.stepCount}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {policy.name}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {plural(policy.stepCount, "step")} ·{" "}
                      {formatRepeat(policy.repeatCount)}
                    </p>
                  </div>
                  <span
                    className={
                      policy.serviceCount === 0
                        ? "hidden shrink-0 text-xs text-muted-foreground sm:block"
                        : "hidden shrink-0 text-xs text-zinc-700 sm:block dark:text-zinc-300"
                    }
                  >
                    {policy.serviceCount === 0
                      ? "Not used yet"
                      : `Used by ${plural(policy.serviceCount, "service")}`}
                  </span>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {creating && <PolicyFormDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
