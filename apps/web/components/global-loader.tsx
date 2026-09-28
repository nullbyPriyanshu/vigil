"use client";

import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// A thin progress bar fixed to the very top of the viewport, mounted once
// in the root layout so it's present on every page without any page having
// to wire it up. It reacts to React Query's own in-flight count — the
// session check on first load, a future login/logout mutation, a future
// incidents fetch — so "is data loading right now" only has to be answered
// in one place, rather than every screen tracking its own spinner state.
export function GlobalLoader() {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const active = isFetching > 0 || isMutating > 0;

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden transition-opacity duration-300",
        active ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="animate-global-loader-sweep absolute inset-y-0 w-1/3 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" />
    </div>
  );
}
