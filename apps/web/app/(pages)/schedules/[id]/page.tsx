"use client";

import { use, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeftIcon, PencilIcon, UsersIcon } from "lucide-react";

import { ManageRotationDialog } from "@/components/schedules/manage-rotation-dialog";
import { ScheduleFormDialog } from "@/components/schedules/schedule-form-dialog";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import {
  deleteScheduleApi,
  getScheduleApi,
  getUpcomingShiftsApi,
} from "@/lib/api/schedules";
import { canManageMembers } from "@/lib/roles";
import { describeRotation, formatShiftTime } from "@/lib/schedule-format";
import { formatDate } from "@/lib/time";

type OpenDialog = "edit" | "delete" | "rotation" | null;

const linkClass =
  "rounded-sm text-foreground underline decoration-black/20 underline-offset-4 outline-none hover:decoration-black/60 focus-visible:ring-2 focus-visible:ring-emerald-400/60 dark:decoration-white/25 dark:hover:decoration-white/70";

export default function SchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [dialog, setDialog] = useState<OpenDialog>(null);

  const { data: schedule, error, isLoading, refetch } = useQuery({
    queryKey: ["schedule", id],
    queryFn: async () => (await getScheduleApi(id)).data,
    retry: false,
  });

  const { data: upcoming } = useQuery({
    queryKey: ["schedule-upcoming", id],
    queryFn: async () => (await getUpcomingShiftsApi(id)).data.blocks,
    enabled: !!schedule,
  });

  const canManage = canManageMembers(session?.role);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  if (!schedule) {
    const status = isAxiosError(error) ? error.response?.status : undefined;
    const missing = status === 404 || status === 400;
    return (
      <div className="flex flex-col gap-6">
        <BackToSchedules />
        <div className="rounded-xl border border-dashed border-black/15 px-6 py-16 text-center dark:border-white/15">
          <p className="text-sm font-medium text-foreground">
            {missing ? "Schedule not found" : "Couldn't load this schedule"}
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

  const onCall = schedule.currentOnCall;
  const notStarted = new Date(schedule.startDate) > new Date();

  return (
    <div className="flex flex-col gap-6">
      <BackToSchedules />

      <PageHeader
        title={schedule.name}
        description={`${describeRotation(schedule)} · ${schedule.timezone.replaceAll("_", " ")}`}
        action={
          canManage ? (
            <Button
              variant="outline"
              onClick={() => setDialog("edit")}
              className="h-9 cursor-pointer px-3.5"
            >
              <PencilIcon className="size-3.5" />
              Edit schedule
            </Button>
          ) : undefined
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>On call now</CardTitle>
            </CardHeader>
            <CardContent>
              {onCall ? (
                <div className="flex items-center gap-3">
                  <UserAvatar name={onCall.name} className="size-10 text-sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {onCall.name}
                      {onCall.userId === session?.user.id && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          You
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Until {formatShiftTime(onCall.until)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {schedule.participants.length === 0
                    ? "Nobody. Alerts sent to this schedule reach no one until someone is added."
                    : notStarted
                      ? `Nobody yet. The rotation starts ${formatShiftTime(schedule.startDate)}.`
                      : "Nobody right now."}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3.5 text-sm">
                <Detail label="Team">
                  <Link href={`/teams/${schedule.team.id}`} className={linkClass}>
                    {schedule.team.name}
                  </Link>
                </Detail>
                <Detail label="Handoff">{describeRotation(schedule)}</Detail>
                <Detail label="Timezone">
                  {schedule.timezone.replaceAll("_", " ")}
                </Detail>
                <Detail label="Started">{formatDate(schedule.startDate)}</Detail>
              </dl>
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Rotation order</CardTitle>
              {canManage && (
                <CardAction>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDialog("rotation")}
                    className="cursor-pointer"
                  >
                    <UsersIcon className="size-3.5" />
                    Manage rotation
                  </Button>
                </CardAction>
              )}
            </CardHeader>
            {schedule.participants.length === 0 ? (
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Nobody is on this rotation yet.
                  {canManage && " Use Manage rotation to add people."}
                </p>
              </CardContent>
            ) : (
              <ol className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
                {schedule.participants.map((participant) => (
                  <li
                    key={participant.userId}
                    className="flex items-center gap-3 px-(--card-spacing) py-2.5"
                  >
                    <span className="w-4 text-xs text-muted-foreground tabular-nums">
                      {participant.position + 1}
                    </span>
                    <UserAvatar
                      name={participant.name}
                      className="size-7 text-[10px]"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {participant.name}
                    </span>
                    {participant.userId === onCall?.userId && (
                      <span className="shrink-0 text-xs text-emerald-600 dark:text-emerald-400">
                        On call
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming</CardTitle>
            </CardHeader>
            {!upcoming ? (
              <CardContent>
                <div className="h-24 animate-pulse rounded-lg bg-black/[0.04] dark:bg-white/[0.04]" />
              </CardContent>
            ) : schedule.participants.length === 0 ? (
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Shifts appear here once someone is on the rotation.
                </p>
              </CardContent>
            ) : (
              <>
                <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
                  {upcoming.map((block) => (
                    <li
                      key={block.from}
                      className="flex flex-wrap items-center gap-x-4 gap-y-0.5 px-(--card-spacing) py-2.5 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate text-foreground">
                        {block.user?.name ?? "Nobody"}
                        {block.current && (
                          <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">
                            Now
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {formatShiftTime(block.from)} – {formatShiftTime(block.to)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="px-(--card-spacing) pt-3 text-xs text-muted-foreground">
                  Times are shown in your own timezone.
                </p>
              </>
            )}
          </Card>
        </div>
      </div>

      {dialog === "edit" && (
        <ScheduleFormDialog
          schedule={schedule}
          onClose={() => setDialog(null)}
          onDelete={() => setDialog("delete")}
        />
      )}
      {dialog === "rotation" && (
        <ManageRotationDialog schedule={schedule} onClose={() => setDialog(null)} />
      )}
      {dialog === "delete" && (
        <ConfirmDeleteDialog
          name={schedule.name}
          description="The schedule and its rotation are removed for good. The people stay on the team."
          actionLabel="Delete schedule"
          onDelete={() => deleteScheduleApi(schedule.id)}
          onDeleted={() => {
            queryClient.invalidateQueries({ queryKey: ["schedules"] });
            queryClient.invalidateQueries({ queryKey: ["on-call"] });
            toast.success(`${schedule.name} deleted`);
            router.push("/schedules");
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

function BackToSchedules() {
  return (
    <Link
      href="/schedules"
      className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-emerald-400/60"
    >
      <ArrowLeftIcon className="size-3.5" />
      Schedules
    </Link>
  );
}
