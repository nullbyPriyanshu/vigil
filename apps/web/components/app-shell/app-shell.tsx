"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-shell/app-header";
import { KeyboardShortcuts } from "@/components/app-shell/keyboard-shortcuts";
import { SplashScreen } from "@/components/app-shell/splash-screen";
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
    <div className="flex h-dvh flex-col bg-white text-foreground transition-colors duration-300 dark:bg-(--ink-0)">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <SplashScreen />
      <RealtimeListener />
      <KeyboardShortcuts />
      <AppHeader onMenuClick={() => setMobileNavOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <main id="main" tabIndex={-1} className="outline-none relative m-1.5 min-w-0 flex-1 overflow-y-auto overscroll-contain rounded-xl sm:m-2 border border-black/[0.06] bg-zinc-50 transition-colors duration-300 dark:border-white/[0.08] dark:bg-(--ink-1)">
          <div className="relative w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
