"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useThemeTransition } from "@/lib/hooks/use-theme-transition";
import { cn } from "@/lib/utils";

// A light/dark switch, meant to live inside a menu row (the user menu, on
// the dashboard and — when logged in — the public navbar too). Only ever
// rendered after the menu is opened, well after the page has hydrated and
// next-themes has resolved the real theme, so no flash-of-wrong-icon guard
// is needed here the way a toggle rendered on first paint would need.
export function ThemeToggle() {
  const { isDark, toggle } = useThemeTransition();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle dark mode"
      onClick={(e) => {
        e.stopPropagation(); // don't let it bubble into the menu's own handling
        toggle();
      }}
      className={cn(
        "relative flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-zinc-400/60 focus-visible:outline-none",
        isDark ? "bg-zinc-600" : "bg-zinc-300",
      )}
    >
      <span
        className={cn(
          "relative flex size-4 items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-300 ease-out",
          isDark ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      >
        <SunIcon
          className={cn(
            "absolute size-2.5 text-amber-500 transition-all duration-300",
            isDark
              ? "rotate-90 scale-0 opacity-0"
              : "rotate-0 scale-100 opacity-100",
          )}
        />
        <MoonIcon
          className={cn(
            "absolute size-2.5 text-zinc-700 transition-all duration-300",
            isDark
              ? "rotate-0 scale-100 opacity-100"
              : "-rotate-90 scale-0 opacity-0",
          )}
        />
      </span>
    </button>
  );
}
