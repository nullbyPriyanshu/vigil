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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api/errors";
import { deleteOrganizationApi } from "@/lib/api/organization";

export function DeleteOrganizationDialog({ name }: { name: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const mutation = useMutation({
    mutationFn: () => deleteOrganizationApi(typed),
    onSuccess: () => {
      // The backend already cleared the session cookies; drop everything
      // cached from the deleted organization too.
      queryClient.clear();
      router.replace("/login");
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Couldn't delete the organization."),
      );
    },
  });

  const matches = typed === name;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTyped("");
      }}
    >
      <DialogTrigger render={<Button variant="destructive" className="h-9 px-4" />}>
        Delete organization
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {name}?</DialogTitle>
          <DialogDescription>
            This permanently deletes the organization and everything in it,
            and removes every member&apos;s access. It can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>

        <form
          id="delete-organization"
          onSubmit={(e) => {
            e.preventDefault();
            if (matches) mutation.mutate();
          }}
          className="space-y-2"
        >
          <Label htmlFor="confirm-name" className="font-normal">
            <span>
              Type <span className="font-medium select-all">{name}</span> to
              confirm
            </span>
          </Label>
          <Input
            id="confirm-name"
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
            form="delete-organization"
            variant="destructive"
            disabled={!matches || mutation.isPending}
            className="h-9 px-4"
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Delete organization
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
