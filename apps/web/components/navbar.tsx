"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

// Right-hand side of the navbar: a "Log in" button for visitors, or the
// user's menu (name, role, account actions) once logged in.
function NavbarAuth() {
  const { session, loading } = useAuth();

  // Reserve the slot while /auth/me is in flight. Rendering "Log in" here
  // would flash it at every logged-in visitor on each page load.
  if (loading) return <div aria-hidden className="h-7 w-16" />;

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

  return <UserMenu session={session} />;
}

// Minimal top navbar shared across pages: brand on the left, auth state on
// the right. Pages that already have their own login/signup UI (the auth
// pages) pass showAuth={false} to leave the right side empty.
export function Navbar({ showAuth = true }: { showAuth?: boolean }) {
  return (
    // "relative z-10" keeps this above any absolutely-positioned decorative
    // background a page places behind it (positioned elements otherwise
    // paint above static ones by default, which would leave the blur with
    // nothing behind it to actually frost).
    <header className="relative z-10 flex h-12 w-full shrink-0 items-center justify-between gap-4 border-b border-border/40 bg-background/30 px-4 backdrop-blur-md sm:px-6">
      <Link
        href="/"
        className="text-base font-semibold tracking-tight text-foreground"
      >
        Vigil
      </Link>
      {showAuth && <NavbarAuth />}
    </header>
  );
}
