"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { getPoliciesApi } from "@/lib/api/policies";
import {
  createServiceApi,
  createServiceWithDefaultPolicyApi,
  updateServiceApi,
  type Service,
} from "@/lib/api/services";
import { getTeamsApi } from "@/lib/api/teams";

const DEFAULT_POLICY = "DEFAULT";

// Creates a service, or edits one when `service` is given. In edit mode it
// is also the way in to deleting it.
export function ServiceFormDialog({
  service,
  onClose,
  onDelete,
}: {
  service?: Service;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [teamId, setTeamId] = useState<string | null>(service?.team.id ?? null);
  const [policyId, setPolicyId] = useState<string | null>(
    service?.escalationPolicy.id ?? DEFAULT_POLICY,
  );
  const [autoResolve, setAutoResolve] = useState(
    service?.autoResolveMinutes ? String(service.autoResolveMinutes) : "",
  );
  // Which field the message belongs under.
  const [error, setError] = useState<{
    field: "name" | "team" | "policy" | "autoResolve";
    message: string;
  } | null>(null);

  const { data: teams } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => (await getTeamsApi()).data.data,
  });
  const { data: policies } = useQuery({
    queryKey: ["policies"],
    queryFn: async () => (await getPoliciesApi()).data.data,
  });

  const teamItems = (teams ?? []).map((t) => ({ value: t.id, label: t.name }));
  // When creating, the first choice makes a simple policy for you: it
  // notifies everyone on the team. It can be edited afterwards.
  const policyItems = [
    ...(service ? [] : [{ value: DEFAULT_POLICY, label: "Create a default one" }]),
    ...(policies ?? []).map((p) => ({ value: p.id, label: p.name })),
  ];

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        teamId: teamId as string,
        escalationPolicyId: policyId as string,
        autoResolveMinutes: autoResolve === "" ? null : Number(autoResolve),
      };
      if (!service && policyId === DEFAULT_POLICY) {
        const created = await createServiceWithDefaultPolicyApi({
          name: body.name,
          teamId: body.teamId,
        });
        // The quick path only takes a name and a team; add the rest after.
        if (body.description || body.autoResolveMinutes) {
          await updateServiceApi(created.data.service.id, {
            description: body.description,
            autoResolveMinutes: body.autoResolveMinutes,
          });
        }
        return created.data.service;
      }

      const response = service
        ? await updateServiceApi(service.id, body)
        : await createServiceApi(body);
      return response.data;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["service", saved.id] });
      // Service counts on these pages have changed too.
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      toast.success(service ? "Service updated" : `${saved.name} created`);
      onClose();
      if (!service) router.push(`/services/${saved.id}`);
    },
    onError: (err) => {
      const message = getApiErrorMessage(err, "Couldn't save the service.");
      if (/team/i.test(message)) setError({ field: "team", message });
      else if (/policy/i.test(message)) setError({ field: "policy", message });
      else if (/name|already exists/i.test(message))
        setError({ field: "name", message });
      else toast.error(message);
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError({
        field: "name",
        message: "Service name must be at least 2 characters",
      });
      return;
    }
    if (!teamId) {
      setError({ field: "team", message: "Choose the team that owns it" });
      return;
    }
    if (!policyId) {
      setError({ field: "policy", message: "Choose an escalation policy" });
      return;
    }
    if (autoResolve !== "") {
      const minutes = Number(autoResolve);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 10080) {
        setError({
          field: "autoResolve",
          message: "Enter 1 to 10080 minutes (7 days), or leave it empty",
        });
        return;
      }
    }
    mutation.mutate();
  };

  const messageFor = (field: NonNullable<typeof error>["field"]) =>
    error?.field === field ? (
      <p className="text-sm text-destructive">{error.message}</p>
    ) : null;

  const loaded = teams !== undefined && policies !== undefined;
  // A service can't exist without both of these.
  const missing = loaded && teams.length === 0 && !service;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{service ? "Edit service" : "Add a service"}</DialogTitle>
          <DialogDescription>
            Something that can break: an API, a database, a website. Its alerts
            follow the escalation policy you pick.
          </DialogDescription>
        </DialogHeader>

        {missing ? (
          <div className="rounded-lg border border-black/[0.08] px-3.5 py-3 text-sm dark:border-white/[0.08]">
            <p className="font-medium text-foreground">
              A service needs a team
            </p>
            <p className="mt-1 text-muted-foreground">
              <Link
                href="/teams"
                className="text-foreground underline underline-offset-4"
              >
                Create a team
              </Link>{" "}
              first, then come back.
            </p>
          </div>
        ) : (
          <form id="service-form" onSubmit={submit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="service-name">Name</Label>
              <Input
                id="service-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="Checkout API"
                autoComplete="off"
                aria-invalid={error?.field === "name" ? true : undefined}
                className="h-9"
              />
              {messageFor("name")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-description">
                Description
                <span className="font-normal text-muted-foreground">optional</span>
              </Label>
              <textarea
                id="service-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="What it does, and who depends on it"
                className="w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="service-team">Team</Label>
                <Select
                  items={teamItems}
                  value={teamId}
                  onValueChange={(value) => {
                    setTeamId(value as string);
                    setError(null);
                  }}
                >
                  <SelectTrigger
                    id="service-team"
                    aria-invalid={error?.field === "team" ? true : undefined}
                    className="w-full min-w-0 data-[size=default]:h-9"
                  >
                    <SelectValue placeholder="Choose a team" />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false} className="max-h-60">
                    {teamItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {messageFor("team")}
              </div>

              <div className="space-y-2">
                <Label htmlFor="service-policy">Escalation policy</Label>
                <Select
                  items={policyItems}
                  value={policyId}
                  onValueChange={(value) => {
                    setPolicyId(value as string);
                    setError(null);
                  }}
                >
                  <SelectTrigger
                    id="service-policy"
                    aria-invalid={error?.field === "policy" ? true : undefined}
                    className="w-full min-w-0 data-[size=default]:h-9"
                  >
                    <SelectValue placeholder="Choose a policy" />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false} className="max-h-60">
                    {policyItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {messageFor("policy")}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-auto-resolve">
                Auto-resolve after
                <span className="font-normal text-muted-foreground">optional</span>
              </Label>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Input
                  id="service-auto-resolve"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10080}
                  value={autoResolve}
                  onChange={(e) => {
                    setAutoResolve(e.target.value);
                    setError(null);
                  }}
                  placeholder="Never"
                  aria-invalid={error?.field === "autoResolve" ? true : undefined}
                  className="h-9 w-28"
                />
                minutes
              </div>
              {messageFor("autoResolve") ?? (
                <p className="text-sm text-muted-foreground">
                  An incident nobody touches for this long closes itself. Leave
                  empty to keep incidents open.
                </p>
              )}
            </div>
          </form>
        )}

        {service && onDelete && (
          <div className="flex items-center justify-between gap-4 border-t border-black/[0.08] pt-4 dark:border-white/[0.08]">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Delete service
              </p>
              <p className="text-sm text-muted-foreground">
                Its team and policy are kept.
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
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="h-9 px-4" />}>
            {missing ? "Close" : "Cancel"}
          </DialogClose>
          {!missing && (
            <Button
              type="submit"
              form="service-form"
              disabled={!loaded || mutation.isPending}
              className="h-9 px-4"
            >
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {service ? "Save changes" : "Add service"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
