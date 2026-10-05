"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { addLayer, ease, prefersReducedMotion } from "@/components/home/scroll-engine";

// Shifts its children vertically as the page scrolls, by `depth` pixels for
// every full screen the element travels. Positive depths lag behind the
// scroll (they feel further away), negative ones run ahead (closer).
// Several of these with different depths next to each other is what gives
// a flat page a sense of layers.
export function ParallaxLayer({
  depth,
  children,
  className,
}: {
  depth: number;
  children: ReactNode;
  className?: string;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner || prefersReducedMotion()) return;

    let current: number | null = null;

    return addLayer(() => {
      // Measured on the outer box, which never moves, so the shift doesn't
      // feed back into its own measurement.
      const rect = outer.getBoundingClientRect();
      const vh = window.innerHeight;
      const fromCenter = (rect.top + rect.height / 2 - vh / 2) / vh;
      const goal = -fromCenter * depth;
      current = current === null ? goal : ease(current, goal);
      inner.style.transform = `translate3d(0, ${current.toFixed(2)}px, 0)`;
      return current !== goal;
    });
  }, [depth]);

  return (
    <div ref={outerRef} className={className}>
      <div ref={innerRef} className="size-full will-change-transform">
        {children}
      </div>
    </div>
  );
}
