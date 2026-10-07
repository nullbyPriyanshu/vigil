"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BoxesIcon,
  CalendarClockIcon,
  CornerDownLeftIcon,
  SearchIcon,
  SirenIcon,
  UserIcon,
  UsersIcon,
  WorkflowIcon,
  type LucideIcon,
} from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getIncidentsApi } from "@/lib/api/incidents";
import { getMembersApi } from "@/lib/api/members";
import { getPoliciesApi } from "@/lib/api/policies";
import { getSchedulesApi } from "@/lib/api/schedules";
import { getServicesApi } from "@/lib/api/services";
import { getTeamsApi } from "@/lib/api/teams";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

type Result = {
  key: string;
  group: string;
  label: string;
  hint?: string;
  href: string;
  icon: LucideIcon;
};

// How many results a group shows before the person narrows the search.
const PER_GROUP = 5;

// The search box in the top bar, and the palette it opens (also Ctrl+K or
// ⌘K). Everything searchable is loaded once when it opens and filtered in
// the browser as the person types.
export function SearchTrigger() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data } = useQuery({
    queryKey: ["search-index"],
    queryFn: async () => {
      const [incidents, services, teams, schedules, policies, members] =
        await Promise.all([
          getIncidentsApi({ pageSize: 100 }),
          getServicesApi(),
          getTeamsApi(),
          getSchedulesApi(),
          getPoliciesApi(),
          getMembersApi(),
        ]);
      return {
        incidents: incidents.data.data,
        services: services.data.data,
        teams: teams.data.data,
        schedules: schedules.data.data,
        policies: policies.data.data,
        members: members.data.data,
      };
    },
    enabled: open,
    staleTime: 30 * 1000,
  });

  const results = useMemo(() => {
    const all: Result[] = [
      ...NAV_ITEMS.map((item) => ({
        key: `page-${item.href}`,
        group: "Pages",
        label: item.label,
        href: item.href,
        icon: item.icon,
      })),
      ...(data?.incidents ?? []).map((incident) => ({
        key: `incident-${incident.id}`,
        group: "Incidents",
        label: incident.title,
        hint: `INC-${incident.number} · ${incident.service.name}`,
        href: `/incidents/${incident.number}`,
        icon: SirenIcon,
      })),
      ...(data?.services ?? []).map((service) => ({
        key: `service-${service.id}`,
        group: "Services",
        label: service.name,
        hint: service.team.name,
        href: `/services/${service.id}`,
        icon: BoxesIcon,
      })),
      ...(data?.teams ?? []).map((team) => ({
        key: `team-${team.id}`,
        group: "Teams",
        label: team.name,
        hint: `${team.memberCount} members`,
        href: `/teams/${team.id}`,
        icon: UsersIcon,
      })),
      ...(data?.schedules ?? []).map((schedule) => ({
        key: `schedule-${schedule.id}`,
        group: "Schedules",
        label: schedule.name,
        hint: schedule.currentOnCall
          ? `${schedule.currentOnCall.name} is on call`
          : schedule.team.name,
        href: `/schedules/${schedule.id}`,
        icon: CalendarClockIcon,
      })),
      ...(data?.policies ?? []).map((policy) => ({
        key: `policy-${policy.id}`,
        group: "Escalation policies",
        label: policy.name,
        hint: `${policy.stepCount} steps`,
        href: `/policies/${policy.id}`,
        icon: WorkflowIcon,
      })),
      ...(data?.members ?? []).map((member) => ({
        key: `member-${member.userId}`,
        group: "People",
        label: member.name,
        hint: member.email,
        href: "/members",
        icon: UserIcon,
      })),
    ];

    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    // With nothing typed, offer the pages; otherwise every word must appear
    // somewhere in the name or the hint.
    const matching =
      words.length === 0
        ? all.filter((result) => result.group === "Pages")
        : all.filter((result) => {
            const text = `${result.label} ${result.hint ?? ""}`.toLowerCase();
            return words.every((word) => text.includes(word));
          });

    const seen: Record<string, number> = {};
    return matching.filter((result) => {
      seen[result.group] = (seen[result.group] ?? 0) + 1;
      return seen[result.group] <= PER_GROUP;
    });
  }, [data, query]);

  const go = (result: Result) => {
    setOpen(false);
    router.push(result.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((index) => Math.min(index + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-lg border border-black/[0.08] bg-black/[0.02] px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:border-black/[0.15] hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:outline-none sm:flex dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:border-white/[0.1] dark:hover:text-zinc-300"
      >
        <SearchIcon className="size-3.5 shrink-0" />
        <span className="flex-1 pr-6 text-left whitespace-nowrap">Search…</span>
        <kbd className="rounded border border-black/[0.1] bg-black/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:border-white/[0.08] dark:bg-white/[0.04]">
          ⌘K
        </kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-black/[0.04] hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:outline-none sm:hidden dark:hover:bg-white/[0.04] dark:hover:text-zinc-200"
      >
        <SearchIcon className="size-4" />
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setQuery("");
            setActive(0);
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
        >
          <DialogTitle className="sr-only">Search</DialogTitle>
          <div className="flex items-center gap-3 border-b border-black/[0.08] px-4 dark:border-white/[0.08]">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search incidents, services, people…"
              aria-label="Search"
              className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <kbd className="shrink-0 rounded border border-black/[0.1] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground dark:border-white/[0.1]">
              Esc
            </kbd>
          </div>

          <div className="max-h-[min(24rem,55vh)] overflow-y-auto p-1.5">
            {results.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                {data || query === ""
                  ? `Nothing matches "${query}"`
                  : "Searching…"}
              </p>
            ) : (
              results.map((result, index) => (
                <div key={result.key}>
                  {(index === 0 || results[index - 1].group !== result.group) && (
                    <p className="px-2.5 pt-2.5 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      {result.group}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => go(result)}
                    onMouseMove={() => setActive(index)}
                    data-active={index === active}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm outline-none",
                      index === active && "bg-black/[0.05] dark:bg-white/[0.06]",
                    )}
                  >
                    <result.icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-foreground">
                      {result.label}
                    </span>
                    {result.hint && (
                      <span className="max-w-[45%] shrink-0 truncate text-xs text-muted-foreground">
                        {result.hint}
                      </span>
                    )}
                    {index === active && (
                      <CornerDownLeftIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
          <p className="border-t border-black/[0.08] px-4 py-2 text-xs text-muted-foreground dark:border-white/[0.08]">
            Press ? anywhere for keyboard shortcuts
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
