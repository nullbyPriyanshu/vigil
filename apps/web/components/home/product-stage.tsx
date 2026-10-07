"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { TimerIcon } from "lucide-react";
import { OnCallPanel } from "@/components/dashboard/on-call-panel";
import { SeverityBadge } from "@/components/shared/severity-badge";
import { StatusDot } from "@/components/shared/status-dot";
import { StatCard } from "@/components/dashboard/stat-card";
import { SHOT_FRAME, ShotImages } from "@/components/home/product-shot";
import {
  addLayer,
  clamp01,
  ease,
  phase,
  prefersReducedMotion,
} from "@/components/home/scroll-engine";
import { MTTA_TARGET_SECONDS } from "@/lib/constants";
import { dashboardStats, onCallNow } from "@/lib/mock/dashboard";
import { cn } from "@/lib/utils";

// Height of the sticky navbar the stage pins underneath (h-16).
const NAV_HEIGHT = 64;

// The showpiece under the hero. On large screens the section is much taller
// than the screen and its contents are pinned, so scrolling through it plays
// a short sequence instead of moving the page:
//
//   entering   the dashboard screenshot rises into view, dim and lying
//              back in 3D
//   0.00-0.42  it stands up, straightens and brightens until it's flat
//   0.04-0.30  the heading above it fades in
//   0.32-0.84  four live cards grow into place around it, one by one
//
// The cards are the app's real components, not pictures, so they follow the
// theme. Each keeps drifting at its own speed while pinned, which is what
// makes them look like they float at different heights above the screenshot.
//
// Phones and tablets skip the pinning: the screenshot just tilts flat as it
// scrolls up. Reduced motion shows the finished arrangement, unpinned.
export function ProductStage() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;

    const apply = (tilt: number, progress: number, heading: number) => {
      const set = (name: string, value: number) =>
        stage.style.setProperty(name, value.toFixed(4));
      set("--tilt", tilt);
      set("--heading", heading);
      set("--card-1", phase(progress, 0.32, 0.54));
      set("--card-2", phase(progress, 0.42, 0.64));
      set("--card-3", phase(progress, 0.52, 0.74));
      set("--card-4", phase(progress, 0.62, 0.84));
      set("--drift", progress - 0.84);
    };

    if (prefersReducedMotion()) {
      apply(0, 0.84, 1);
      return;
    }

    const pinned = window.matchMedia("(min-width: 1024px)");
    let tilt: number | null = null;
    let progress = 0;

    return addLayer(() => {
      const vh = window.innerHeight;
      let tiltGoal: number;
      let progressGoal: number;

      if (pinned.matches) {
        const rect = section.getBoundingClientRect();
        // 0 -> 1 while the section's top travels from the bottom of the
        // screen up to the navbar (before pinning starts).
        const entering = clamp01(
          1 - (rect.top - NAV_HEIGHT) / (vh - NAV_HEIGHT),
        );
        // 0 -> 1 across the pinned stretch.
        const pinRange = rect.height - stage.offsetHeight;
        progressGoal = clamp01((NAV_HEIGHT - rect.top) / pinRange);
        tiltGoal =
          entering < 1
            ? 1 - 0.4 * entering
            : 0.6 * (1 - phase(progressGoal, 0, 0.42));
      } else {
        const top = stage.getBoundingClientRect().top;
        tiltGoal = clamp01((top - vh * 0.1) / (vh * 0.7));
        progressGoal = 0;
      }

      tilt = tilt === null ? tiltGoal : ease(tilt, tiltGoal);
      progress = ease(progress, progressGoal);
      // Unpinned (small screens) there's no sequence, so the heading is
      // simply there.
      apply(tilt, progress, pinned.matches ? phase(progress, 0.04, 0.3) : 1);
      return tilt !== tiltGoal || progress !== progressGoal;
    });
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative lg:h-[230vh] motion-reduce:lg:h-auto"
    >
      {/* Where the navbar's "Product" link lands: far enough into the pinned
          stretch that the whole arrangement is already in place. */}
      <span id="product" aria-hidden className="absolute top-0 lg:top-[45%]" />

      <div
        ref={stageRef}
        className="flex flex-col items-center justify-center overflow-hidden px-4 pt-6 pb-20 sm:px-6 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:py-0 motion-reduce:lg:static motion-reduce:lg:h-auto motion-reduce:lg:py-24"
        style={
          {
            "--tilt": 1,
            "--card-1": 0,
            "--card-2": 0,
            "--card-3": 0,
            "--card-4": 0,
            "--heading": 1,
            "--drift": 0,
          } as CSSProperties
        }
      >
        <div
          className="mb-8 max-w-2xl text-center lg:mb-6"
          style={{
            opacity: "var(--heading)",
            transform: "translate3d(0, calc((1 - var(--heading)) * 16px), 0)",
          }}
        >
          <p className="text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
            01 / Product
          </p>
          <h2 className="mt-4 font-heading text-4xl leading-[1.02] font-semibold tracking-[-0.035em] text-balance text-zinc-950 sm:text-5xl dark:text-zinc-100">
            One screen for the whole response.
          </h2>
        </div>

        <div className="relative w-full max-w-[1200px] [perspective:2200px] lg:w-[min(1200px,calc((100vh-15rem)*1.6))]">
          <div
            className={cn(SHOT_FRAME, "origin-top")}
            style={{
              opacity: "calc(1 - var(--tilt) * 0.5)",
              transform: [
                "translate3d(0, calc(var(--tilt) * 50px), 0)",
                "rotateX(calc(var(--tilt) * 34deg))",
                "rotateY(calc(var(--tilt) * -10deg))",
                "rotateZ(calc(var(--tilt) * 4deg))",
                "scale(calc(1 - var(--tilt) * 0.1))",
              ].join(" "),
            }}
          >
            <ShotImages
              name="dashboard"
              alt="The Vigil dashboard: active alerts, open incidents, response times, incident activity for the week and who is on call."
              priority
            />
          </div>

          <FloatingCard
            index={1}
            from={{ x: -90, y: 30 }}
            drift={-70}
            className="top-[36%] w-56 lg:-left-3 xl:-left-[9%]"
          >
            <StatCard
              label="MTTA (7d)"
              value={dashboardStats.mtta}
              icon={TimerIcon}
              trend={dashboardStats.trends.mtta}
              target={{
                actualSeconds: dashboardStats.mttaSeconds,
                targetSeconds: MTTA_TARGET_SECONDS,
              }}
            />
          </FloatingCard>

          <FloatingCard
            index={2}
            from={{ x: 90, y: -30 }}
            drift={50}
            className="top-[8%] lg:-right-3 xl:-right-[7%]"
          >
            <div className="flex items-center gap-3 rounded-xl border border-black/[0.08] px-4 py-3 dark:border-white/[0.08]">
              <div>
                <p className="text-sm font-medium whitespace-nowrap text-zinc-900 dark:text-zinc-100">
                  INC-140 acknowledged
                </p>
                <p className="text-xs whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                  Rahul Verma · 2 minutes after the page
                </p>
              </div>
            </div>
          </FloatingCard>

          <FloatingCard
            index={3}
            from={{ x: 90, y: 50 }}
            drift={-110}
            className="bottom-[4%] w-72 lg:-right-3 xl:-right-[10%]"
          >
            <OnCallPanel entries={onCallNow.slice(0, 2)} />
          </FloatingCard>

          <FloatingCard
            index={4}
            from={{ x: -90, y: 50 }}
            drift={90}
            className="bottom-[9%] lg:-left-3 xl:-left-[6%]"
          >
            <div className="flex items-center gap-3 rounded-xl border border-black/[0.08] px-4 py-3 dark:border-white/[0.08]">
              <StatusDot status="TRIGGERED" />
              <span className="font-mono text-xs text-zinc-500">INC-142</span>
              <SeverityBadge severity="CRITICAL" />
              <div className="pr-2">
                <p className="text-sm font-medium whitespace-nowrap text-zinc-900 dark:text-zinc-100">
                  Database connection pool exhausted
                </p>
                <p className="text-xs whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                  Checkout API · 2m ago
                </p>
              </div>
              <span className="rounded-lg bg-emerald-400 px-2.5 py-1 text-xs font-medium text-(--brand-foreground)">
                Acknowledge
              </span>
            </div>
          </FloatingCard>
        </div>
      </div>
    </section>
  );
}

// One of the cards that slides in over the screenshot. `from` is where it
// starts relative to its resting place (it also grows from 86% size);
// `drift` is how many pixels it keeps
// moving per full pass through the pinned stretch.
function FloatingCard({
  index,
  from,
  drift,
  className,
  children,
}: {
  index: 1 | 2 | 3 | 4;
  from: { x: number; y: number };
  drift: number;
  className?: string;
  children: ReactNode;
}) {
  const shown = `var(--card-${index})`;

  return (
    <div
      aria-hidden
      className={cn(
        "absolute hidden rounded-xl bg-white shadow-[0_24px_50px_-20px_rgba(0,0,0,0.35)] will-change-transform lg:block dark:bg-(--ink-1) dark:shadow-[0_24px_60px_-20px_rgba(0,0,0,1)]",
        className,
      )}
      style={{
        opacity: shown,
        transform: `translate3d(calc((1 - ${shown}) * ${from.x}px), calc((1 - ${shown}) * ${from.y}px + var(--drift) * ${drift}px), 0) scale(calc(0.86 + ${shown} * 0.14))`,
      }}
    >
      {children}
    </div>
  );
}
