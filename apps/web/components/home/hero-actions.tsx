"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

const heroButton = "h-11 px-5 text-[15px]";

function HeroButtons() {
  const { session, loading } = useAuth();

  // Nothing until we know who's looking: showing "Get started" to a
  // logged-in user for a beat would be wrong, and the wrapper below holds the
  // row's height so the hero doesn't jump when the buttons appear.
  if (loading) return null;

  if (session) {
    return (
      <Link
        href="/dashboard"
        className={cn(
          buttonVariants({ size: "lg", className: heroButton }),
        )}
      >
        Go to dashboard
        <ArrowRight className="transition-transform group-hover/button:translate-x-0.5" />
      </Link>
    );
  }

  // Just the one CTA — "Log in" lives in the navbar's top-right corner,
  // not repeated here too.
  return (
    <Link
      href="/signup"
      className={cn(buttonVariants({ size: "lg", className: heroButton }))}
    >
      Get started
      <ArrowRight className="transition-transform group-hover/button:translate-x-0.5" />
    </Link>
  );
}

export function HeroActions() {
  return (
    <div className="mt-9 flex min-h-11 animate-in flex-wrap items-center justify-center gap-3 fade-in duration-500 motion-reduce:animate-none">
      <HeroButtons />
    </div>
  );
}
