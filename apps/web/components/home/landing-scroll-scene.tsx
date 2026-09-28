"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  WorldMapBackdrop,
  type Hub,
  type MapCamera,
} from "@/components/home/world-map-backdrop";

// Where the camera stops, in order. Module-level so the map's effect sees
// a stable array.
const STOPS: readonly Hub[] = ["saoPaulo", "noida"];

// The story the scroll tells: a client in São Paulo raises an incident,
// the alert is routed across to the on-call team in Noida, and they
// resolve it. Illustrative figures, not live data.
const CLIENT = {
  label: "Client · São Paulo, Brazil",
  reported: 12906,
  details: [
    ["Region", "South America"],
    ["Services watched", "48"],
  ],
} as const;

const TEAM = {
  label: "Team · Noida, India",
  resolved: 12480,
  details: [
    ["Acknowledged", "< 2 min"],
    ["Median resolve", "14 min"],
    ["On call", "24/7, 3 rotations"],
  ],
} as const;

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
// 0..1 across [from, to] with smooth ease-in-out, for each phase below.
const phase = (p: number, from: number, to: number) => {
  const k = clamp01((p - from) / (to - from));
  return k * k * (3 - 2 * k);
};

const format = (n: number) => Math.round(n).toLocaleString("en-US");

// Shared enter/exit motion for the stat panels, driven by two CSS vars per
// panel: `in` swings it forward out of depth from the right, `out` lifts it
// away; both blur, so one panel dissolves into the next rather than
// cutting.
const panelStyle = (name: string): CSSProperties => ({
  opacity: `calc(var(--${name}-in) * (1 - var(--${name}-out)))`,
  filter: `blur(calc((1 - var(--${name}-in) + var(--${name}-out)) * var(--panel-blur)))`,
  transform: [
    `translate3d(calc((1 - var(--${name}-in)) * var(--panel-shift)), calc(var(--${name}-out) * -48px), calc((1 - var(--${name}-in)) * -220px))`,
    `rotateY(calc((1 - var(--${name}-in)) * var(--tilt) * -16deg))`,
  ].join(" "),
  visibility: "hidden",
});

