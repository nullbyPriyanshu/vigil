"use client";

import { useState } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/auth-context";
import { refreshSessionApi } from "@/lib/api/auth";
import { getApiErrorMessage } from "@/lib/api/errors";
import { getMembersApi } from "@/lib/api/members";
import { transferOwnershipApi } from "@/lib/api/organization";
import { ROLE_LABELS } from "@/lib/roles";

export function TransferOwnershipDialog({ disabled }: { disabled: boolean }) {
  const queryClient = useQueryClient();
  const { session, refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const { data: members } = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await getMembersApi()).data.data,
    enabled: open,
  });

  // Everyone except you (the current owner).
  const candidates = (members ?? [])
    .filter((member) => member.userId !== session?.user.id)
    .map((member) => ({
      value: member.userId,
      label: `${member.name} (${ROLE_LABELS[member.role]})`,
    }));
  const chosen = candidates.find((candidate) => candidate.value === userId);

  const mutation = useMutation({
    mutationFn: async () => {
      await transferOwnershipApi(userId!);
      // Your role just changed to admin; get a login token that says so.
      await refreshSessionApi();
    },
    onSuccess: () => {
      refresh();
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      toast.success("Ownership transferred. You're now an admin.");
      setOpen(false);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Couldn't transfer ownership."));
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setUserId(null);
      }}
    >
      <DialogTrigger
        disabled={disabled}
        render={<Button variant="outline" className="h-9 px-4" />}
      >
        Transfer
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer ownership</DialogTitle>
          <DialogDescription>
            The person you choose becomes the owner and you become an admin.
            Only they can undo this.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="new-owner">New owner</Label>
          <Select
            items={candidates}
            value={userId}
            onValueChange={(value) => setUserId(value as string)}
          >
            <SelectTrigger id="new-owner" className="w-full data-[size=default]:h-9">
              <SelectValue placeholder="Choose a member" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="max-h-64!">
              {candidates.map((candidate) => (
                <SelectItem key={candidate.value} value={candidate.value}>
                  {candidate.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="h-9 px-4" />}>
            Cancel
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={!chosen || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="h-9 px-4"
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Transfer ownership
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
