"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownIcon, ArrowUpIcon, Loader2, XIcon } from "lucide-react";

import { UserAvatar } from "@/components/shared/user-avatar";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  addParticipantApi,
  removeParticipantApi,
  reorderParticipantsApi,
  type Schedule,
} from "@/lib/api/schedules";
import { getTeamApi } from "@/lib/api/teams";

type Person = { userId: string; name: string };

// One dialog for the whole rotation: add people, remove them and change the
// order, then save. Only the differences are sent to the API.
export function ManageRotationDialog({
  schedule,
  onClose,
}: {
  schedule: Schedule;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const before = schedule.participants.map((p) => p.userId);
  const [people, setPeople] = useState<Person[]>(schedule.participants);

  // Only the schedule's team can be on it, and viewers can't be on call.
  const { data: team } = useQuery({
    queryKey: ["team", schedule.team.id],
    queryFn: async () => (await getTeamApi(schedule.team.id)).data,
  });

  const now = people.map((p) => p.userId);
  const canAdd = (team?.members ?? [])
    .filter((m) => m.role !== "VIEWER" && !now.includes(m.userId))
    .map((m) => ({ value: m.userId, label: m.name }));

  const changed = now.join() !== before.join();

  const move = (index: number, by: -1 | 1) => {
    const next = [...people];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    setPeople(next);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      for (const userId of before.filter((id) => !now.includes(id))) {
        await removeParticipantApi(schedule.id, userId);
      }
      for (const userId of now.filter((id) => !before.includes(id))) {
        await addParticipantApi(schedule.id, userId);
      }
      if (now.length > 0) await reorderParticipantsApi(schedule.id, now);
    },
    onSuccess: () => {
      toast.success("Rotation updated");
      onClose();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Couldn't update the rotation."));
    },
    // Refresh either way: if one request failed part-way, the screen should
    // show what actually got saved.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule", schedule.id] });
      queryClient.invalidateQueries({ queryKey: ["schedule-upcoming", schedule.id] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["on-call"] });
    },
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rotation order</DialogTitle>
          <DialogDescription>
            People take turns from top to bottom, then it starts again.
          </DialogDescription>
        </DialogHeader>

        {people.length === 0 ? (
          <p className="rounded-lg border border-dashed border-black/15 px-4 py-6 text-center text-sm text-muted-foreground dark:border-white/15">
            Nobody is on this rotation yet.
          </p>
        ) : (
          <ol className="space-y-1.5">
            {people.map((person, index) => (
              <li
                key={person.userId}
                className="flex items-center gap-3 rounded-lg border border-black/[0.08] py-1.5 pr-1.5 pl-3 dark:border-white/[0.08]"
              >
                <span className="w-4 text-xs text-muted-foreground tabular-nums">
                  {index + 1}
                </span>
                <UserAvatar name={person.name} className="size-7 text-[10px]" />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {person.name}
                </span>
                <div className="flex items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    aria-label={`Move ${person.name} up`}
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === people.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={`Move ${person.name} down`}
                  >
                    <ArrowDownIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      setPeople(people.filter((p) => p.userId !== person.userId))
                    }
                    aria-label={`Remove ${person.name}`}
                  >
                    <XIcon />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="space-y-2">
          {/* Always empty: picking someone adds them to the list above. */}
          <Select
            items={canAdd}
            value={null}
            onValueChange={(value) => {
              const member = team?.members.find((m) => m.userId === value);
              if (member) {
                setPeople([...people, { userId: member.userId, name: member.name }]);
              }
            }}
          >
            <SelectTrigger
              aria-label="Add a person"
              className="w-full min-w-0 data-[size=default]:h-9"
            >
              <SelectValue placeholder="Add a person" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="max-h-60">
              {canAdd.length === 0 ? (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">
                  {team ? "Everyone who can be on call is already here" : "Loading"}
                </p>
              ) : (
                canAdd.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Only members of {schedule.team.name} can be added. Viewers
            can&apos;t be on call.
          </p>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="h-9 px-4" />}>
            Cancel
          </DialogClose>
          <Button
            type="button"
            disabled={!changed || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="h-9 px-4"
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
