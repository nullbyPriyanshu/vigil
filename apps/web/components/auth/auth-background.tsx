"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { Navbar } from "@/components/navbar";
import { cn } from "@/lib/utils";

// Shared chrome for auth pages (signup, login, ...): the navbar, a dark
// backdrop with a grid that lights up around the cursor, and a centered
// column for the page's own card. Pulled out so every auth page doesn't
// have to re-implement the same background/animation logic.
export function AuthBackground({ children }: { children: ReactNode }) {
  const [isSpotlightActive, setIsSpotlightActive] = useState(false);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);

  // Cursor motion is eased (lerped) toward the pointer every frame instead of
  // snapping straight to it, so the light has weight and trails smoothly
  // rather than jumping 1:1 with the mouse.
  const targetPos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    return () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, []);

  const applyPosition = (x: number, y: number) => {
    spotlightRef.current?.style.setProperty("--x", `${x}px`);
    spotlightRef.current?.style.setProperty("--y", `${y}px`);
    // calc(...% ) centers the blob on the point since percentages in
    // translate resolve against the element's own size.
    if (flowRef.current) {
      flowRef.current.style.transform = `translate3d(calc(${x}px - 50%), calc(${y}px - 50%), 0)`;
    }
  };

  const step = () => {
    const target = targetPos.current;
    const current = currentPos.current;
    const dx = target.x - current.x;
    const dy = target.y - current.y;

    current.x += dx * 0.14;
    current.y += dy * 0.14;
    applyPosition(current.x, current.y);

    if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) {
      rafId.current = requestAnimationFrame(step);
    } else {
      current.x = target.x;
      current.y = target.y;
      applyPosition(current.x, current.y);
      rafId.current = null;
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    targetPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    // Driven from the move handler (not just pointerenter) so the fade-in
    // can't be skipped if enter/leave boundary events don't fire cleanly.
    if (!isSpotlightActive) setIsSpotlightActive(true);

    if (prefersReducedMotion.current) {
      currentPos.current = { ...targetPos.current };
      applyPosition(currentPos.current.x, currentPos.current.y);
      return;
    }

    if (rafId.current === null) {
      rafId.current = requestAnimationFrame(step);
    }
  };

  return (
    // "dark" is forced here so the auth flow reads consistently regardless
    // of the visitor's system/site theme preference. "text-foreground" is
    // explicit (not just inherited from <body>) because <body> sits outside
    // this forced-dark subtree and would otherwise hand down light-mode text
    // color to any child that doesn't set its own (e.g. labels, input text).
    <div
      className="dark relative flex h-dvh flex-col overflow-hidden bg-background text-foreground"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setIsSpotlightActive(false)}
    >
      <Navbar />

      {/* Ambient backdrop: faint grid fading into a radial glow, no imagery */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]"
      />
      {/* Same grid, brighter, revealed only in a circle that eases toward the
          cursor. --x/--y are mutated directly on the DOM node (see `step`)
          rather than through React's style prop, since a style object literal
          would get reset to its default on every re-render and clobber the
          live cursor position. */}
      <div
        ref={spotlightRef}
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.45)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.45)_1px,transparent_1px)] bg-[size:56px_56px] opacity-0 transition-opacity duration-300 [mask-image:radial-gradient(circle_240px_at_var(--x,50%)_var(--y,0px),black,transparent_70%)]",
          isSpotlightActive && "opacity-100",
        )}
      />
      {/* Soft glow that trails the same eased cursor position — the "flow"
          layer that gives the backdrop a sense of fluid motion beyond the
          grid reveal. Positioned via transform (GPU-friendly) so it never
          triggers layout, only composited movement. */}
      <div
        ref={flowRef}
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-0 left-0 h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.10),transparent_70%)] opacity-0 blur-2xl transition-opacity duration-500 will-change-transform",
          isSpotlightActive && "opacity-100",
        )}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/10 blur-[120px]"
      />

      {/* Content area fills the space below the navbar and centers the card
          in it, so the navbar gets its own row instead of overlapping. */}
      <div className="relative flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="relative w-full max-w-[500px]">{children}</div>
      </div>
    </div>
  );
}
