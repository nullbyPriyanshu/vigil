"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BellIcon } from "lucide-react";

import { StatusDot } from "@/components/shared/status-dot";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getIncidentsApi, type IncidentRow } from "@/lib/api/incidents";
import { timeAgo } from "@/lib/time";

const SEEN_KEY = "vigil:bell-seen-at";

// What happened to an incident most recently, and when.
function latest(incident: IncidentRow) {
  if (incident.status === "RESOLVED" && incident.resolvedAt) {
    return {
      at: incident.resolvedAt,
      text: incident.resolvedBy
        ? `Resolved by ${incident.resolvedBy.name}`
        : "Resolved automatically",
    };
  }
  if (incident.status === "ACKNOWLEDGED" && incident.acknowledgedAt) {
    return {
      at: incident.acknowledgedAt,
      text: incident.acknowledgedBy
        ? `Acknowledged by ${incident.acknowledgedBy.name}`
        : "Acknowledged",
    };
  }
  return { at: incident.createdAt, text: "Triggered, waiting for someone" };
}

// The bell in the top bar: the latest thing that happened to each recent
// incident. The red dot means something changed since it was last opened.
// It stays current because the app reloads incident data on live events.
export function NotificationsBell() {
  // When the list was last opened, remembered across reloads.
  const [seenAt, setSeenAt] = useState("");
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSeenAt(localStorage.getItem(SEEN_KEY) ?? "");
    } catch {}
  }, []);
  const markSeen = (at: string) => {
    setSeenAt(at);
    try {
      localStorage.setItem(SEEN_KEY, at);
    } catch {}
  };

  const { data: incidents } = useQuery({
    queryKey: ["incidents", "bell"],
    queryFn: async () => (await getIncidentsApi({ pageSize: 30 })).data.data,
    refetchInterval: 60 * 1000,
  });

  const items = (incidents ?? [])
    .map((incident) => ({ incident, ...latest(incident) }))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  const unread = items.filter((item) => item.at > seenAt).length;

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        // Opening the list counts as having seen everything in it.
        if (open && items[0]) markSeen(items[0].at);
      }}
    >
      <DropdownMenuTrigger
        aria-label={unread > 0 ? `Notifications, ${unread} new` : "Notifications"}
        className="relative flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-black/[0.04] hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:outline-none aria-expanded:bg-black/[0.04] aria-expanded:text-zinc-900 dark:hover:bg-white/[0.04] dark:hover:text-zinc-200 dark:aria-expanded:bg-white/[0.04] dark:aria-expanded:text-zinc-200"
      >
        <BellIcon className="size-4" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-[#09090b]" />
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={10} className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-black/[0.08] px-4 py-3 dark:border-white/[0.08]">
          <p className="text-sm font-medium text-foreground">Notifications</p>
          <Link
            href="/incidents"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            All incidents
          </Link>
        </div>

        {!incidents ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nothing yet. Incidents show up here as they happen.
          </p>
        ) : (
          <ul className="max-h-96 overflow-y-auto py-1">
            {items.map(({ incident, at, text }) => (
              <li key={incident.id}>
                <Link
                  href={`/incidents/${incident.number}`}
                  className="flex gap-3 px-4 py-2.5 transition-colors outline-none hover:bg-black/[0.03] focus-visible:bg-black/[0.04] dark:hover:bg-white/[0.04] dark:focus-visible:bg-white/[0.05]"
                >
                  <StatusDot status={incident.status} className="mt-1.5" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">
                      {incident.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      INC-{incident.number} · {text}
                    </span>
                  </span>
                  <span className="shrink-0 pt-0.5 text-xs text-muted-foreground tabular-nums">
                    {timeAgo(at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
