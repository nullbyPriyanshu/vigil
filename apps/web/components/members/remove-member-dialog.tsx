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
import { removeMemberApi, type Member } from "@/lib/api/members";

// The second step after "Remove" in the manage dialog: type the member's
// name so nobody is removed by a stray click.
export function RemoveMemberDialog({
  member,
  onClose,
}: {
  member: Member;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [typed, setTyped] = useState("");

  const mutation = useMutation({
    mutationFn: () => removeMemberApi(member.userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      toast.success(`${member.name} was removed`);
      onClose();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Couldn't remove this member."));
    },
  });

  const matches = typed.trim() === member.name;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove {member.name}?</DialogTitle>
          <DialogDescription>
            They&apos;ll be signed out and lose access to this organization
            straight away. Their account isn&apos;t deleted, so you can add
            them back later.
          </DialogDescription>
        </DialogHeader>

        <form
          id="remove-member"
          onSubmit={(e) => {
            e.preventDefault();
            if (matches) mutation.mutate();
          }}
          className="space-y-2"
        >
          <Label htmlFor="confirm-member-name" className="font-normal">
            <span>
              Type <span className="font-medium select-all">{member.name}</span>{" "}
              to confirm
            </span>
          </Label>
          <Input
            id="confirm-member-name"
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
            form="remove-member"
            variant="destructive"
            disabled={!matches || mutation.isPending}
            className="h-9 px-4"
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Remove member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
