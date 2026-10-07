"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/lib/api/errors";
import { updateProfileApi, type Profile } from "@/lib/api/users";
import { cn } from "@/lib/utils";

// One switch: whether Vigil emails you when an incident pages you.
export function NotificationsForm({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (emailNotifications: boolean) =>
      (await updateProfileApi({ emailNotifications })).data,
    onSuccess: (updated) => {
      queryClient.setQueryData(["profile"], updated);
      toast.success(
        updated.emailNotifications
          ? "Incident emails turned on"
          : "Incident emails turned off",
      );
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Couldn't save that.")),
  });

  // Show the new position straight away while it saves.
  const on = mutation.isPending
    ? mutation.variables
    : profile.emailNotifications;

  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <p id="email-pages-label" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Email me when I&apos;m paged
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          {on
            ? "You get an email with Acknowledge and Resolve buttons."
            : "You won't be emailed. Incidents meant for you escalate to the next step when their timer runs out."}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="email-pages-label"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate(!on)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          on ? "bg-emerald-500" : "bg-black/15 dark:bg-white/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-5 rounded-full transition-transform duration-200",
            on
              ? "translate-x-5 bg-(--brand-foreground)"
              : "bg-white dark:bg-zinc-300",
          )}
        />
      </button>
    </div>
  );
}
