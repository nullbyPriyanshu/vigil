"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  StepEditor,
  type StepDraft,
} from "@/components/policies/step-editor";
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
import { getMembersApi } from "@/lib/api/members";
import {
  createPolicyApi,
  updatePolicyApi,
  type Policy,
  type StepInput,
} from "@/lib/api/policies";
import { getSchedulesApi } from "@/lib/api/schedules";
import { getTeamsApi } from "@/lib/api/teams";

const REPEAT_ITEMS = [
  { value: 0, label: "Don't repeat" },
  { value: 1, label: "Repeat once" },
  ...[2, 3, 4, 5, 6, 7, 8, 9, 10].map((count) => ({
    value: count,
    label: `Repeat ${count} times`,
  })),
];

const BLANK_STEP: StepDraft = {
  key: 1,
  targetType: "USER",
  targetId: "",
  delayMinutes: "5",
};

// Creates a policy, or edits one when `policy` is given. In edit mode it is
// also the way in to deleting it.
export function PolicyFormDialog({
  policy,
  onClose,
  onDelete,
}: {
  policy?: Policy;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState(policy?.name ?? "");
  const [repeatCount, setRepeatCount] = useState(policy?.repeatCount ?? 0);
  const [steps, setSteps] = useState<StepDraft[]>(
    policy
      ? policy.steps.map((step) => ({
          key: step.position,
          targetType: step.targetType,
          targetId: step.target.id,
          delayMinutes: String(step.delayMinutes),
        }))
      : [BLANK_STEP],
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const [stepsError, setStepsError] = useState<string | null>(null);

  const { data: members } = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await getMembersApi()).data.data,
  });
  const { data: teams } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => (await getTeamsApi()).data.data,
  });

  const { data: schedules } = useQuery({
    queryKey: ["schedules"],
    queryFn: async () => (await getSchedulesApi()).data.data,
  });

  // Viewers can't respond to incidents, so they can't be notified.
  const people = (members ?? [])
    .filter((member) => member.role !== "VIEWER")
    .map((member) => ({ value: member.userId, label: member.name }));
  const teamOptions = (teams ?? []).map((team) => ({
    value: team.id,
    label: team.name,
  }));
  const scheduleOptions = (schedules ?? []).map((schedule) => ({
    value: schedule.id,
    label: schedule.name,
  }));
  const optionsFor = {
    USER: people,
    TEAM: teamOptions,
    SCHEDULE: scheduleOptions,
  };
  const WORDS = { USER: "person", TEAM: "team", SCHEDULE: "schedule" };

  const mutation = useMutation({
    mutationFn: async (stepInputs: StepInput[]) => {
      const body = { name: name.trim(), repeatCount, steps: stepInputs };
      const response = policy
        ? await updatePolicyApi(policy.id, body)
        : await createPolicyApi(body);
      return response.data;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      queryClient.invalidateQueries({ queryKey: ["policy", saved.id] });
      toast.success(policy ? "Policy updated" : `${saved.name} created`);
      onClose();
      if (!policy) router.push(`/policies/${saved.id}`);
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "Couldn't save the policy.");
      if (/name|already exists/i.test(message)) setNameError(message);
      else setStepsError(message);
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setNameError("Policy name must be at least 2 characters");
      return;
    }

    const stepInputs: StepInput[] = [];
    for (const [index, step] of steps.entries()) {
      const options = optionsFor[step.targetType];
      if (!options.some((option) => option.value === step.targetId)) {
        setStepsError(
          `Step ${index + 1}: choose a ${WORDS[step.targetType]} to notify`,
        );
        return;
      }
      const delay = Number(step.delayMinutes);
      if (!Number.isInteger(delay) || delay < 1 || delay > 1440) {
        setStepsError(
          `Step ${index + 1}: the wait must be between 1 and 1440 minutes`,
        );
        return;
      }
      stepInputs.push({
        position: index + 1,
        delayMinutes: delay,
        targetType: step.targetType,
        targetId: step.targetId,
      });
    }

    mutation.mutate(stepInputs);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {policy ? "Edit policy" : "Create an escalation policy"}
          </DialogTitle>
          <DialogDescription>
            Who gets notified about an incident, in order, and how long each
            step waits before the next one.
          </DialogDescription>
        </DialogHeader>

        <form id="policy-form" onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="policy-name">Name</Label>
            <Input
              id="policy-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(null);
              }}
              placeholder="Payments on-call"
              autoComplete="off"
              aria-invalid={nameError ? true : undefined}
              className="h-9"
            />
            {nameError && (
              <p className="text-sm text-destructive">{nameError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Steps</Label>
            {members && teams && schedules ? (
              <StepEditor
                steps={steps}
                onChange={(next) => {
                  setSteps(next);
                  setStepsError(null);
                }}
                people={people}
                teams={teamOptions}
                schedules={scheduleOptions}
              />
            ) : (
              <div className="h-28 animate-pulse rounded-lg bg-black/[0.04] dark:bg-white/[0.04]" />
            )}
            {stepsError && (
              <p className="text-sm text-destructive">{stepsError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="policy-repeat">After the last step</Label>
            <Select
              items={REPEAT_ITEMS}
              value={repeatCount}
              onValueChange={(value) => setRepeatCount(value as number)}
            >
              <SelectTrigger
                id="policy-repeat"
                className="w-full data-[size=default]:h-9"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} className="max-h-60">
                {REPEAT_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              If nobody has responded, start again from step 1 this many times.
            </p>
          </div>
        </form>

        {policy && onDelete && (
          <div className="flex items-center justify-between gap-4 border-t border-black/[0.08] pt-4 dark:border-white/[0.08]">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Delete policy
              </p>
              <p className="text-sm text-muted-foreground">
                Only possible when no service uses it.
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
            Cancel
          </DialogClose>
          <Button
            type="submit"
            form="policy-form"
            disabled={mutation.isPending}
            className="h-9 px-4"
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {policy ? "Save changes" : "Create policy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
