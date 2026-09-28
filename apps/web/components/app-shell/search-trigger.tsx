"use client";

import { SearchIcon } from "lucide-react";

// A command-palette trigger with nothing behind it yet — there's no command
// palette in the app. The click handler is intentionally empty rather than
// omitted, so it's clear this is a placeholder and not a button that was
// forgotten mid-wire-up.
export function SearchTrigger() {
  return (
    <button
      type="button"
      onClick={() => {}}
      className="hidden items-center gap-2 rounded-lg border border-black/[0.08] bg-black/[0.02] px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:border-black/[0.15] hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:outline-none sm:flex dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:border-white/[0.1] dark:hover:text-zinc-300"
    >
      <SearchIcon className="size-3.5 shrink-0" />
      <span className="flex-1 text-left whitespace-nowrap">Search…</span>
      <kbd className="rounded border border-black/[0.1] bg-black/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:border-white/[0.08] dark:bg-white/[0.04]">
        ⌘K
      </kbd>
    </button>
  );
}
