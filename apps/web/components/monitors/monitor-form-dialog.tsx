"use client";

import { useState } from "react";
import Link from "next/link";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  createMonitorApi,
  updateMonitorApi,
  type MonitorSummary,
} from "@/lib/api/monitors";
import { getServicesApi } from "@/lib/api/services";

const INTERVALS = [
  { value: "1", label: "Every minute" },
  { value: "5", label: "Every 5 minutes" },
  { value: "15", label: "Every 15 minutes" },
];

// Adds a monitor, or edits one when `monitor` is given.
export function MonitorFormDialog({
  monitor,
  onClose,
}: {
  monitor?: MonitorSummary;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const [name, setName] = useState(monitor?.name ?? "");
  const [url, setUrl] = useState(monitor?.url ?? "https://");
  const [interval, setInterval] = useState(String(monitor?.intervalMinutes ?? 5));
  const [serviceId, setServiceId] = useState<string | null>(
    monitor?.service.id ?? null,
  );
  // Which field the message belongs under.
  const [error, setError] = useState<{
    field: "name" | "url" | "service";
    message: string;
  } | null>(null);

  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: async () => (await getServicesApi()).data.data,
  });
  const serviceItems = (services ?? []).map((s) => ({ value: s.id, label: s.name }));

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        url: url.trim(),
        intervalMinutes: Number(interval),
        serviceId: serviceId as string,
      };
      return monitor
        ? (await updateMonitorApi(monitor.id, body)).data
        : (await createMonitorApi(body)).data;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
      queryClient.invalidateQueries({ queryKey: ["monitor", saved.id] });
      toast.success(monitor ? "Monitor saved" : `Now watching ${saved.name}`);
      onClose();
    },
    onError: (err) => {
      const message = getApiErrorMessage(err, "Couldn't save the monitor.");
      // The API's complaints are nearly all about the address.
      setError({ field: /name/i.test(message) ? "name" : "url", message });
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError({ field: "name", message: "Give it a name of at least 2 characters" });
      return;
    }
    if (!/^https?:\/\/.+/.test(url.trim())) {
      setError({
        field: "url",
        message: "Enter a full address, like https://example.com/health",
      });
      return;
    }
    if (!serviceId) {
      setError({ field: "service", message: "Choose the service this belongs to" });
      return;
    }
    mutation.mutate();
  };

  const messageFor = (field: NonNullable<typeof error>["field"]) =>
    error?.field === field ? (
      <p className="text-sm text-destructive">{error.message}</p>
    ) : null;

  const missing = services !== undefined && services.length === 0;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{monitor ? "Edit monitor" : "Add a monitor"}</DialogTitle>
          <DialogDescription>
            Vigil visits this address on a timer. If it fails twice in a row,
            an incident opens for the service you pick, and it closes by
            itself when the address answers again.
          </DialogDescription>
        </DialogHeader>

        {missing ? (
          <div className="rounded-lg border border-black/[0.08] px-3.5 py-3 text-sm dark:border-white/[0.08]">
            <p className="font-medium text-foreground">A monitor needs a service</p>
            <p className="mt-1 text-muted-foreground">
              <Link href="/services" className="text-foreground underline underline-offset-4">
                Add a service
              </Link>{" "}
              first, then come back.
            </p>
          </div>
        ) : (
          <form id="monitor-form" onSubmit={submit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="monitor-name">Name</Label>
              <Input
                id="monitor-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="Website"
                autoComplete="off"
                aria-invalid={error?.field === "name" ? true : undefined}
                className="h-9"
              />
              {messageFor("name")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="monitor-url">Address to check</Label>
              <Input
                id="monitor-url"
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError(null);
                }}
                placeholder="https://example.com/health"
                autoComplete="off"
                aria-invalid={error?.field === "url" ? true : undefined}
                className="h-9"
              />
              {messageFor("url") ?? (
                <p className="text-sm text-muted-foreground">
                  It counts as up when it answers within 10 seconds without an
                  error.
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="monitor-interval">How often</Label>
                <Select
                  items={INTERVALS}
                  value={interval}
                  onValueChange={(value) => setInterval(value as string)}
                >
                  <SelectTrigger id="monitor-interval" className="w-full min-w-0 data-[size=default]:h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {INTERVALS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="monitor-service">Service</Label>
                <Select
                  items={serviceItems}
                  value={serviceId}
                  onValueChange={(value) => {
                    setServiceId(value as string);
                    setError(null);
                  }}
                >
                  <SelectTrigger
                    id="monitor-service"
                    aria-invalid={error?.field === "service" ? true : undefined}
                    className="w-full min-w-0 data-[size=default]:h-9"
                  >
                    <SelectValue placeholder="Choose a service" />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false} className="max-h-60">
                    {serviceItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {messageFor("service")}
              </div>
            </div>
          </form>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="h-9 px-4" />}>
            {missing ? "Close" : "Cancel"}
          </DialogClose>
          {!missing && (
            <Button
              type="submit"
              form="monitor-form"
              disabled={services === undefined || mutation.isPending}
              className="h-9 px-4"
            >
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {monitor ? "Save changes" : "Add monitor"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
