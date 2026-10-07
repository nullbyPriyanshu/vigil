"use client";

import { useEffect, useRef } from "react";
import { ParallaxLayer } from "@/components/home/parallax-layer";
import { addLayer, ease, prefersReducedMotion, wake } from "@/components/home/scroll-engine";
import { cn } from "@/lib/utils";

// Each chip sits at its own depth: how far it shifts on scroll, how far it
// follows the mouse, and how slowly it drifts (with a different starting
// point in the loop, so they never move in unison). Different numbers per chip are
// what make them read as floating at different distances above the map.
const CHIPS = [
  {
    title: "Incident resolved",
    time: "2 min ago",
    tone: "emerald",
    position: "top-[4%] left-[2%]",
    scroll: -70,
    pointer: 18,
    bob: "11s",
    delay: "0s",
  },
  {
    title: "Alert triggered",
    time: "3 min ago",
    tone: "red",
    position: "top-[10%] right-0",
    scroll: -130,
    pointer: 30,
    bob: "14s",
    delay: "-5s",
  },
  {
    title: "Team notified",
    time: "1 min ago",
    tone: "emerald",
    position: "bottom-[8%] left-[44%]",
    scroll: -40,
    pointer: 12,
    bob: "12s",
    delay: "-8s",
  },
] as const;

// How much of the remaining distance the scene covers each frame when
// following the mouse. Small on purpose: the scene trails well behind the
// cursor and takes a second or two to settle, so it drifts instead of
// tracking.
const POINTER_EASE = 0.018;

// The right half of the hero: three example events floating over the map
// (which the page draws full-width behind the whole hero). Each chip drifts on its own slow loop,
// shifts at its own speed as you scroll, and trails a few pixels after the
// mouse.
export function HeroScene() {
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || prefersReducedMotion()) return;

    const goal = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      goal.x = (e.clientX / window.innerWidth) * 2 - 1;
      goal.y = (e.clientY / window.innerHeight) * 2 - 1;
      wake();
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const removeLayer = addLayer(() => {
      current.x = ease(current.x, goal.x, POINTER_EASE);
      current.y = ease(current.y, goal.y, POINTER_EASE);
      scene.style.setProperty("--mx", current.x.toFixed(4));
      scene.style.setProperty("--my", current.y.toFixed(4));
      return current.x !== goal.x || current.y !== goal.y;
    });

    return () => {
      window.removeEventListener("pointermove", onMove);
      removeLayer();
    };
  }, []);

  return (
    <div
      ref={sceneRef}
      aria-hidden
      className="relative hidden min-h-[480px] lg:block"
      style={{ "--mx": 0, "--my": 0 } as React.CSSProperties}
    >
      {CHIPS.map((chip) => (
        <ParallaxLayer
          key={chip.title}
          depth={chip.scroll}
          className={cn("absolute", chip.position)}
        >
          <div
            style={{
              transform: `translate3d(calc(var(--mx) * ${chip.pointer}px), calc(var(--my) * ${chip.pointer}px), 0)`,
            }}
          >
            <div
              className="animate-float flex items-center gap-3 rounded-xl border border-black/10 bg-white px-4 py-2.5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)] dark:border-white/10 dark:bg-[#0e0e0e] dark:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.9)]"
              style={{
                animationDuration: chip.bob,
                animationDelay: chip.delay,
              }}
            >
              <span>
                <span className="block text-sm font-medium whitespace-nowrap text-zinc-900 dark:text-zinc-100">
                  {chip.title}
                </span>
                <span className="block text-xs text-zinc-500">{chip.time}</span>
              </span>
            </div>
          </div>
        </ParallaxLayer>
      ))}
    </div>
  );
}
