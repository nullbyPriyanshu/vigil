"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggleIcon } from "@/components/theme-toggle-icon";
import { UserMenu } from "@/components/user-menu";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

// Right-hand side of the navbar: a "Log in" button for visitors, or the
// user's avatar menu once logged in — the same compact avatar-only trigger
// as the dashboard's AppHeader, with name/role inside the dropdown.
function NavbarAuth() {
  const { session, loading } = useAuth();

  // Reserve the slot while /auth/me is in flight. Rendering "Log in" here
  // would flash it at every logged-in visitor on each page load.
  if (loading) {
    return (
      <div
        aria-hidden
        className="size-8 shrink-0 rounded-full bg-black/[0.04] dark:bg-white/[0.04]"
      />
    );
  }

  if (!session) {
    return (
      <Link
        href="/login"
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "animate-in fade-in duration-300 motion-reduce:animate-none",
        )}
      >
        Log in
      </Link>
    );
  }

  return <UserMenu session={session} variant="compact" />;
}

// Minimal top navbar shared across pages: brand on the left, theme toggle
// and auth state on the right. Pages that already have their own
// login/signup UI (the auth pages) pass showAuth={false} to leave the
// "Log in" button/user menu out — the toggle stays either way, since it's
// a site preference, not an auth action.
export function Navbar({ showAuth = true }: { showAuth?: boolean }) {
  return (
    // Same height, border and solid background as the dashboard's
    // AppHeader, so the page's backdrop (e.g. the auth grid and cursor
    // light) never shows through the header strip. "relative z-10" keeps
    // it above the page's decorative background layers.
    <header className="relative z-10 flex h-14 w-full shrink-0 items-center justify-between gap-4 border-b border-black/[0.06] bg-white px-4 transition-colors duration-300 sm:px-6 dark:border-white/[0.06] dark:bg-[#09090b]">
      <Link
        href="/"
        className="font-mono text-lg font-bold tracking-widest text-zinc-900 uppercase dark:text-zinc-100"
      >
        Vigil
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggleIcon />
        {showAuth && <NavbarAuth />}
      </div>
    </header>
  );
}
