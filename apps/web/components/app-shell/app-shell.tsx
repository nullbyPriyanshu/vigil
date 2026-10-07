"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-shell/app-header";
import { RealtimeListener } from "@/components/app-shell/realtime-listener";
import { Sidebar } from "@/components/app-shell/sidebar";

// Frame every authenticated page shares: navbar and sidebar sit flush on
// the same flat root surface as each other — no panel of their own —
// while the content area reads as a raised, inset panel a shade lighter
// (darker in dark mode), offset from every edge including the sidebar's —
// a solid, flat surface with no texture on it. That contrast, not a
// background difference between the chrome and the canvas, is what
// separates navigation from content. No hardcoded "dark" here —
// next-themes controls the real theme via a class on <html>, and this
// whole subtree follows it. Mounted once in (pages)/layout.tsx, so
// navigating between sidebar links only swaps `children` — the shell
// itself never remounts, which is what keeps switching pages instant.
export function AppShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-white text-foreground transition-colors duration-300 dark:bg-[#09090b]">
      <RealtimeListener />
      <AppHeader onMenuClick={() => setMobileNavOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <main className="relative m-2 min-w-0 flex-1 overflow-y-auto rounded-xl border border-black/[0.06] bg-zinc-50 transition-colors duration-300 dark:border-white/[0.08] dark:bg-[#0f0f11]">
          <div className="relative w-full max-w-7xl px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
