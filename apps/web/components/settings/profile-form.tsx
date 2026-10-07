"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/auth-context";
import { updateProfileApi, type Profile } from "@/lib/api/users";
import { getApiErrorMessage } from "@/lib/api/errors";

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Name must be at least 2 characters" })
    .max(100, { message: "Name must be at most 100 characters" }),
  timezone: z.string().min(1, { message: "Pick a timezone" }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

function offsetLabel(timeZone: string) {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  })
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? "";
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const { refresh } = useAuth();

  const timezones = useMemo(() => {
    const all = Intl.supportedValuesOf("timeZone");
    if (!all.includes(profile.timezone)) all.unshift(profile.timezone);
    return all.map((tz) => ({ value: tz, label: `${tz.replaceAll("_", " ")} (${offsetLabel(tz)})` }));
  }, [profile.timezone]);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: { name: profile.name, timezone: profile.timezone },
  });

  const mutation = useMutation({
    mutationFn: async (values: ProfileFormValues) =>
      (await updateProfileApi(values)).data,
    onSuccess: (updated) => {
      queryClient.setQueryData(["profile"], updated);
      refresh();
      toast.success("Profile updated");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Couldn't update your profile."));
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="space-y-5"
        noValidate
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input autoComplete="name" className="h-9" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <Label htmlFor="profile-email">Email</Label>
          <Input
            id="profile-email"
            value={profile.email}
            readOnly
            disabled
            className="h-9"
          />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Used to sign in. Change it under Email, below.
          </p>
        </div>

        <FormField
          control={form.control}
          name="timezone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Timezone</FormLabel>
              <Select
                items={timezones}
                value={field.value}
                onValueChange={(value) => field.onChange(value)}
              >
                <FormControl>
                  <SelectTrigger className="w-full data-[size=default]:h-9">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent alignItemWithTrigger={false} className="max-h-64!">
                  {timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Shift times and alerts are shown in this timezone.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center gap-3 pt-1">
          <Button
            type="submit"
            disabled={!form.formState.isDirty || mutation.isPending}
            className="h-9 px-4"
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </Button>
          {form.formState.isDirty && !mutation.isPending && (
            <button
              type="button"
              onClick={() => form.reset()}
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </Form>
  );
}
