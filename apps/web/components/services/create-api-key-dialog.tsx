"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckIcon, CopyIcon, Loader2 } from "lucide-react";

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
import { createApiKeyApi, type CreatedApiKey } from "@/lib/api/services";

// Two steps in one dialog: name the key, then see it. The key is shown
// here once and can't be fetched again, so the second step says so.
export function CreateApiKeyDialog({
  serviceId,
  onClose,
}: {
  serviceId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => (await createApiKeyApi(serviceId, name.trim())).data,
    onSuccess: (key) => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", serviceId] });
      setCreated(key);
    },
    onError: (error) => {
      setNameError(getApiErrorMessage(error, "Couldn't create the key."));
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setNameError("Key name must be at least 2 characters");
      return;
    }
    mutation.mutate();
  };

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the key and copy it by hand.");
    }
  };

  // Alerts go to the same address the app is on, under /api.
  const alertsUrl =
    typeof window === "undefined" ? "/api/alerts" : `${window.location.origin}/api/alerts`;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Copy your key now</DialogTitle>
              <DialogDescription>
                This is the only time {created.name} is shown. Vigil keeps a
                fingerprint of it, not the key itself, so it can&apos;t be
                shown again.
              </DialogDescription>
            </DialogHeader>

            <div className="flex min-w-0 items-center gap-2">
              <code className="min-w-0 flex-1 rounded-lg border border-black/[0.08] bg-black/[0.03] px-3 py-2 font-mono text-xs break-all text-foreground select-all dark:border-white/[0.08] dark:bg-white/[0.04]">
                {created.key}
              </code>
              <Button
                type="button"
                variant="outline"
                onClick={copy}
                className="h-9 shrink-0 px-3"
              >
                {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>

            <div className="min-w-0 space-y-2">
              <p className="text-sm text-muted-foreground">
                Send a test alert with it:
              </p>
              <pre className="rounded-lg break-all whitespace-pre-wrap bg-black/[0.04] p-3 font-mono text-xs leading-relaxed text-zinc-700 dark:bg-white/[0.04] dark:text-zinc-300">
{`curl -X POST ${alertsUrl} \\
  -H "X-Vigil-Key: ${created.key}" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "Test alert", "severity": "low"}'`}
              </pre>
            </div>

            <DialogFooter>
              <Button onClick={onClose} className="h-9 px-4">
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Create an API key</DialogTitle>
              <DialogDescription>
                A monitoring tool or script uses the key to send alerts for
                this service.
              </DialogDescription>
            </DialogHeader>

            <form id="create-key" onSubmit={submit} className="space-y-2" noValidate>
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(null);
                }}
                placeholder="Sentry production"
                autoComplete="off"
                aria-invalid={nameError ? true : undefined}
                className="h-9"
              />
              {nameError ? (
                <p className="text-sm text-destructive">{nameError}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Where the key will be used, so you can tell keys apart later.
                </p>
              )}
            </form>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" className="h-9 px-4" />}>
                Cancel
              </DialogClose>
              <Button
                type="submit"
                form="create-key"
                disabled={mutation.isPending}
                className="h-9 px-4"
              >
                {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Create key
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
