"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { SeverityBadge } from "@/components/shared/severity-badge";
import { StatusDot } from "@/components/shared/status-dot";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  addLayer,
  clamp01,
  ease,
  phase,
  prefersReducedMotion,
} from "@/components/home/scroll-engine";
import { cn } from "@/lib/utils";

const CARD =
  "rounded-xl border border-black/[0.08] bg-white p-4 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.3)] dark:border-white/[0.08] dark:bg-[#0a0a0a] dark:shadow-[0_16px_40px_-20px_rgba(0,0,0,0.9)]";

// Each step, with the small piece of the app that shows what it means.
const STEPS: { title: string; text: string; card: ReactNode }[] = [
  {
    title: "An alert comes in",
    text: "Your monitoring tool reports a problem and Vigil opens an incident for the affected service.",
    card: (
      <div className={CARD}>
        <div className="flex items-center gap-2.5">
          <StatusDot status="TRIGGERED" />
          <span className="font-mono text-xs text-zinc-500">INC-142</span>
          <SeverityBadge severity="CRITICAL" />
          <span className="ml-auto text-xs text-zinc-500">just now</span>
        </div>
        <p className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Database connection pool exhausted
        </p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Checkout API · reported by your monitoring
        </p>
      </div>
    ),
  },
  {
    title: "The right person is paged",
    text: "Vigil checks the schedule and notifies whoever is on call. No answer? It escalates.",
    card: (
      <div className={CARD}>
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Paging Platform Team
        </p>
        <div className="mt-3 flex items-center gap-3">
          <UserAvatar name="Priyanshu Maurya" className="size-8 text-[11px]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Priyanshu Maurya
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              On call · notified by push and SMS
            </p>
          </div>
          <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <CheckIcon className="size-3" />
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-black/[0.06] pt-3 text-xs text-zinc-500 dark:border-white/[0.06] dark:text-zinc-400">
          <ArrowRightIcon className="size-3 shrink-0" />
          No answer in 5 min: escalates to Rahul Verma
        </div>
      </div>
    ),
  },
  {
    title: "Resolved, with a record",
    text: "They acknowledge, fix and resolve. The full timeline is kept for the review afterwards.",
    card: (
      <div className={CARD}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            INC-142 timeline
          </p>
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Resolved in 17m
          </span>
        </div>
        <ul className="mt-3 space-y-2.5 text-sm">
          {(
            [
              ["TRIGGERED", "Alert triggered", "02:14"],
              ["ACKNOWLEDGED", "Acknowledged by Priyanshu", "02:16"],
              ["RESOLVED", "Resolved: rolled back deploy", "02:31"],
            ] as const
          ).map(([status, label, time]) => (
            <li key={status} className="flex items-center gap-2.5">
              <StatusDot status={status} />
              <span className="flex-1 text-zinc-800 dark:text-zinc-200">
                {label}
              </span>
              <time className="font-mono text-xs text-zinc-500">{time}</time>
            </li>
          ))}
        </ul>
      </div>
    ),
  },
];

// Where along the line (0 = top, 1 = bottom) each step switches on. Spread
// so the first lights up as the section arrives and the last just before
// the line is full.
const STEP_AT = [0.04, 0.4, 0.76];

// The three steps as a timeline you scroll through. A green line fills
// downward as the section passes the middle of the screen; when it reaches
// a step, that step's number lights up, its text sharpens and its card
// slides in. Reduced motion shows everything lit from the start.
export function HowItWorks() {
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const apply = (fill: number) => {
      list.style.setProperty("--fill", fill.toFixed(4));
      STEP_AT.forEach((at, i) => {
        list.style.setProperty(
          `--step-${i + 1}`,
          phase(fill, at, at + 0.14).toFixed(4),
        );
      });
    };

    if (prefersReducedMotion()) {
      apply(1);
      return;
    }

    let current = 0;
    return addLayer(() => {
      const rect = list.getBoundingClientRect();
      // How far the point 62% down the screen has travelled through the list.
      const goal = clamp01(
        (window.innerHeight * 0.62 - rect.top) / rect.height,
      );
      current = ease(current, goal, 0.08);
      apply(current);
      return current !== goal;
    });
  }, []);

  return (
    <ol
      ref={listRef}
      className="relative space-y-12 sm:space-y-16"
      style={
        {
          "--fill": 0,
          "--step-1": 0,
          "--step-2": 0,
          "--step-3": 0,
        } as CSSProperties
      }
    >
      {/* The track, and the green fill that grows down it. */}
      <span
        aria-hidden
        className="absolute top-2 bottom-2 left-[19px] w-px bg-black/10 dark:bg-white/10"
      />
      <span
        aria-hidden
        className="absolute top-2 bottom-2 left-[19px] w-px origin-top bg-emerald-500 will-change-transform"
        style={{ transform: "scaleY(var(--fill))" }}
      />

      {STEPS.map((step, i) => {
        const on = `var(--step-${i + 1})`;
        return (
          <li
            key={step.title}
            className="relative grid items-center gap-x-10 gap-y-5 pl-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]"
          >
            {/* The numbered marker: an outline that fills in when reached. */}
            <span
              aria-hidden
              className="absolute top-0 left-0 flex size-10 items-center justify-center rounded-full border border-black/15 bg-white font-mono text-sm text-zinc-500 dark:border-white/15 dark:bg-[#050505] dark:text-zinc-400"
            >
              <span
                className="absolute inset-0 rounded-full bg-emerald-500"
                style={{ opacity: on, transform: `scale(calc(0.6 + ${on} * 0.4))` }}
              />
              <span className="relative" style={{ opacity: `calc(1 - ${on})` }}>
                {i + 1}
              </span>
              <span
                className="absolute font-medium text-zinc-950"
                style={{ opacity: on }}
              >
                {i + 1}
              </span>
            </span>

            <div style={{ opacity: `calc(0.4 + ${on} * 0.6)` }}>
              <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                {step.title}
              </h3>
              <p className="mt-2 max-w-md text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                {step.text}
              </p>
            </div>

            <div
              aria-hidden
              className={cn("will-change-transform")}
              style={{
                opacity: on,
                transform: `translate3d(calc((1 - ${on}) * 40px), 0, 0) scale(calc(0.96 + ${on} * 0.04))`,
              }}
            >
              {step.card}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
