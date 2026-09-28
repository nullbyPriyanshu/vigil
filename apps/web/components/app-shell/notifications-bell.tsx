"use client";

import { BellIcon } from "lucide-react";

// Same story as SearchTrigger: no notifications system exists yet, so this
// is UI only, with an intentionally empty handler.
export function NotificationsBell() {
  return (
    <button
      type="button"
      onClick={() => {}}
      aria-label="Notifications"
      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-black/[0.04] hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:outline-none dark:hover:bg-white/[0.04] dark:hover:text-zinc-200"
    >
      <BellIcon className="size-4" />
    </button>
  );
}
