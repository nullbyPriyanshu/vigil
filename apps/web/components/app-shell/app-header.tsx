"use client";

import Link from "next/link";
import { VigilMark } from "@/components/logo";
import { MenuIcon } from "lucide-react";
import { NotificationsBell } from "@/components/app-shell/notifications-bell";
import { OrgSwitcher } from "@/components/app-shell/org-switcher";
import { SearchTrigger } from "@/components/app-shell/search-trigger";
import { UserMenu } from "@/components/user-menu";
import { useAuth } from "@/context/auth-context";

// Top bar for every authenticated page: a mobile-only menu toggle and the
// "Vigil" brand on the left — fixed, not swapped for the current page name
// as you navigate — with search/notifications/user menu on the right. Solid
// background matching the shell surface (and the public Navbar), so it
// reads the same on every page; contrast with content comes from the
// raised content panel below it.
export function AppHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const { session, loading } = useAuth();

  return (
    <header className="relative z-10 flex h-14 w-full shrink-0 items-center justify-between gap-4 border-b border-black/[0.06] bg-white px-4 transition-colors duration-300 sm:px-6 dark:border-white/[0.06] dark:bg-(--ink-0)">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="-ml-1.5 flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-black/[0.04] hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:outline-none lg:hidden dark:hover:bg-white/[0.04] dark:hover:text-zinc-200"
        >
          <MenuIcon className="size-4" />
        </button>

        {/* To the public landing page, not /dashboard — same as any other
            "Vigil" wordmark elsewhere in the app. Safe for a logged-in
            visitor: "/" is public and isn't in proxy.ts's AUTH_ROUTES, so
            it doesn't bounce them back here; the landing page itself shows
            a "Go to dashboard" action when it sees a session instead. */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-[15px] leading-none font-semibold tracking-[0.22em] text-zinc-900 uppercase dark:text-zinc-100"
        >
          {/* Decorative: the "Vigil" text next to it is the link's name. */}
          <VigilMark />
          Vigil
        </Link>

        <span
          aria-hidden
          className="text-lg font-light text-zinc-300 select-none dark:text-zinc-700"
        >
          /
        </span>
        <OrgSwitcher />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <SearchTrigger />
        <NotificationsBell />
        {/* Reserve the slot while /auth/me is in flight rather than showing
            nothing, so the header doesn't jump once the session loads. */}
        {loading ? (
          <div
            aria-hidden
            className="size-8 shrink-0 rounded-full bg-black/[0.04] dark:bg-white/[0.04]"
          />
        ) : (
          session && <UserMenu session={session} variant="compact" />
        )}
      </div>
    </header>
  );
}
