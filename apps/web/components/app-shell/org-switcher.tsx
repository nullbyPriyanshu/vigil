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

// Only one organization per account exists today, so "Create workspace"
// stays disabled until multi-org support is built.
export function OrgSwitcher() {
  const { session, loading } = useAuth();

  if (loading || !session) {
    return (
      <div
        aria-hidden
        className="h-6 w-28 rounded-md bg-black/[0.04] dark:bg-white/[0.04]"
      />
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-zinc-900 outline-none transition-colors hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-zinc-400/60 data-popup-open:bg-black/[0.06] dark:text-zinc-100 dark:hover:bg-white/[0.04] dark:data-popup-open:bg-white/[0.06]">
        <span className="max-w-40 truncate sm:max-w-60">
          {session.organization.name}
        </span>
        <ChevronsUpDownIcon className="size-3.5 shrink-0 text-zinc-500" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={8} className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Workspaces
          </DropdownMenuLabel>
          <DropdownMenuItem className="cursor-default px-2 py-1.5">
            <span className="min-w-0 flex-1 truncate">
              {session.organization.name}
            </span>
            <CheckIcon className="size-3.5 shrink-0" />
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="px-2 py-1.5">
          <PlusIcon className="size-3.5 shrink-0" />
          Create workspace
          <span className="ml-auto text-xs text-muted-foreground">Soon</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
