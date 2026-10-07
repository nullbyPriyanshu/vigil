"use client";

import { VigilMark } from "@/components/logo";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

// Covers the app with the logo while we find out who is signed in (only
// on the first load; after that the answer is remembered), then fades away.
export function SplashScreen() {
  const { loading } = useAuth();

  return (
    <div
      aria-hidden={!loading}
      className={cn(
        "fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-white transition-opacity duration-500 dark:bg-[#050505]",
        loading ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <VigilMark className="size-12 motion-safe:animate-pulse" />
      <p className="text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
        {loading ? "Loading Vigil" : ""}
      </p>
    </div>
  );
}
