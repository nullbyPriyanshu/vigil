"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { UsersIcon } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { UserAvatar } from "@/components/shared/user-avatar";
import { CreateTeamDialog } from "@/components/teams/create-team-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { getTeamsApi, type TeamSummary } from "@/lib/api/teams";
import { canManageMembers } from "@/lib/roles";

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

export default function TeamsPage() {
  const { session } = useAuth();
  const { data: teams, isLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => (await getTeamsApi()).data.data,
  });

  const canManage = canManageMembers(session?.role);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Teams"
        description="Named groups of people who share services and on-call duty."
        action={canManage ? <CreateTeamDialog /> : undefined}
      />

      {isLoading || !teams ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : teams.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-black/15 px-6 py-16 text-center dark:border-white/15">
          <div className="flex size-11 items-center justify-center rounded-full bg-black/[0.04] text-muted-foreground dark:bg-white/[0.05]">
            <UsersIcon className="size-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No teams yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {canManage
                ? "Create your first team to group the people who look after the same services."
                : "An owner or admin can create teams. They'll show up here."}
            </p>
          </div>
          {/* {canManage && <CreateTeamDialog />} */}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => (
            <li key={team.id}>
              <TeamCard team={team} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TeamCard({ team }: { team: TeamSummary }) {
  // The API sends a few members; this is how many more there are.
  const extra = team.memberCount - team.members.length;

  return (
    <Link
      href={`/teams/${team.id}`}
      className="flex h-full flex-col gap-5 rounded-xl border border-black/[0.08] bg-black/[0.015] p-5 transition-colors outline-none hover:border-black/20 focus-visible:ring-2 focus-visible:ring-emerald-400/60 dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:border-white/15"
    >
      <div className="min-w-0">
        <h2 className="truncate text-base font-medium text-zinc-900 dark:text-zinc-100">
          {team.name}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {plural(team.memberCount, "member")} ·{" "}
          {plural(team.serviceCount, "service")}
        </p>
      </div>

      <div className="mt-auto flex min-h-8 items-center">
        {team.memberCount === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody on this team yet</p>
        ) : (
          <>
            {/* Overlapping initials; the ring keeps them visually apart. */}
            <div className="flex -space-x-2">
              {team.members.map((member) => (
                <UserAvatar
                  key={member.userId}
                  name={member.name}
                  className="size-8 text-[11px] ring-2 ring-zinc-50 dark:ring-[#0f0f11]"
                />
              ))}
            </div>
            {extra > 0 && (
              <span className="ml-2.5 text-sm text-muted-foreground">
                +{extra}
              </span>
            )}
          </>
        )}
      </div>
    </Link>
  );
}
