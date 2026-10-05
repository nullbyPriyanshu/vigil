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
import {
  updateOrganizationApi,
  type Organization,
} from "@/lib/api/organization";

// Same rules as the backend (updateOrganization.dto.ts).
const organizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Name must be at least 2 characters" })
    .max(100, { message: "Name must be at most 100 characters" }),
  slug: z
    .string()
    .trim()
    .min(2, { message: "Slug must be at least 2 characters" })
    .max(50, { message: "Slug must be at most 50 characters" })
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
      message: "Use lowercase letters, numbers and single hyphens only",
    }),
});

type OrganizationFormValues = z.infer<typeof organizationSchema>;

export function OrganizationForm({
  organization,
  canEdit,
}: {
  organization: Organization;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const { refresh } = useAuth();

  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationSchema),
    values: { name: organization.name, slug: organization.slug },
  });

  const mutation = useMutation({
    mutationFn: async (values: OrganizationFormValues) => {
      // Only send what actually changed.
      const changes: { name?: string; slug?: string } = {};
      if (values.name !== organization.name) changes.name = values.name;
      if (values.slug !== organization.slug) changes.slug = values.slug;
      return (await updateOrganizationApi(changes)).data;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["organization"], updated);
      refresh();
      toast.success("Organization updated");
    },
    onError: (error) => {
      const message = getApiErrorMessage(
        error,
        "Couldn't update the organization.",
      );
      // Show "already taken" errors under the field they belong to.
      if (message.toLowerCase().includes("slug")) {
        form.setError("slug", { message }, { shouldFocus: true });
      } else if (message.toLowerCase().includes("name")) {
        form.setError("name", { message }, { shouldFocus: true });
      } else {
        toast.error(message);
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
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  autoComplete="organization"
                  disabled={!canEdit}
                  className="h-9"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug</FormLabel>
              <FormControl>
                <Input
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={!canEdit}
                  className="h-9 font-mono"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                A short, unique identifier for your organization. Lowercase
                letters, numbers and hyphens.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {canEdit ? (
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
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Only owners and admins can change these.
          </p>
        )}
      </form>
    </Form>
  );
}
