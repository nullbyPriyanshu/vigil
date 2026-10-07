"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/auth-context";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  createScheduleApi,
  updateScheduleApi,
  type RotationType,
  type Schedule,
} from "@/lib/api/schedules";
import { getTeamsApi } from "@/lib/api/teams";
import { WEEKDAYS, timezoneItems } from "@/lib/schedule-format";

const ROTATION_ITEMS = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "DAILY", label: "Daily" },
];

const DAY_ITEMS = WEEKDAYS.map((label, value) => ({ value, label }));

// "2026-01-05" for today, or for a stored start in the schedule's timezone.
function toDateInput(date: Date, timeZone?: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(date);
}

// Creates a schedule, or edits one when `schedule` is given. In edit mode it
// is also the way in to deleting it.
export function ScheduleFormDialog({
  schedule,
  onClose,
  onDelete,
}: {
  schedule?: Schedule;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();

  const [name, setName] = useState(schedule?.name ?? "");
  const [teamId, setTeamId] = useState<string | null>(schedule?.team.id ?? null);
  const [timezone, setTimezone] = useState(
    schedule?.timezone ?? session?.user.timezone ?? "UTC",
  );
  const [rotationType, setRotationType] = useState<RotationType>(
    schedule?.rotationType ?? "WEEKLY",
  );
  const [handoffDay, setHandoffDay] = useState(schedule?.handoffDay ?? 1);
  const [handoffTime, setHandoffTime] = useState(schedule?.handoffTime ?? "10:00");
  const [startDate, setStartDate] = useState(
    schedule
      ? toDateInput(new Date(schedule.startDate), schedule.timezone)
      : toDateInput(new Date()),
  );
  const [error, setError] = useState<{
    field: "name" | "team" | "form";
    message: string;
  } | null>(null);

  const { data: teams } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => (await getTeamsApi()).data.data,
    enabled: !schedule,
  });

  const timezones = useMemo(() => timezoneItems(timezone), [timezone]);
  const teamItems = (teams ?? []).map((t) => ({ value: t.id, label: t.name }));

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        timezone,
        rotationType,
        handoffDay: rotationType === "WEEKLY" ? handoffDay : undefined,
        handoffTime,
        startDate,
      };
      const response = schedule
        ? await updateScheduleApi(schedule.id, body)
        : await createScheduleApi({ ...body, teamId: teamId as string });
      return response.data;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["schedule", saved.id] });
      queryClient.invalidateQueries({ queryKey: ["schedule-upcoming", saved.id] });
      queryClient.invalidateQueries({ queryKey: ["on-call"] });
      toast.success(schedule ? "Schedule updated" : `${saved.name} created`);
      onClose();
      if (!schedule) router.push(`/schedules/${saved.id}`);
    },
    onError: (err) => {
      const message = getApiErrorMessage(err, "Couldn't save the schedule.");
      if (/name|already exists/i.test(message)) {
        setError({ field: "name", message });
      } else if (/team/i.test(message)) {
        setError({ field: "team", message });
      } else {
        setError({ field: "form", message });
      }
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError({
        field: "name",
        message: "Schedule name must be at least 2 characters",
      });
      return;
    }
    if (!schedule && !teamId) {
      setError({ field: "team", message: "Choose the team this rotation is for" });
      return;
    }
    if (!handoffTime || !startDate) {
      setError({ field: "form", message: "Pick a handoff time and a start date" });
      return;
    }
    mutation.mutate();
  };

  const messageFor = (field: NonNullable<typeof error>["field"]) =>
    error?.field === field ? (
      <p className="text-sm text-destructive">{error.message}</p>
    ) : null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {schedule ? "Edit schedule" : "Create a schedule"}
          </DialogTitle>
          <DialogDescription>
            A rotation: people take turns being on call, handing off at the
            same time each day or week.
          </DialogDescription>
        </DialogHeader>

        <form id="schedule-form" onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="schedule-name">Name</Label>
            <Input
              id="schedule-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="Platform Weekly"
              autoComplete="off"
              aria-invalid={error?.field === "name" ? true : undefined}
              className="h-9"
            />
            {messageFor("name")}
          </div>

          {!schedule && (
            <div className="space-y-2">
              <Label htmlFor="schedule-team">Team</Label>
              <Select
                items={teamItems}
                value={teamId}
                onValueChange={(value) => {
                  setTeamId(value as string);
                  setError(null);
                }}
              >
                <SelectTrigger
                  id="schedule-team"
                  aria-invalid={error?.field === "team" ? true : undefined}
                  className="w-full min-w-0 data-[size=default]:h-9"
                >
                  <SelectValue placeholder="Choose a team" />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} className="max-h-60">
                  {teamItems.length === 0 ? (
                    <p className="px-2 py-1.5 text-sm text-muted-foreground">
                      No teams yet. Create a team first.
                    </p>
                  ) : (
                    teamItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {messageFor("team") ?? (
                <p className="text-sm text-muted-foreground">
                  Only people on this team can be put on the rotation.
                </p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="schedule-rotation">Rotates</Label>
              <Select
                items={ROTATION_ITEMS}
                value={rotationType}
                onValueChange={(value) => setRotationType(value as RotationType)}
              >
                <SelectTrigger
                  id="schedule-rotation"
                  className="w-full data-[size=default]:h-9"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {ROTATION_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {rotationType === "WEEKLY" && (
              <div className="space-y-2">
                <Label htmlFor="schedule-day">Handoff day</Label>
                <Select
                  items={DAY_ITEMS}
                  value={handoffDay}
                  onValueChange={(value) => setHandoffDay(value as number)}
                >
                  <SelectTrigger
                    id="schedule-day"
                    className="w-full data-[size=default]:h-9"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false} className="max-h-60">
                    {DAY_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="schedule-time">Handoff time</Label>
              <Input
                id="schedule-time"
                type="time"
                value={handoffTime}
                onChange={(e) => setHandoffTime(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="schedule-start">Starts on</Label>
              <Input
                id="schedule-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule-timezone">Timezone</Label>
            <Select
              items={timezones}
              value={timezone}
              onValueChange={(value) => setTimezone(value as string)}
            >
              <SelectTrigger
                id="schedule-timezone"
                className="w-full min-w-0 data-[size=default]:h-9"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} className="max-h-60">
                {timezones.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              The handoff time is in this timezone, and follows its clock
              changes.
            </p>
          </div>

          {schedule && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-sm text-foreground">
              Changing the rotation, handoff, start date or timezone moves
              every shift, including who is on call right now.
            </p>
          )}
          {messageFor("form")}
        </form>

        {schedule && onDelete && (
          <div className="flex items-center justify-between gap-4 border-t border-black/[0.08] pt-4 dark:border-white/[0.08]">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Delete schedule
              </p>
              <p className="text-sm text-muted-foreground">
                Only possible when no escalation policy uses it.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              onClick={onDelete}
              className="h-9 shrink-0 px-4"
            >
              Delete
            </Button>
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="h-9 px-4" />}>
            Cancel
          </DialogClose>
          <Button
            type="submit"
            form="schedule-form"
            disabled={mutation.isPending}
            className="h-9 px-4"
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {schedule ? "Save changes" : "Create schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
