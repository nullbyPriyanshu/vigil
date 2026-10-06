"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { isAxiosError } from "axios";
import { useMutation } from "@tanstack/react-query";
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

// The "type its name to confirm" step before deleting something for good.
// The parent says what's being deleted and how; this handles the typing,
// the request and the error.
export function ConfirmDeleteDialog({
  name,
  title,
  description,
  actionLabel,
  onDelete,
  onDeleted,
  onClose,
}: {
  // What the user has to type, e.g. the policy's name.
  name: string;
  // Defaults to "Delete <name>?".
  title?: string;
  description: ReactNode;
  actionLabel: string;
  onDelete: () => Promise<unknown>;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  // Set when the API refuses because other things still depend on this one
  // (a 409). Shown in the dialog, since it tells the user what to fix.
  const [blocked, setBlocked] = useState<{
    message: string;
    items: string[];
  } | null>(null);

  const mutation = useMutation({
    mutationFn: onDelete,
    onSuccess: onDeleted,
    onError: (error) => {
      const message = getApiErrorMessage(error, "Couldn't delete it.");
      if (isAxiosError(error) && error.response?.status === 409) {
        // e.g. { message: "Policy is used by 2 services", services: [...] }
        const data = error.response.data as Record<string, unknown>;
        const list = Object.values(data).find(Array.isArray) as
          | { name?: string }[]
          | undefined;
        setBlocked({
          message,
          items: (list ?? []).map((item) => item.name ?? "").filter(Boolean),
        });
      } else {
        toast.error(message);
      }
    },
  });

  const matches = typed.trim() === name;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title ?? `Delete ${name}?`}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {blocked ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-sm">
            <p className="font-medium text-foreground">{blocked.message}</p>
            {blocked.items.length > 0 && (
              <p className="mt-1 text-muted-foreground">
                Move or delete these first: {blocked.items.join(", ")}.
              </p>
            )}
          </div>
        ) : (
          <form
            id="confirm-delete"
            onSubmit={(e) => {
              e.preventDefault();
              if (matches) mutation.mutate();
            }}
            className="space-y-2"
          >
            <Label htmlFor="confirm-delete-name" className="font-normal">
              <span>
                Type <span className="font-medium select-all">{name}</span> to
                confirm
              </span>
            </Label>
            <Input
              id="confirm-delete-name"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="h-9"
            />
          </form>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="h-9 px-4" />}>
            {blocked ? "Close" : "Cancel"}
          </DialogClose>
          {!blocked && (
            <Button
              type="submit"
              form="confirm-delete"
              variant="destructive"
              disabled={!matches || mutation.isPending}
              className="h-9 px-4"
            >
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {actionLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
