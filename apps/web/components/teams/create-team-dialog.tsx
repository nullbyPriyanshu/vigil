"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, PlusIcon } from "lucide-react";

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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api/errors";
import { getMembersApi } from "@/lib/api/members";
import { createTeamApi } from "@/lib/api/teams";

export function CreateTeamDialog() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [nameError, setNameError] = useState<string | null>(null);

  // Loaded only once the dialog is opened.
  const { data: members } = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await getMembersApi()).data.data,
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: async () =>
      (await createTeamApi({ name: name.trim(), memberIds })).data,
    onSuccess: (team) => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.success(`${team.name} created`);
      setOpen(false);
      router.push(`/teams/${team.id}`);
    },
    onError: (error) => {
      // Problems with the name (too short, already taken) belong under the
      // name field; anything else is a toast.
      const message = getApiErrorMessage(error, "Couldn't create the team.");
      if (/name|already exists/i.test(message)) setNameError(message);
      else toast.error(message);
    },
  });

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
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setName("");
          setMemberIds([]);
          setNameError(null);
        }
      }}
    >
      <DialogTrigger render={<Button className="h-9 px-3.5" />}>
        <PlusIcon className="size-4" />
        New team
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a team</DialogTitle>
          <DialogDescription>
            A named group of people. Services and schedules will belong to a
            team.
          </DialogDescription>
        </DialogHeader>

        <form id="create-team" onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="team-name">Name</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(null);
              }}
              placeholder="Platform Team"
              autoComplete="off"
              aria-invalid={nameError ? true : undefined}
              className="h-9"
            />
            {nameError && (
              <p className="text-sm text-destructive">{nameError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              Members
              <span className="font-normal text-muted-foreground">
                {memberIds.length > 0
                  ? `${memberIds.length} selected`
                  : "optional"}
              </span>
            </Label>
            {members ? (
              <MemberPicker
                members={members}
                selected={memberIds}
                onChange={setMemberIds}
              />
            ) : (
              <div className="h-24 animate-pulse rounded-lg bg-black/[0.04] dark:bg-white/[0.04]" />
            )}
          </div>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="h-9 px-4" />}>
            Cancel
          </DialogClose>
          <Button
            type="submit"
            form="create-team"
            disabled={mutation.isPending}
            className="h-9 px-4"
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Create team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
