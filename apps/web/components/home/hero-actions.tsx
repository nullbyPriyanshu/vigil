"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { smoothScrollToId } from "@/components/home/scroll-engine";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

// The page's main call to action: "Get started" for visitors, "Go to
// dashboard" once logged in. `secondary` adds a quiet link beside it.
export function HeroActions({
  secondary,
  className,
}: {
  secondary?: { label: string; sectionId: string };
  className?: string;
}) {
  const { session, loading } = useAuth();

  return (
    <div className={cn("flex min-h-12 flex-wrap items-center gap-x-5 gap-y-3", className)}>
      {/* Nothing until we know who's looking; the min-height above holds
          the row so the page doesn't jump when the button appears. */}
      {!loading && (
        <Link
          href={session ? "/dashboard" : "/signup"}
          className={cn(
            buttonVariants({ variant: "brand" }),
            "h-12 animate-in rounded-full px-7 text-[15px] font-semibold fade-in duration-500 motion-reduce:animate-none",
          )}
        >
          {session ? "Go to dashboard" : "Get started"}
          <ArrowRight className="transition-transform group-hover/button:translate-x-0.5" />
        </Link>
      )}
      {secondary && (
        <a
          href={`#${secondary.sectionId}`}
          onClick={(e) => {
            if (smoothScrollToId(secondary.sectionId)) e.preventDefault();
          }}
          className="inline-flex h-12 items-center rounded-xl border border-black/10 px-5 text-sm font-medium text-zinc-600 transition-colors outline-none hover:border-black/25 hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-emerald-400/60 dark:border-white/10 dark:text-zinc-400 dark:hover:border-white/25 dark:hover:text-white"
        >
          {secondary.label}
        </a>
      )}
    </div>
  );
}
