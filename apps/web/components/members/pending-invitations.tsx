"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, MailIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  getInvitationsApi,
  revokeInvitationApi,
  type Invitation,
} from "@/lib/api/invitations";
import { expiresIn } from "@/lib/expires";
import { ROLE_LABELS } from "@/lib/roles";

// Invitations that were sent but not accepted yet. Only rendered for owners
// and admins (the API refuses everyone else). Hidden while there are none.
export function PendingInvitations() {
  const { data: invitations } = useQuery({
    queryKey: ["invitations"],
    queryFn: async () => (await getInvitationsApi()).data.data,
  });

  if (!invitations || invitations.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Pending invitations
        </h2>
        <p className="text-sm text-muted-foreground">
          People who&apos;ve been invited but haven&apos;t joined yet.
        </p>
      </div>

      <ul className="divide-y divide-black/[0.06] overflow-hidden rounded-xl border border-black/[0.08] dark:divide-white/[0.06] dark:border-white/[0.08]">
        {invitations.map((invitation) => (
          <InvitationRow key={invitation.id} invitation={invitation} />
        ))}
      </ul>
    </section>
  );
}

function InvitationRow({ invitation }: { invitation: Invitation }) {
  const queryClient = useQueryClient();

  const revoke = useMutation({
    mutationFn: () => revokeInvitationApi(invitation.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      toast.success(`Invitation to ${invitation.email} revoked`);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Couldn't revoke the invitation."));
    },
  });

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-black/20 text-muted-foreground dark:border-white/20">
        <MailIcon className="size-3.5" />
      </span>

      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate text-sm font-medium text-foreground">
          {invitation.email}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {ROLE_LABELS[invitation.role]} · invited by{" "}
          {invitation.invitedBy.name}
        </p>
      </div>

      <p className="text-xs whitespace-nowrap text-muted-foreground">
        {expiresIn(invitation.expiresAt)}
      </p>

      <Button
        variant="ghost"
        size="sm"
        disabled={revoke.isPending}
        onClick={() => revoke.mutate()}
        aria-label={`Revoke invitation to ${invitation.email}`}
        className="cursor-pointer text-muted-foreground hover:text-foreground"
      >
        {revoke.isPending && <Loader2 className="size-3.5 animate-spin" />}
        Revoke
      </Button>
    </li>
  );
}
