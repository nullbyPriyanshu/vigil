"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api/errors";
import { deleteAccountApi } from "@/lib/api/users";

// Deletes your own account for good. An organization you own alone goes
// with it; the API refuses if you own one that has other members.
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => (await deleteAccountApi(password)).data,
    onSuccess: () => {
      // A full page load, so nothing of the old session stays in memory.
      window.location.assign("/");
    },
    onError: (err) => setError(getApiErrorMessage(err, "Couldn't delete your account.")),
  });

  const close = () => {
    setOpen(false);
    setPassword("");
    setError("");
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-9 border-red-500/30 px-4 text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400"
      >
        Delete my account
      </Button>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              You are removed from every team, schedule and organization, and
              an organization that only you are in is deleted too. Incidents
              you worked on elsewhere stay, without your name. This can&apos;t
              be undone.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              setError("");
              mutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="delete-account-password">Your password</Label>
              <Input
                id="delete-account-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={error ? true : undefined}
                className="h-9"
              />
              {error && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} className="h-9 px-4">
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={password === "" || mutation.isPending}
                className="h-9 px-4"
              >
                {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Delete account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
