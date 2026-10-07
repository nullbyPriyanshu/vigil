"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarClockIcon, PlusIcon } from "lucide-react";

import { ScheduleFormDialog } from "@/components/schedules/schedule-form-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { LoadError } from "@/components/shared/load-error";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { getSchedulesApi, type ScheduleSummary } from "@/lib/api/schedules";
import { canManageMembers } from "@/lib/roles";
import { describeRotation, formatShiftTime } from "@/lib/schedule-format";

export default function SchedulesPage() {
  const { session } = useAuth();
  const [creating, setCreating] = useState(false);

  const { data: schedules, isLoading, isError, refetch } = useQuery({
    queryKey: ["schedules"],
    queryFn: async () => (await getSchedulesApi()).data.data,
  });

  const canManage = canManageMembers(session?.role);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Schedules"
        description="Rotations that answer one question: who is on call right now?"
        action={
          canManage ? (
            <Button onClick={() => setCreating(true)} className="h-9 px-3.5">
              <PlusIcon className="size-4" />
              New schedule
            </Button>
          ) : undefined
        }
      />

      {isError && !schedules ? (
        <LoadError what="the schedules" onRetry={() => refetch()} />
      ) : isLoading || !schedules ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <EmptyState
          icon={CalendarClockIcon}
          title="No schedules yet"
          description={
            canManage
              ? "Create a rotation for a team, then point an escalation policy at it so alerts reach whoever is on call."
              : "An owner or admin can create schedules. They'll show up here."
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {schedules.map((schedule) => (
            <li key={schedule.id}>
              <ScheduleCard schedule={schedule} />
            </li>
          ))}
        </ul>
      )}

      {creating && <ScheduleFormDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function ScheduleCard({ schedule }: { schedule: ScheduleSummary }) {
  const onCall = schedule.currentOnCall;

  return (
    <Link
      href={`/schedules/${schedule.id}`}
      className="flex h-full flex-col gap-5 rounded-xl border border-black/[0.08] bg-black/[0.015] p-5 transition-colors outline-none hover:border-black/20 focus-visible:ring-2 focus-visible:ring-emerald-400/60 dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:border-white/15"
    >
      <div className="min-w-0">
        <h2 className="truncate text-base font-medium text-zinc-900 dark:text-zinc-100">
          {schedule.name}
        </h2>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {schedule.team.name} · {describeRotation(schedule)}
        </p>
      </div>

      <div className="mt-auto flex min-h-9 items-center gap-3">
        {onCall ? (
          <>
            <UserAvatar name={onCall.name} className="size-9 text-xs" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {onCall.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                On call until {formatShiftTime(onCall.until)}
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {schedule.participantCount === 0
              ? "Nobody on the rotation yet"
              : "Hasn't started yet"}
          </p>
        )}
      </div>
    </Link>
  );
}