// Scroll-driven landing scene. A tall section pins a full-height stage
// (sticky, under the navbar) while its scroll range plays one timeline:
//   0.00-0.14  hero tilts back into depth and fades
//   0.04-0.34  map tilts into a 3D plane and zooms in on São Paulo
//   0.26-0.38  client panel swings in, numbers counting up
//   0.48-0.56  ...and dissolves away
//   0.52-0.78  camera flies the route to Noida behind the alert pulse
//   0.56-0.72  "alert routed" caption shows mid-flight
//   0.68-0.80  team panel swings in (just before the camera lands), held
// Scroll position is eased toward (lerped) every frame rather than applied
// raw, which is what makes it glide instead of stepping with each wheel
// tick. Every layer reads the eased phases as CSS variables set straight on
// the DOM (and the map through a ref), so scrolling never re-renders React.
// Reduced motion skips the easing and the 3D rotations, but keeps the
// zoom, glide and fades, since those follow the user's own scrolling.
export function LandingScrollScene({ hero }: { hero: ReactNode }) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<HTMLDivElement>(null);
  const transitRef = useRef<HTMLDivElement>(null);
  const teamRef = useRef<HTMLDivElement>(null);
  const reportedRef = useRef<HTMLSpanElement>(null);
  const resolvedRef = useRef<HTMLSpanElement>(null);
  const cameraRef = useRef<MapCamera>({ zoom: 0, stop: 0 });

  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    const heroEl = heroRef.current;
    const layers = [clientRef, transitRef, teamRef].map((r) => r.current);
    if (!section || !stage || !heroEl || layers.some((el) => !el)) return;
    const [clientEl, transitEl, teamEl] = layers as HTMLDivElement[];

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    stage.style.setProperty("--tilt", reduceMotion ? "0" : "1");

    let target = 0;
    let current = -1;
    let rafId = 0;

    const measure = () => {
      const total = section.offsetHeight - stage.offsetHeight;
      target =
        total > 0 ? clamp01(-section.getBoundingClientRect().top / total) : 0;
    };

    const setVar = (name: string, v: number) =>
      stage.style.setProperty(`--${name}`, v.toFixed(4));

    const apply = (p: number) => {
      const heroK = phase(p, 0, 0.14);
      const zoom = phase(p, 0.04, 0.34);
      const clientIn = phase(p, 0.26, 0.38);
      const clientOut = phase(p, 0.48, 0.56);
      const transitIn = phase(p, 0.56, 0.62);
      const transitOut = phase(p, 0.66, 0.72);
      const teamIn = phase(p, 0.68, 0.8);
      setVar("hero", heroK);
      setVar("map", zoom);
      setVar("client-in", clientIn);
      setVar("client-out", clientOut);
      setVar("transit-in", transitIn);
      setVar("transit-out", transitOut);
      setVar("team-in", teamIn);
      setVar("team-out", 0);
      cameraRef.current.zoom = zoom;
      cameraRef.current.stop = phase(p, 0.52, 0.78);

      // Faded-out layers mustn't swallow clicks meant for another one.
      heroEl.style.pointerEvents = heroK > 0.6 ? "none" : "";
      heroEl.style.visibility = heroK > 0.999 ? "hidden" : "";
      const hideBelow = (el: HTMLElement, shown: number) => {
        el.style.visibility = shown < 0.001 ? "hidden" : "";
      };
      hideBelow(clientEl, clientIn * (1 - clientOut));
      hideBelow(transitEl, transitIn * (1 - transitOut));
      hideBelow(teamEl, teamIn);

      if (reportedRef.current) {
        reportedRef.current.textContent = format(CLIENT.reported * clientIn);
      }
      if (resolvedRef.current) {
        resolvedRef.current.textContent = format(TEAM.resolved * teamIn);
      }
    };

    const frame = () => {
      rafId = 0;
      const next =
        reduceMotion || current < 0
          ? target
          : current + (target - current) * 0.1;
      current = Math.abs(target - next) < 0.0004 ? target : next;
      apply(current);
      if (current !== target) rafId = requestAnimationFrame(frame);
    };

    const kick = () => {
      measure();
      if (!rafId) rafId = requestAnimationFrame(frame);
    };

    kick();
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", kick);
      window.removeEventListener("resize", kick);
    };
  }, []);

  // Both panels share one slot: right of the focus hub on desktop, under
  // it on phones.
  const slot =
    "pointer-events-none absolute inset-x-4 bottom-[7%] sm:inset-x-6 md:inset-x-auto md:top-1/2 md:bottom-auto md:left-[56%] md:-translate-y-1/2";

  // Frosted backing so the copy stays legible over the dots and routes
  // behind it. Padding widens the box rather than squeezing the text.
  const panel =
    "pointer-events-auto max-w-[26rem] rounded-2xl bg-white/60 p-5 backdrop-blur-xl will-change-transform sm:p-6 dark:bg-zinc-950/50";

  return (
    // The height is the scroll distance the timeline plays over.
    <section ref={sectionRef} className="relative h-[520vh]">
      <div
        // svh, not dvh: stays put while a phone's browser bars slide in
        // and out, so the stage (and the map canvas) doesn't resize and
        // re-lay out mid-scroll. The --panel-* vars tone the panel motion
        // down on phones, where a big blur is costly and a wide swing
        // runs off the edge.
        ref={stageRef}
        className="sticky top-14 h-[calc(100svh-3.5rem)] overflow-hidden perspective-[1400px] [--panel-blur:8px] [--panel-shift:70px] max-md:[--panel-blur:4px] max-md:[--panel-shift:28px]"
        style={
          {
            "--hero": 0,
            "--map": 0,
            "--client-in": 0,
            "--client-out": 0,
            "--transit-in": 0,
            "--transit-out": 0,
            "--team-in": 0,
            "--team-out": 0,
            "--tilt": 1,
          } as CSSProperties
        }
      >
        {/* Map plane: tips back like a table top as it zooms. */}
        <div
          className="absolute inset-0 will-change-transform"
          style={{
            transform:
              "rotateX(calc(var(--map) * var(--tilt) * 24deg)) scale(calc(1 + var(--map) * 0.06))",
            transformOrigin: "50% 60%",
          }}
        >
          <WorldMapBackdrop camera={cameraRef} stops={STOPS} />
        </div>

        {/* Hero: moves up and away into depth, faster than the map below
            it (the parallax). */}
        <div
          ref={heroRef}
          className="absolute inset-0 flex items-center justify-center px-4 pb-10 will-change-transform sm:px-6"
          style={{
            opacity: "calc(1 - var(--hero))",
            transform:
              "translate3d(0, calc(var(--hero) * -90px), calc(var(--hero) * -260px)) rotateX(calc(var(--hero) * var(--tilt) * 16deg))",
          }}
        >
          {hero}
        </div>

        <div className={slot}>
          <div
            ref={clientRef}
            className={panel}
            style={panelStyle("client")}
          >
            <Eyebrow>{CLIENT.label}</Eyebrow>
            <p className="mt-3 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
              <span ref={reportedRef}>0</span>
              <span className="ml-3 text-lg font-normal text-muted-foreground sm:text-xl">
                incidents raised
              </span>
            </p>
            <p className="mt-2 text-sm text-pretty text-muted-foreground">
              Every one of them lands with Vigil the moment it fires.
            </p>
            <Details rows={CLIENT.details} />
          </div>
        </div>

        {/* Mid-flight caption, while the pulse carries the alert across. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[12%] flex justify-center px-4">
          <div
            ref={transitRef}
            className="flex items-center gap-2 rounded-full border whitespace-nowrap border-black/[0.06] bg-white/70 px-3.5 py-1.5 text-xs text-muted-foreground backdrop-blur-sm will-change-transform dark:border-white/[0.08] dark:bg-zinc-950/60"
            style={panelStyle("transit")}
          >
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full rounded-full bg-emerald-400/70 motion-safe:animate-ping" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            </span>
            Alert routed São Paulo → Noida
            <span className="hidden sm:inline">· on-call paged in 0.8s</span>
          </div>
        </div>

        <div className={slot}>
          <div
            ref={teamRef}
            className={panel}
            style={panelStyle("team")}
          >
            <Eyebrow>{TEAM.label}</Eyebrow>
            <p className="mt-3 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
              <span ref={resolvedRef}>0</span>
              <span className="ml-3 text-lg font-normal text-muted-foreground sm:text-xl">
                resolved
              </span>
            </p>
            <p className="mt-2 text-sm text-pretty text-muted-foreground">
              Where Vigil keeps watch: the right engineer paged, the client
              kept in the loop, nothing slipping at 3&nbsp;a.m.
            </p>
            <Details rows={TEAM.details} />
          </div>
        </div>

        {/* Scroll cue, gone as soon as the hero starts moving. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-1 text-xs text-muted-foreground"
          style={{ opacity: "calc(1 - var(--hero) * 4)" }}
        >
          Scroll
          <ChevronDown className="size-4 motion-safe:animate-bounce" />
        </div>
      </div>
    </section>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-emerald-600 uppercase dark:text-emerald-400">
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </p>
  );
}

// Compact key/value rows under a panel's headline.
function Details({ rows }: { rows: readonly (readonly [string, string])[] }) {
  return (
    <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 border-t border-black/[0.06] pt-4 text-sm dark:border-white/[0.08]">
      {rows.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-muted-foreground">{term}</dt>
          <dd className="font-medium text-foreground tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
