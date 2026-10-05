"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, UserPlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api/errors";
import { createInvitationApi } from "@/lib/api/invitations";
import {
  ASSIGNABLE_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type AssignableRole,
} from "@/lib/roles";

const ROLE_ITEMS = ASSIGNABLE_ROLES.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}));

const inviteSchema = z.object({
  email: z.string().trim().email({ message: "Enter a valid email address" }),
  role: z.enum(ASSIGNABLE_ROLES),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

const EMPTY: InviteFormValues = { email: "", role: "RESPONDER" };

export function InviteMemberDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: EMPTY,
  });

  const mutation = useMutation({
    mutationFn: async (values: InviteFormValues) =>
      (await createInvitationApi(values.email, values.role)).data,
    onSuccess: (result, values) => {
      if ("alreadyMember" in result) {
        toast.info(`${values.email} is already a member`);
      } else {
        queryClient.invalidateQueries({ queryKey: ["invitations"] });
        toast.success(`Invitation sent to ${result.email}`);
      }
      setOpen(false);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Couldn't send the invitation."));
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) form.reset(EMPTY);
      }}
    >
      <DialogTrigger render={<Button className="h-9 px-3.5" />}>
        <UserPlusIcon className="size-4" />
        Invite member
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a member</DialogTitle>
          <DialogDescription>
            We&apos;ll email them a link to join. It works for 7 days.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="invite-member"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="space-y-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="teammate@example.com"
                      autoComplete="off"
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
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select
                    items={ROLE_ITEMS}
                    value={field.value}
                    onValueChange={(value) =>
                      field.onChange(value as AssignableRole)
                    }
                  >
                    <FormControl>
                      <SelectTrigger className="w-full data-[size=default]:h-9">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      {ROLE_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {ROLE_DESCRIPTIONS[field.value]}
                  </p>
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="h-9 px-4" />}>
            Cancel
          </DialogClose>
          <Button
            type="submit"
            form="invite-member"
            disabled={mutation.isPending}
            className="h-9 px-4"
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Send invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
