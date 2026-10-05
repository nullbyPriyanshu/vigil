"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PencilIcon } from "lucide-react";

import { InviteMemberDialog } from "@/components/members/invite-member-dialog";
import { ManageMemberDialog } from "@/components/members/manage-member-dialog";
import { PendingInvitations } from "@/components/members/pending-invitations";
import { RemoveMemberDialog } from "@/components/members/remove-member-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/context/auth-context";
import { getMembersApi, type Member } from "@/lib/api/members";
import { ROLE_LABELS, canManageMembers } from "@/lib/roles";

export default function MembersPage() {
  const { session } = useAuth();
  const { data: members, isLoading } = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await getMembersApi()).data.data,
  });

  // Which member each dialog is open for. Only one is open at a time:
  // "Remove" in the manage dialog closes it and opens the confirmation.
  const [managing, setManaging] = useState<Member | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);

  const canManage = canManageMembers(session?.role);

  // The owner can't be edited here, and nobody can edit themselves.
  const isEditable = (member: Member) =>
    canManage && member.role !== "OWNER" && member.userId !== session?.user.id;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Members"
        description="Everyone in your organization and what they're allowed to do."
        action={canManage ? <InviteMemberDialog /> : undefined}
      />

      <div className="overflow-hidden rounded-xl border border-black/[0.08] dark:border-white/[0.08]">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-10 px-4 text-xs font-medium text-muted-foreground">
                Member
              </TableHead>
              <TableHead className="hidden h-10 px-4 text-xs font-medium text-muted-foreground sm:table-cell">
                Role
              </TableHead>
              <TableHead className="hidden h-10 px-4 text-xs font-medium text-muted-foreground md:table-cell">
                Timezone
              </TableHead>
              <TableHead className="hidden h-10 px-4 text-xs font-medium text-muted-foreground sm:table-cell">
                Joined
              </TableHead>
              <TableHead className="h-10 w-12 px-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading || !members
              ? [0, 1, 2].map((i) => (
                  <TableRow key={i} className="hover:bg-transparent">
                    <TableCell colSpan={5} className="px-4 py-3">
                      <Skeleton className="h-9 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              : members.map((member) => (
                  <TableRow key={member.userId} className="last:border-b-0">
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          name={member.name}
                          className="size-8 text-[11px]"
                        />
                        <div className="max-w-44 min-w-0 sm:max-w-none">
                          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <span className="truncate">{member.name}</span>
                            {member.userId === session?.user.id && (
                              <span className="text-xs font-normal text-muted-foreground">
                                You
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            <span className="sm:hidden">
                              {ROLE_LABELS[member.role]} ·{" "}
                            </span>
                            {member.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden px-4 py-3 text-sm text-zinc-700 sm:table-cell dark:text-zinc-300">
                      {ROLE_LABELS[member.role]}
                    </TableCell>
                    <TableCell className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">
                      {member.timezone.replaceAll("_", " ")}
                    </TableCell>
                    <TableCell className="hidden px-4 py-3 text-sm text-muted-foreground sm:table-cell">
                      {new Date(member.joinedAt).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      {isEditable(member) && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Manage ${member.name}`}
                          onClick={() => setManaging(member)}
                          className="cursor-pointer text-muted-foreground hover:text-foreground"
                        >
                          <PencilIcon className="size-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      {members && (
        <p className="text-sm text-muted-foreground">
          {members.length} {members.length === 1 ? "member" : "members"}
          {!canManage && " · Only owners and admins can make changes."}
        </p>
      )}

      {canManage && <PendingInvitations />}

      {managing && (
        <ManageMemberDialog
          key={managing.userId}
          member={managing}
          onClose={() => setManaging(null)}
          onRemove={() => {
            setRemoving(managing);
            setManaging(null);
          }}
        />
      )}
      {removing && (
        <RemoveMemberDialog
          key={removing.userId}
          member={removing}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
