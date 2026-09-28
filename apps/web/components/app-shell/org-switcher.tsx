"use client";

import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

// The workspace switcher pinned to the top of the sidebar. Vigil only ever
// has one organization per account today — the Membership model is one
// role per user per org, with no cross-org switching built — so this is UI
// scaffolding for that feature: it shows the current org for real, and an
// "Add workspace" row that's honestly disabled rather than pretending
// multi-org support already exists.
export function OrgSwitcher({ collapsed }: { collapsed: boolean }) {
  const { session, loading } = useAuth();

  if (loading || !session) {
    return (
      <div
        aria-hidden
        className="h-9 w-full animate-pulse rounded-lg bg-black/[0.03] dark:bg-white/[0.03]"
      />
    );
  }

  const initial = session.organization.name.charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full min-w-0 items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left outline-none transition-colors",
          "hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-emerald-400/60 dark:hover:bg-white/[0.04]",
          "data-popup-open:bg-black/[0.06] dark:data-popup-open:bg-white/[0.06]",
        )}
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-400/15 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          {initial}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {session.organization.name}
            </span>
            <ChevronsUpDownIcon className="size-3.5 shrink-0 text-zinc-500" />
          </>
        )}
      </DropdownMenuTrigger>

      {/* No fixed width: falls through to the shared DropdownMenuContent's
          default of w-(--anchor-width), so the popup is exactly as wide as
          the trigger it's anchored to instead of an arbitrary fixed size.
          No forced "dark" either — this only ever renders inside the
          theme-aware app shell now. */}
      <DropdownMenuContent align="start" sideOffset={8}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[11px] tracking-wider text-zinc-500 uppercase">
            Workspace
          </DropdownMenuLabel>
          <DropdownMenuItem className="cursor-default gap-2 px-2 py-1.5">
            <span className="flex size-5 shrink-0 items-center justify-center rounded bg-emerald-400/15 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              {initial}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {session.organization.name}
            </span>
            <CheckIcon className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled
          className="gap-2 px-2 py-1.5 text-zinc-500"
        >
          <PlusIcon className="size-3.5 shrink-0" />
          Add workspace
          <span className="ml-auto text-[10px] text-zinc-500 dark:text-zinc-600">
            Soon
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
