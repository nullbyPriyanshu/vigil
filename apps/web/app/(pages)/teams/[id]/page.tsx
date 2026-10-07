"use client";

import { use, useState } from "react";
import Link from "next/link";
import { isAxiosError } from "axios";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, PencilIcon, UsersIcon } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { UserAvatar } from "@/components/shared/user-avatar";
import { DeleteTeamDialog } from "@/components/teams/delete-team-dialog";
import { EditTeamDialog } from "@/components/teams/edit-team-dialog";
import { ManageTeamMembersDialog } from "@/components/teams/manage-team-members-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { getTeamApi } from "@/lib/api/teams";
import { ROLE_LABELS, canManageMembers } from "@/lib/roles";

// Which dialog is open, if any. Only ever one at a time: "Delete" in the
// edit dialog closes it and opens the confirmation.
type OpenDialog = "edit" | "delete" | "members" | null;

export default function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { session } = useAuth();
  const [dialog, setDialog] = useState<OpenDialog>(null);

  const { data: team, error, isLoading, refetch } = useQuery({
    queryKey: ["team", id],
    queryFn: async () => (await getTeamApi(id)).data,
    retry: false,
  });

  const canManage = canManageMembers(session?.role);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  if (!team) {
    // 404 (deleted, or never in this organization) and 400 (not a real id)
    // both mean there's nothing to show.
    const status = isAxiosError(error) ? error.response?.status : undefined;
    const missing = status === 404 || status === 400;
    return (
      <div className="flex flex-col gap-6">
        <BackToTeams />
        <div className="rounded-xl border border-dashed border-black/15 px-6 py-16 text-center dark:border-white/15">
          <p className="text-sm font-medium text-foreground">
            {missing ? "Team not found" : "Couldn't load this team"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {missing
              ? "It may have been deleted, or the link is wrong."
              : "Please try again in a moment."}
          </p>
          {!missing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="mt-4"
            >
              Try again
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <BackToTeams />

      <PageHeader
        title={team.name}
        description={`${team.members.length} ${team.members.length === 1 ? "member" : "members"} · ${team.services.length} ${team.services.length === 1 ? "service" : "services"} · ${team.schedules.length} ${team.schedules.length === 1 ? "schedule" : "schedules"}`}
        action={
          canManage ? (
            <Button
              variant="outline"
              onClick={() => setDialog("edit")}
              className="h-9 cursor-pointer px-3.5"
            >
              <PencilIcon className="size-3.5" />
              Edit team
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          {canManage && (
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDialog("members")}
                className="cursor-pointer"
              >
                <UsersIcon className="size-3.5" />
                Manage members
              </Button>
            </CardAction>
          )}
        </CardHeader>

        {team.members.length === 0 ? (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Nobody is on this team yet.
              {canManage && " Use Manage members to add people."}
            </p>
          </CardContent>
        ) : (
          <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
            {team.members.map((member) => (
              <li
                key={member.userId}
                className="flex items-center gap-3 px-(--card-spacing) py-3"
              >
                <UserAvatar name={member.name} className="size-8 text-[11px]" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <span className="truncate">{member.name}</span>
                    {member.userId === session?.user.id && (
                      <span className="text-xs font-normal text-muted-foreground">
                        You
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.email}
                  </p>
                </div>
                <span className="shrink-0 text-sm text-zinc-700 dark:text-zinc-300">
                  {ROLE_LABELS[member.role]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <LinkedList
          title="Services"
          items={team.services}
          hrefPrefix="/services"
          empty="No services belong to this team yet."
        />
        <LinkedList
          title="Schedules"
          items={team.schedules}
          hrefPrefix="/schedules"
          empty="No on-call schedules belong to this team yet."
        />
      </div>

      {dialog === "edit" && (
        <EditTeamDialog
          team={team}
          onClose={() => setDialog(null)}
          onDelete={() => setDialog("delete")}
        />
      )}
      {dialog === "delete" && (
        <DeleteTeamDialog team={team} onClose={() => setDialog(null)} />
      )}
      {dialog === "members" && (
        <ManageTeamMembersDialog team={team} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function BackToTeams() {
  return (
    <Link
      href="/teams"
      className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-emerald-400/60"
    >
      <ArrowLeftIcon className="size-3.5" />
      Teams
    </Link>
  );
}

// The team's services, and its schedules: the same simple list either way.
function LinkedList({
  title,
  items,
  hrefPrefix,
  empty,
}: {
  title: string;
  items: { id: string; name: string }[];
  hrefPrefix: string;
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      {items.length === 0 ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">{empty}</p>
        </CardContent>
      ) : (
        <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`${hrefPrefix}/${item.id}`}
                className="block px-(--card-spacing) py-3 text-sm text-foreground transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
              >
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
