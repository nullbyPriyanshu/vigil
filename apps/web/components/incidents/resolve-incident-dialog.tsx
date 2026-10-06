"use client";

import { useState } from "react";
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
import { Label } from "@/components/ui/label";

// Asks for an optional note before resolving. The page does the request.
export function ResolveIncidentDialog({
  number,
  pending,
  onResolve,
  onClose,
}: {
  number: number;
  pending: boolean;
  onResolve: (note?: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resolve INC-{number}?</DialogTitle>
          <DialogDescription>
            Marks the problem as fixed. If the same alert comes in again, it
            opens a new incident.
          </DialogDescription>
        </DialogHeader>

        <form
          id="resolve-incident"
          onSubmit={(e) => {
            e.preventDefault();
            onResolve(note.trim() || undefined);
          }}
          className="space-y-2"
        >
          <Label htmlFor="resolve-note">
            What fixed it?
            <span className="font-normal text-muted-foreground">optional</span>
          </Label>
          <textarea
            id="resolve-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Pool size increased"
            className="w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
          />
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="h-9 px-4" />}>
            Cancel
          </DialogClose>
          <Button
            type="submit"
            form="resolve-incident"
            disabled={pending}
            className="h-9 px-4"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Resolve incident
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
