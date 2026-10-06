"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { MemberPicker } from "@/components/teams/member-picker";
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
import { getApiErrorMessage } from "@/lib/api/errors";
import { getMembersApi } from "@/lib/api/members";
import {
  addTeamMemberApi,
  removeTeamMemberApi,
  type Team,
} from "@/lib/api/teams";

// One dialog for adding and removing people: tick who should be on the
// team, then save. Only the differences are sent to the API.
export function ManageTeamMembersDialog({
  team,
  onClose,
}: {
  team: Team;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const current = team.members.map((member) => member.userId);
  const [selected, setSelected] = useState<string[]>(current);

  const { data: members } = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await getMembersApi()).data.data,
  });

  const toAdd = selected.filter((id) => !current.includes(id));
  const toRemove = current.filter((id) => !selected.includes(id));
  const changed = toAdd.length + toRemove.length > 0;

  const mutation = useMutation({
    mutationFn: async () => {
      for (const userId of toAdd) await addTeamMemberApi(team.id, userId);
      for (const userId of toRemove) await removeTeamMemberApi(team.id, userId);
    },
    onSuccess: () => {
      toast.success("Team members updated");
      onClose();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Couldn't update the team."));
    },
    // Refresh either way: if one request failed part-way, the screen should
    // show what actually got saved.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["team", team.id] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Team members</DialogTitle>
          <DialogDescription>
            Tick everyone who should be on {team.name}.
          </DialogDescription>
        </DialogHeader>

        {members ? (
          <MemberPicker
            members={members}
            selected={selected}
            onChange={setSelected}
          />
        ) : (
          <div className="h-40 animate-pulse rounded-lg bg-black/[0.04] dark:bg-white/[0.04]" />
        )}

        <DialogFooter className="sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {selected.length} selected
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <DialogClose
              render={<Button variant="outline" className="h-9 px-4" />}
            >
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
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
