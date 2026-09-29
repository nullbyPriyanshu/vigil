"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Tone = "red" | "amber" | "emerald";

type Incident = {
  id: number;
  status: string;
  tone: Tone;
  events: { time: string; title: string; detail: string; tone: Tone }[];
};

const INCIDENTS: Incident[] = [
  {
    id: 215,
    status: "Resolved",
    tone: "emerald",
    events: [
      {
        time: "09:42",
        title: "Alert triggered",
        detail: "payments-worker · queue depth above 10k",
        tone: "red",
      },
      {
        time: "09:42",
        title: "On-call engineer paged",
        detail: "Payments rotation · push notification",
        tone: "amber",
      },
      {
        time: "09:44",
        title: "Acknowledged",
        detail: "Response time 1m 38s",
        tone: "emerald",
      },
      {
        time: "10:05",
        title: "Resolved",
        detail: "Scaled workers from 4 to 12",
        tone: "emerald",
      },
    ],
  },
  {
    id: 216,
    status: "Acknowledged",
    tone: "amber",
    events: [
      {
        time: "14:03",
        title: "Alert triggered",
        detail: "auth-service · error rate 7.2%",
        tone: "red",
      },
      {
        time: "14:03",
        title: "On-call engineer paged",
        detail: "Identity rotation · SMS",
        tone: "amber",
      },
      {
        time: "14:06",
        title: "Acknowledged",
        detail: "Response time 3m 12s",
        tone: "emerald",
      },
      {
        time: "14:09",
        title: "Investigating",
        detail: "Status page updated",
        tone: "amber",
      },
    ],
  },
  {
    id: 217,
    status: "Resolved",
    tone: "emerald",
    events: [
      {
        time: "23:17",
        title: "Alert triggered",
        detail: "db-primary · disk usage 92%",
        tone: "red",
      },
      {
        time: "23:17",
        title: "On-call engineer paged",
        detail: "Infra rotation · phone call",
        tone: "amber",
      },
      {
        time: "23:22",
        title: "Escalated",
        detail: "No response in 5m · secondary paged",
        tone: "amber",
      },
      {
        time: "23:40",
        title: "Resolved",
        detail: "Expanded volume to 1 TB",
        tone: "emerald",
      },
    ],
  },
  {
    id: 218,
    status: "Triggered",
    tone: "red",
    events: [
      {
        time: "04:51",
        title: "Alert triggered",
        detail: "cdn-edge · 5xx spike in eu-west",
        tone: "red",
      },
      {
        time: "04:51",
        title: "On-call engineer paged",
        detail: "SRE rotation · push notification",
        tone: "amber",
      },
      {
        time: "04:56",
        title: "Escalated",
        detail: "Secondary on-call paged",
        tone: "amber",
      },
      {
        time: "04:57",
        title: "Awaiting acknowledgement",
        detail: "Next escalation in 5m",
        tone: "red",
      },
    ],
  },
];

// How long each card stays put, and how long the swipe to the next one takes.
const HOLD_MS = 3000;
const SLIDE_MS = 700;

const DOT: Record<Tone, string> = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
};

const BADGE: Record<Tone, string> = {
  red: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  amber:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  emerald:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

// Left column for the login/signup pages: mock incident cards that swipe
// left every couple of seconds, with the landing page's tagline under them.
export function AuthShowcase() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = setInterval(
      () => setActive((i) => (i + 1) % INCIDENTS.length),
      HOLD_MS + SLIDE_MS,
    );
    return () => clearInterval(id);
  }, [paused]);

  return (
    <div className="flex h-full items-center justify-center px-10">
      <div className="w-full max-w-[400px]">
        <div
          className="grid overflow-hidden rounded-xl"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {INCIDENTS.map((incident, i) => {
            // 0 = on screen, n-1 = the card that just left, anything else is
            // waiting off to the right.
            const offset =
              (i - active + INCIDENTS.length) % INCIDENTS.length;
            const isActive = offset === 0;
            const isLeaving = offset === INCIDENTS.length - 1;

            return (
              <IncidentCard
                key={incident.id}
                incident={incident}
                className={cn(
                  "[grid-area:1/1]",
                  isActive
                    ? "translate-x-0 opacity-100"
                    : isLeaving
                      ? "-translate-x-full opacity-0"
                      : "translate-x-full opacity-0",
                  // Only the cards entering and leaving animate. The rest jump
                  // back to the right while invisible.
                  (isActive || isLeaving) &&
                    "transition-[translate,opacity] ease-in-out motion-reduce:transition-none",
                )}
                style={{ transitionDuration: `${SLIDE_MS}ms` }}
              />
            );
          })}
        </div>

        <div className="mt-4 flex justify-center gap-1.5">
          {INCIDENTS.map((incident, i) => (
            <span
              key={incident.id}
              className={cn(
                "h-1.5 rounded-full transition-all duration-500",
                i === active ? "w-5 bg-emerald-500" : "w-1.5 bg-border",
              )}
            />
          ))}
        </div>

        <div className="mt-8 space-y-2">
          <p className="text-lg font-medium tracking-tight text-foreground">
            On-call, without the chaos.
          </p>
          <p className="text-sm text-muted-foreground">
            Know who&apos;s on call, get the right person paged, and close
            incidents faster.
          </p>
        </div>
      </div>
    </div>
  );
}

function IncidentCard({
  incident,
  className,
  style,
}: {
  incident: Incident;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-card/60 p-5", className)}
      style={style}
    >
      <div className="mb-5 flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          Incident #{incident.id}
        </span>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-xs font-medium",
            BADGE[incident.tone],
          )}
        >
          {incident.status}
        </span>
      </div>

      <ol>
        {incident.events.map((event, i) => (
          <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
            {i < incident.events.length - 1 && (
              <span
                aria-hidden
                className="absolute top-3 bottom-0 left-[3.5px] w-px bg-border"
              />
            )}
            <span
              aria-hidden
              className={cn(
                "relative mt-1.5 size-2 shrink-0 rounded-full",
                DOT[event.tone],
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-foreground">{event.title}</p>
                <time className="font-mono text-xs text-muted-foreground">
                  {event.time}
                </time>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {event.detail}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
