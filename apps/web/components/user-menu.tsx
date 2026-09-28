"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronDown, LayoutDashboard, Loader2, LogOut } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { getApiErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import type { Role, Session } from "@/types/auth";

// One accent color per role, shared by the avatar and the role badge so the
// two always read as a pair. Tailwind only generates classes it can see as
// complete strings in the source, so these are spelled out in full rather
// than built from a color name.
const ROLE_STYLES: Record<
  Role,
  { label: string; avatar: string; badge: string }
> = {
  OWNER: {
    label: "Owner",
    avatar:
      "from-amber-300 to-orange-500 text-amber-950 shadow-amber-500/30",
    badge: "bg-amber-400/15 text-amber-300 ring-amber-400/25",
  },
  ADMIN: {
    label: "Admin",
    avatar: "from-violet-400 to-fuchsia-500 text-white shadow-violet-500/30",
    badge: "bg-violet-400/15 text-violet-300 ring-violet-400/25",
  },
  RESPONDER: {
    label: "Responder",
    avatar:
      "from-emerald-300 to-teal-500 text-emerald-950 shadow-emerald-500/30",
    badge: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/25",
  },
  VIEWER: {
    label: "Viewer",
    avatar: "from-sky-300 to-blue-500 text-sky-950 shadow-sky-500/30",
    badge: "bg-sky-400/15 text-sky-300 ring-sky-400/25",
  },
};

function UserAvatar({
  name,
  role,
  className,
}: {
  name: string;
  role: Role;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-linear-to-br font-semibold shadow-lg ring-1 ring-white/25 select-none ring-inset",
        ROLE_STYLES[role].avatar,
        className,
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

// The logged-in user's chip in the navbar. Clicking it opens a menu; add
// future account actions (profile, settings, ...) as more items in there.
export function UserMenu({ session }: { session: Session }) {
  const { logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const { name, email } = session.user;
  const role = ROLE_STYLES[session.role];

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      // On success this navigates to /login, which unmounts the menu, so
      // there's nothing to reset on the happy path.
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
          "group/user flex min-w-0 cursor-pointer items-center gap-2 rounded-full border border-transparent py-1 pr-2.5 pl-1 outline-none",
          "transition-colors hover:border-border hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring/50",
          "data-popup-open:border-border data-popup-open:bg-foreground/10",
          "animate-in fade-in duration-300 motion-reduce:animate-none",
        )}
      >
        <UserAvatar name={name} role={session.role} className="size-7 text-xs" />
        <span className="max-w-24 truncate text-sm font-medium text-foreground sm:max-w-56">
          {name}
        </span>
        <Badge
          variant="secondary"
          className={cn("ring-1 ring-inset", role.badge)}
        >
          {role.label}
        </Badge>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-popup-open/user:rotate-180" />
      </DropdownMenuTrigger>

      {/* "dark" on the popup itself: it renders in a portal at the end of
          <body>, outside the forced-dark subtree the navbar lives in, so
          without this it would come out light-themed. */}
      <DropdownMenuContent align="end" sideOffset={8} className="dark w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2">
            <UserAvatar name={name} role={session.role} className="size-9 text-sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {name}
              </p>
              <p className="truncate text-xs font-normal text-muted-foreground">
                {email}
              </p>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          render={<Link href="/dashboard" />}
          className="cursor-pointer px-2 py-1.5 transition-colors duration-150"
        >
          <LayoutDashboard />
          Dashboard
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Stays open while the request is in flight so the spinner is
            visible; a failure leaves it open for a retry. */}
        <DropdownMenuItem
          variant="destructive"
          closeOnClick={false}
          disabled={loggingOut}
          onClick={handleLogout}
          className="cursor-pointer px-2 py-1.5 transition-colors duration-150"
        >
          {loggingOut ? <Loader2 className="animate-spin" /> : <LogOut />}
          {loggingOut ? "Logging out..." : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
