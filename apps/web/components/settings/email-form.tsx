"use client";

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
import { useAuth } from "@/context/auth-context";
import { getApiErrorMessage } from "@/lib/api/errors";
import { changeEmailApi, type Profile } from "@/lib/api/users";

const emailFormSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: "Enter a valid email address" }),
  currentPassword: z.string().min(1, { message: "Enter your current password" }),
});

type EmailFormValues = z.infer<typeof emailFormSchema>;

// Changes the address you sign in with. The password is asked for so that
// someone who finds your laptop open can't take the account over.
export function EmailForm({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const { refresh } = useAuth();

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: { email: "", currentPassword: "" },
  });

  const mutation = useMutation({
    mutationFn: async (values: EmailFormValues) => (await changeEmailApi(values)).data,
    onSuccess: (updated) => {
      queryClient.setQueryData(["profile"], updated);
      refresh();
      form.reset({ email: "", currentPassword: "" });
      toast.success(`Email changed to ${updated.email}`);
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "Couldn't change your email.");
      if (message === "Current password is incorrect") {
        form.setError("currentPassword", { message }, { shouldFocus: true });
      } else {
        form.setError("email", { message }, { shouldFocus: true });
      }
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
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" className="h-9" {...field} />
              </FormControl>
              <FormDescription>
                You sign in with {profile.email} now. Incident emails go to
                the new address as soon as you save.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  className="h-9"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={mutation.isPending} className="h-9 px-4">
          {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
          Change email
        </Button>
      </form>
    </Form>
  );
}
