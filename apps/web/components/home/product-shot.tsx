"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { addLayer, clamp01, ease, prefersReducedMotion } from "@/components/home/scroll-engine";
import { cn } from "@/lib/utils";

export const SHOT_FRAME =
  "overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_40px_80px_-30px_rgba(0,0,0,0.3)] sm:rounded-2xl dark:border-white/10 dark:bg-[#050505] dark:shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)]";

// A real screenshot of the app. Two files, one per theme, swapped with CSS
// so the picture always matches the page around it. `unoptimized` serves
// the original 2880px capture as-is: these are the page's showpiece, and
// recompressing them is what makes small UI text look soft.
export function ShotImages({
  name,
  alt,
  priority = false,
}: {
  name: "dashboard" | "members";
  alt: string;
  priority?: boolean;
}) {
  return (
    <>
      <Image
        src={`/landing/${name}-dark.png`}
        alt={alt}
        width={2880}
        height={1800}
        priority={priority}
        unoptimized
        className="hidden h-auto w-full dark:block"
      />
      <Image
        src={`/landing/${name}-light.png`}
        alt={alt}
        width={2880}
        height={1800}
        priority={priority}
        unoptimized
        className="block h-auto w-full dark:hidden"
      />
    </>
  );
}

// A screenshot that swings in from the side: it starts turned away and
// pushed down, and straightens as it scrolls up the screen.
export function ProductShot({
  name,
  alt,
  className,
}: {
  name: "dashboard" | "members";
  alt: string;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (prefersReducedMotion()) {
      wrap.style.setProperty("--tilt", "0");
      return;
    }

    let current: number | null = null;
    return addLayer(() => {
      const vh = window.innerHeight;
      const top = wrap.getBoundingClientRect().top;
      const goal = clamp01((top - vh * 0.18) / (vh * 0.7));
      current = current === null ? goal : ease(current, goal);
      wrap.style.setProperty("--tilt", current.toFixed(4));
      return current !== goal;
    });
  }, []);

  return (
    <div
      ref={wrapRef}
      className={cn("[perspective:2200px]", className)}
      style={{ "--tilt": 1 } as React.CSSProperties}
    >
      <div
        className={cn(SHOT_FRAME, "origin-left")}
        style={{
          transform: [
            "translate3d(calc(var(--tilt) * 70px), calc(var(--tilt) * 50px), 0)",
            "rotateY(calc(var(--tilt) * -22deg))",
            "rotateX(calc(var(--tilt) * 8deg))",
          ].join(" "),
        }}
      >
        <ShotImages name={name} alt={alt} />
      </div>
    </div>
  );
}
