"use client";

import Link from "next/link";
import { VigilMark } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggleIcon } from "@/components/theme-toggle-icon";
import { smoothScrollToId } from "@/components/home/scroll-engine";
import { UserMenu } from "@/components/user-menu";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { label: "Product", id: "product" },
  { label: "Features", id: "features" },
  { label: "How it works", id: "how-it-works" },
];

function scrollToSection(e: React.MouseEvent, id: string) {
  if (smoothScrollToId(id)) e.preventDefault();
}

function NavbarAuth() {
  const { session, loading } = useAuth();

  // Hold the space while /auth/me is in flight, so "Sign in" never flashes
  // at someone who is already logged in.
  if (loading) {
    return <div aria-hidden className="h-9 w-[4.75rem]" />;
  }

  if (session) {
    return (
      <>
        <Link
          href="/dashboard"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "hidden h-9 px-3.5 sm:inline-flex",
          )}
        >
          Dashboard
        </Link>
        <UserMenu session={session} variant="compact" />
      </>
    );
  }

  return (
    <Link
      href="/login"
      className={cn(buttonVariants({ variant: "outline" }), "h-9 px-3.5")}
    >
      Sign in
    </Link>
  );
}

export function LandingNavbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-white transition-colors duration-300 dark:border-white/[0.06] dark:bg-[#050505]">
      <div className="relative flex h-16 items-center justify-between gap-6 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-[15px] leading-none font-semibold tracking-[0.22em] text-zinc-900 uppercase dark:text-zinc-100"
        >
          <VigilMark />
          Vigil
        </Link>

        <nav
          aria-label="Sections"
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex"
        >
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`/#${section.id}`}
              onClick={(e) => scrollToSection(e, section.id)}
              className="rounded-md px-3 py-2 text-sm text-zinc-600 transition-colors outline-none hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-emerald-400/60 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              {section.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggleIcon />
          <NavbarAuth />
        </div>
      </div>
    </header>
  );
}
