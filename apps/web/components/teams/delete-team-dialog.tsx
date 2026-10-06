"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { getApiErrorMessage } from "@/lib/api/errors";
import { deleteTeamApi, type Team } from "@/lib/api/teams";

// The second step after "Delete" in the edit dialog: type the team's name
// so it isn't deleted by a stray click.
export function DeleteTeamDialog({
  team,
  onClose,
}: {
  team: Team;
  onClose: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [typed, setTyped] = useState("");

  const mutation = useMutation({
    mutationFn: () => deleteTeamApi(team.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.success(`${team.name} deleted`);
      router.push("/teams");
    },
    onError: (error) => {
      // e.g. "Team owns 2 services": it can't be deleted until those move.
      toast.error(getApiErrorMessage(error, "Couldn't delete the team."));
    },
  });

  const matches = typed.trim() === team.name;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {team.name}?</DialogTitle>
          <DialogDescription>
            The team is removed for good. Its {team.members.length}{" "}
            {team.members.length === 1 ? "member stays" : "members stay"} in
            your organization.
          </DialogDescription>
        </DialogHeader>

        <form
          id="delete-team"
          onSubmit={(e) => {
            e.preventDefault();
            if (matches) mutation.mutate();
          }}
          className="space-y-2"
        >
          <Label htmlFor="confirm-team-name" className="font-normal">
            <span>
              Type <span className="font-medium select-all">{team.name}</span>{" "}
              to confirm
            </span>
          </Label>
          <Input
            id="confirm-team-name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="h-9"
          />
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="h-9 px-4" />}>
            Cancel
          </DialogClose>
          <Button
            type="submit"
            form="delete-team"
            variant="destructive"
            disabled={!matches || mutation.isPending}
            className="h-9 px-4"
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Delete team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
