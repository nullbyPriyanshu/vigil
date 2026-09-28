"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useThemeTransition } from "@/lib/hooks/use-theme-transition";

// A plain circular icon button — the same wave-toggle logic as
// ThemeToggle, styled to match the dashboard's other icon buttons
// (NotificationsBell, the sidebar's mobile menu toggle) instead of the
// switch-with-label treatment those use inside a menu row. Lives directly
// in the public Navbar, which has no dropdown to tuck a menu row into
// while logged out — and unlike that menu row, this renders on the very
// first paint, which is exactly why useThemeTransition's `mounted` guard
// matters here: an empty icon slot until mount, then the real one, rather
// than a server/client mismatch on which icon to show.
export function ThemeToggleIcon() {
  const { isDark, mounted, toggle } = useThemeTransition();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-black/[0.04] hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:outline-none dark:hover:bg-white/[0.04] dark:hover:text-zinc-200"
    >
      {mounted &&
        (isDark ? (
          <MoonIcon className="size-4" />
        ) : (
          <SunIcon className="size-4" />
        ))}
    </button>
  );
}
