"use client";

import { ArrowDownIcon, ArrowUpIcon, PlusIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// A step while it's being edited. `key` only keeps React's list stable;
// the position sent to the API is the step's place in the array.
export type StepDraft = {
  key: number;
  targetType: "USER" | "TEAM";
  targetId: string;
  delayMinutes: string;
};

export type TargetOption = { value: string; label: string };

const TYPE_ITEMS = [
  { value: "USER", label: "Person" },
  { value: "TEAM", label: "Team" },
];

export const MAX_STEPS = 20;

export function StepEditor({
  steps,
  onChange,
  people,
  teams,
}: {
  steps: StepDraft[];
  onChange: (steps: StepDraft[]) => void;
  people: TargetOption[];
  teams: TargetOption[];
}) {
  const update = (key: number, changes: Partial<StepDraft>) =>
    onChange(
      steps.map((step) => (step.key === key ? { ...step, ...changes } : step)),
    );

  const move = (index: number, by: -1 | 1) => {
    const next = [...steps];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(next);
  };

  const add = () =>
    onChange([
      ...steps,
      {
        key: Math.max(0, ...steps.map((step) => step.key)) + 1,
        targetType: "USER",
        targetId: "",
        delayMinutes: "5",
      },
    ]);

  return (
    <div className="space-y-2">
      <ol className="space-y-2">
        {steps.map((step, index) => {
          const options = step.targetType === "USER" ? people : teams;
          // A person or team that has since been removed isn't in the list.
          const known = options.some((o) => o.value === step.targetId);

          return (
            <li
              key={step.key}
              className="rounded-lg border border-black/[0.08] p-3 dark:border-white/[0.08]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Step {index + 1}
                </span>
                <div className="flex items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    aria-label={`Move step ${index + 1} up`}
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === steps.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={`Move step ${index + 1} down`}
                  >
                    <ArrowDownIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={steps.length === 1}
                    onClick={() =>
                      onChange(steps.filter((s) => s.key !== step.key))
                    }
                    aria-label={`Remove step ${index + 1}`}
                  >
                    <XIcon />
                  </Button>
                </div>
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-[7.5rem_1fr]">
                <Select
                  items={TYPE_ITEMS}
                  value={step.targetType}
                  onValueChange={(value) =>
                    update(step.key, {
                      targetType: value as StepDraft["targetType"],
                      targetId: "",
                    })
                  }
                >
                  <SelectTrigger
                    aria-label={`Step ${index + 1} notifies a`}
                    className="w-full data-[size=default]:h-9"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {TYPE_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  items={options}
                  value={known ? step.targetId : null}
                  onValueChange={(value) =>
                    update(step.key, { targetId: (value as string) ?? "" })
                  }
                >
                  <SelectTrigger
                    aria-label={`Step ${index + 1} target`}
                    className="w-full min-w-0 data-[size=default]:h-9"
                  >
                    <SelectValue
                      placeholder={
                        step.targetType === "USER"
                          ? "Choose a person"
                          : "Choose a team"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false} className="max-h-60">
                    {options.length === 0 ? (
                      <p className="px-2 py-1.5 text-sm text-muted-foreground">
                        {step.targetType === "USER"
                          ? "No one to pick yet"
                          : "No teams yet"}
                      </p>
                    ) : (
                      options.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <label className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {index === steps.length - 1
                  ? "Wait for a response for"
                  : "If nobody responds, go to the next step after"}
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={1440}
                  value={step.delayMinutes}
                  onChange={(e) =>
                    update(step.key, { delayMinutes: e.target.value })
                  }
                  aria-label={`Step ${index + 1} wait in minutes`}
                  className="h-8 w-20"
                />
                minutes
              </label>
            </li>
          );
        })}
      </ol>

      {steps.length < MAX_STEPS && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          className="cursor-pointer"
        >
          <PlusIcon className="size-3.5" />
          Add step
        </Button>
      )}
    </div>
  );
}
