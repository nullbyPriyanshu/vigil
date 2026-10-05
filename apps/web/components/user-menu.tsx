"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Building2Icon,
  ChevronDown,
  Loader2,
  LogOut,
  MoonIcon,
  UserIcon,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/context/auth-context";
import { getApiErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import type { Role, Session } from "@/types/auth";

const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  RESPONDER: "Responder",
  VIEWER: "Viewer",
};

const ITEM =
  "cursor-pointer gap-2.5 rounded-md px-2 py-2 text-zinc-700 dark:text-zinc-300 [&_svg]:text-zinc-400 dark:[&_svg]:text-zinc-500 focus:[&_svg]:text-zinc-700 dark:focus:[&_svg]:text-zinc-200";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-linear-to-b from-zinc-100 to-zinc-200 font-semibold text-zinc-700 ring-1 ring-black/10 select-none ring-inset dark:from-zinc-700 dark:to-zinc-800 dark:text-zinc-200 dark:ring-white/10",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function UserMenu({
  session,
  variant = "full",
}: {
  session: Session;
  variant?: "full" | "compact";
}) {
  const { logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const { name, email } = session.user;
  const compact = variant === "compact";

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Couldn't log out. Please try again."));
      setLoggingOut(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group/user flex min-w-0 cursor-pointer items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60",
          compact
            ? "ring-offset-2 ring-offset-white transition-shadow hover:ring-2 hover:ring-zinc-300 data-popup-open:ring-2 data-popup-open:ring-zinc-300 dark:ring-offset-[#09090b] dark:hover:ring-zinc-700 dark:data-popup-open:ring-zinc-700"
            : "gap-2 py-1 pr-2 pl-1 transition-colors hover:bg-black/[0.04] data-popup-open:bg-black/[0.06] dark:hover:bg-white/[0.04] dark:data-popup-open:bg-white/[0.06]",
        )}
      >
        <UserAvatar
          name={name}
          className={compact ? "size-8 text-xs" : "size-7 text-[11px]"}
        />
        {!compact && (
          <>
            <span className="max-w-24 truncate text-sm font-medium text-foreground sm:max-w-56">
              {name}
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-popup-open/user:rotate-180" />
          </>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={10} className="w-72 p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-3 px-2 pt-2 pb-3 font-normal">
            <UserAvatar name={name} className="size-10 text-sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-foreground">
                  {name}
                </p>
                <span className="shrink-0 rounded-full border border-black/10 px-1.5 py-px text-[10px] font-medium text-zinc-600 dark:border-white/10 dark:text-zinc-400">
                  {ROLE_LABELS[session.role]}
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href="/settings/profile" />} className={ITEM}>
            <UserIcon />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            render={<Link href="/settings/organization" />}
            className={ITEM}
          >
            <Building2Icon />
            Your organization
            {/* <span className="ml-auto max-w-24 truncate pl-2 text-xs text-muted-foreground">
              {session.organization.name}
            </span> */}
          </DropdownMenuItem>

          {/* A plain row, not a menu item: a switch inside a menuitem is invalid ARIA. */}
          <div className="flex items-center gap-2.5 px-2 py-2 text-sm text-zinc-700 dark:text-zinc-300">
            <MoonIcon className="size-4 text-zinc-400 dark:text-zinc-500" />
            <span className="flex-1">Dark mode</span>
            <ThemeToggle />
          </div>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          closeOnClick={false}
          disabled={loggingOut}
          onClick={handleLogout}
          className={cn(
            ITEM,
            "focus:bg-red-500/10 focus:text-red-600 dark:focus:text-red-400 focus:[&_svg]:text-red-500",
          )}
        >
          {loggingOut ? <Loader2 className="animate-spin" /> : <LogOut />}
          {loggingOut ? "Logging out..." : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
