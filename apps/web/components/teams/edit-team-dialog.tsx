"use client";

import { useState } from "react";
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
import { renameTeamApi, type Team } from "@/lib/api/teams";

// Opened from "Edit team". Renames the team, and is the way in to deleting it.
export function EditTeamDialog({
  team,
  onClose,
  onDelete,
}: {
  team: Team;
  onClose: () => void;
  onDelete: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(team.name);
  const [nameError, setNameError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => (await renameTeamApi(team.id, name.trim())).data,
    onSuccess: (updated) => {
      queryClient.setQueryData(["team", team.id], updated);
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Team renamed");
      onClose();
    },
    onError: (error) => {
      setNameError(getApiErrorMessage(error, "Couldn't rename the team."));
    },
  });

  const changed = name.trim() !== team.name;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setNameError("Team name must be at least 2 characters");
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit team</DialogTitle>
          <DialogDescription>Rename this team, or delete it.</DialogDescription>
        </DialogHeader>

        <form id="edit-team" onSubmit={submit} className="space-y-2" noValidate>
          <Label htmlFor="edit-team-name">Name</Label>
          <Input
            id="edit-team-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(null);
            }}
            autoComplete="off"
            aria-invalid={nameError ? true : undefined}
            className="h-9"
          />
          {nameError && <p className="text-sm text-destructive">{nameError}</p>}
        </form>

        <div className="flex items-center justify-between gap-4 border-t border-black/[0.08] pt-4 dark:border-white/[0.08]">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Delete team</p>
            <p className="text-sm text-muted-foreground">
              The people stay in your organization.
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

        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="h-9 px-4" />}>
            Cancel
          </DialogClose>
          <Button
            type="submit"
            form="edit-team"
            disabled={!changed || mutation.isPending}
            className="h-9 px-4"
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Save name
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
