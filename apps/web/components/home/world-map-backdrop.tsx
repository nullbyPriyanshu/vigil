"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { useTheme } from "next-themes";
import {
  WORLD_GRID_LAT_TOP,
  WORLD_GRID_STEP,
  WORLD_ROWS,
} from "@/lib/world-dots";
import { cn } from "@/lib/utils";

// Hub cities the network runs between, as [lat, lon].
const HUBS = {
  sf: [37.8, -122.4],
  toronto: [43.7, -79.4],
  ny: [40.7, -74],
  saoPaulo: [-23.5, -46.6],
  london: [51.5, -0.1],
  frankfurt: [50.1, 8.7],
  lagos: [6.5, 3.4],
  johannesburg: [-26.2, 28],
  dubai: [25.2, 55.3],
  mumbai: [19.1, 72.9],
  noida: [28.54, 77.39],
  singapore: [1.35, 103.8],
  tokyo: [35.7, 139.7],
  sydney: [-33.9, 151.2],
} as const satisfies Record<string, readonly [number, number]>;

export type Hub = keyof typeof HUBS;

const LINKS: [Hub, Hub][] = [
  ["sf", "ny"],
  ["sf", "tokyo"],
  ["toronto", "london"],
  ["ny", "london"],
  ["ny", "saoPaulo"],
  ["saoPaulo", "noida"],
  ["saoPaulo", "lagos"],
  ["london", "frankfurt"],
  ["frankfurt", "dubai"],
  ["lagos", "johannesburg"],
  ["johannesburg", "mumbai"],
  ["dubai", "mumbai"],
  ["dubai", "noida"],
  ["mumbai", "noida"],
  ["noida", "singapore"],
  ["mumbai", "singapore"],
  ["singapore", "tokyo"],
  ["singapore", "sydney"],
  ["tokyo", "sydney"],
];

const COLS = WORLD_ROWS[0].length;
const ROWS = WORLD_ROWS.length;
// Fraction of an arc's length the travelling pulse's tail covers.
const TAIL = 0.28;
const ARC_SAMPLES = 28;

// Deterministic per-link timing, so the pulses are staggered rather than
// firing in lockstep (and stay the same across renders).
const TIMINGS = LINKS.map((_, i) => ({
  travel: 2.6 + ((i * 7) % 5) * 0.35,
  gap: 1.2 + ((i * 11) % 7) * 0.4,
  offset: (i * 1.37) % 6,
}));

type Point = { x: number; y: number };

// Scroll-driven camera, written by the caller each frame. `zoom` is 0..1
// (full map -> zoomed in); `stop` is a fractional index into `stops`, so
// 0.5 is halfway along the glide from the first stop to the second.
export type MapCamera = { zoom: number; stop: number };

const DEFAULT_STOPS: readonly Hub[] = ["saoPaulo"];

// Longitude the portrait framing is centred on.
const PORTRAIT_LON = -12;

// Each hub snapped to the nearest land dot on the grid, so its marker sits
// exactly on a dot (the raw coordinates land between them, which shows
// once the camera zooms in). Searches a few cells out; coastal cities can
// fall on a "sea" cell at this resolution.
const HUB_CELLS = Object.fromEntries(
  Object.entries(HUBS).map(([name, [lat, lon]]) => {
    const fc = (lon + 180) / WORLD_GRID_STEP - 0.5;
    const fr = (WORLD_GRID_LAT_TOP - lat) / WORLD_GRID_STEP - 0.5;
    let best = { col: Math.round(fc), row: Math.round(fr) };
    let bestDist = Infinity;
    for (let row = Math.floor(fr) - 3; row <= Math.ceil(fr) + 3; row++) {
      for (let col = Math.floor(fc) - 3; col <= Math.ceil(fc) + 3; col++) {
        if (WORLD_ROWS[row]?.[col] !== "#") continue;
        const dist = (col - fc) ** 2 + (row - fr) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          best = { col, row };
        }
      }
    }
    return [name, best];
  }),
) as Record<Hub, { col: number; row: number }>;

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

const quad = (a: Point, c: Point, b: Point, t: number): Point => {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
};

// Low-opacity dotted world map with pulses travelling along arcs between
// hub cities, all on one canvas. Follows the resolved theme in JS for the
// same reason SpotlightBackdrop does: CSS `dark:` can't reach canvas draw
// calls.
//
// Optionally scroll-driven through `camera`, a ref (already eased) the
// caller updates as the page scrolls. At zoom 0 the whole map is shown;
// toward 1 the camera zooms in on the current stop, easing it to the left
// third of the canvas (upper third on narrow screens), and every route not
// touching it dims. Between stops it glides from one hub to the next,
// pulling back a little mid-way so the move reads as travel rather than a
// flat pan; when a route links the two, it flies along that route behind a
// bright pulse. Read from a ref every frame rather than a prop so scrolling
// never re-renders React. At zoom 0 the land dots come from a cache drawn
// once per resize/theme change; zoomed in, they're re-projected each frame
// (culled to the viewport) so they stay crisp instead of scaling a bitmap.
// Reduced motion keeps the zoom (it's scroll, i.e. user-driven) but drops
// the pulses and breathing.
export function WorldMapBackdrop({
  className,
  camera,
  stops = DEFAULT_STOPS,
  emphasis = 1,
}: {
  className?: string;
  // Multiplies how visible the land dots and resting routes are. 1 suits a
  // backdrop behind text; raise it where the map is the picture itself.
  emphasis?: number;
  camera?: RefObject<MapCamera>;
  // Keep this referentially stable (a module constant): it's an effect
  // dependency.
  stops?: readonly Hub[];
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const parent = canvas?.parentElement;
    if (!canvas || !ctx || !parent) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const dotRGB = isDark ? "241,240,238" : "13,13,13";
    const dotAlpha = (isDark ? 0.14 : 0.16) * emphasis;
    // Periwinkle on dark, Twilight Indigo on light: the app's accent.
    const accentRGB = isDark ? "241,240,238" : "13,13,13";

    const cache = document.createElement("canvas");
    const cacheCtx = cache.getContext("2d");
    if (!cacheCtx) return;

    let width = 0;
    let height = 0;
    let dotR = 1;
    let dots = new Float32Array(0);
    let hubPoints = {} as Record<Hub, Point>;
    let arcs: { a: Point; c: Point; b: Point; from: Hub; to: Hub }[] = [];
    let rafId = 0;
    let lastZoom = -1;
    let lastStop = -1;
    let portrait = false;
    let dirty = true;

    const layout = () => {
      width = parent.clientWidth;
      height = parent.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      // Landscape: fit the map's width, but never let it outgrow the
      // height, so short viewports still show the whole thing, centred.
      // Portrait (phones, 9:16-ish): a separate framing. Fitting the width
      // there shrinks the world to a thin strip, so the map is sized to
      // the height instead and cropped to a region around PORTRAIT_LON
      // (South America, the Atlantic, Africa and Europe); the scroll then
      // flies east to reach Noida.
      portrait = height > width * 1.2;
      const cell = portrait
        ? (height * 0.78) / ROWS
        : Math.min(width / COLS, (height * 1.05) / ROWS);
      const offsetX = portrait
        ? width / 2 - ((PORTRAIT_LON + 180) / WORLD_GRID_STEP) * cell
        : (width - cell * COLS) / 2;
      const offsetY = (height - cell * ROWS) / 2;
      dotR = Math.max(cell * 0.24, 0.8);

      hubPoints = Object.fromEntries(
        Object.entries(HUB_CELLS).map(([name, { col, row }]) => [
          name,
          { x: offsetX + (col + 0.5) * cell, y: offsetY + (row + 0.5) * cell },
        ]),
      ) as Record<Hub, Point>;

      // Each arc bows away from the equator by a fraction of its length,
      // which reads as a great-circle-ish flight path.
      arcs = LINKS.map(([from, to]) => {
        const a = hubPoints[from];
        const b = hubPoints[to];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        let nx = -dy / len;
        let ny = dx / len;
        if (ny > 0) {
          nx = -nx;
          ny = -ny;
        }
        const lift = len * 0.22;
        return {
          a,
          b,
          c: { x: (a.x + b.x) / 2 + nx * lift, y: (a.y + b.y) / 2 + ny * lift },
          from,
          to,
        };
      });

      const centers: number[] = [];
      for (let row = 0; row < ROWS; row++) {
        const line = WORLD_ROWS[row];
        for (let col = 0; col < COLS; col++) {
          if (line[col] !== "#") continue;
          centers.push(offsetX + (col + 0.5) * cell, offsetY + (row + 0.5) * cell);
        }
      }
      dots = Float32Array.from(centers);

      for (const c of [canvas, cache]) {
        c.width = Math.round(width * dpr);
        c.height = Math.round(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cacheCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cacheCtx.clearRect(0, 0, width, height);
      cacheCtx.fillStyle = `rgba(${dotRGB},${dotAlpha})`;
      cacheCtx.beginPath();
      for (let i = 0; i < dots.length; i += 2) {
        cacheCtx.moveTo(dots[i] + dotR, dots[i + 1]);
        cacheCtx.arc(dots[i], dots[i + 1], dotR, 0, Math.PI * 2);
      }
      cacheCtx.fill();
      dirty = true;
    };

    const draw = (time: number, m: number, stop: number) => {
      // Nothing to draw into while hidden/unsized, and drawImage throws on
      // a zero-sized source canvas.
      if (!width || !height) return;
      const t = reduceMotion ? 0 : time / 1000;
      ctx.clearRect(0, 0, width, height);

      // Which two stops the camera is between, and how far along.
      const clamped = Math.min(Math.max(stop, 0), stops.length - 1);
      const i0 = Math.floor(clamped);
      const i1 = Math.min(i0 + 1, stops.length - 1);
      const k = clamped - i0;
      // The route between the two stops, if the map has one: the camera
      // then flies along its curve (with a pulse leading it) instead of
      // cutting straight across.
      const leg = arcs.find(
        (arc) =>
          (arc.from === stops[i0] && arc.to === stops[i1]) ||
          (arc.from === stops[i1] && arc.to === stops[i0]),
      );
      const legK = leg && leg.from === stops[i0] ? k : 1 - k;
      // How much each hub counts as "the focus" right now: 1 for the stop
      // the camera is resting on, cross-fading between two while gliding.
      const focusWeight = (name: Hub) =>
        Math.min(
          (name === stops[i0] ? 1 - k : 0) + (name === stops[i1] ? k : 0),
          1,
        );

      // Camera: scale around the focus point while sliding it from where
      // it sits on the full map to its resting spot. Mid-glide it pulls
      // back to ~65% of the zoom, then pushes in again on arrival.
      // Portrait already starts close in, so it needs less zoom.
      const narrow = width < 768;
      const z =
        (1 + m * ((portrait ? 1.8 : narrow ? 2.2 : 3.2) - 1)) *
        (1 - 0.35 * Math.sin(Math.PI * k));
      const from = hubPoints[stops[i0]];
      const to = hubPoints[stops[i1]];
      const f = leg
        ? quad(leg.a, leg.c, leg.b, legK)
        : { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
      const px = f.x + m * (width * (narrow ? 0.5 : 0.3) - f.x);
      // On phones the hub rests high, clear of the panel below it.
      const py = f.y + m * (height * (narrow ? 0.26 : 0.5) - f.y);
      const cam = (p: Point): Point => ({
        x: px + z * (p.x - f.x),
        y: py + z * (p.y - f.y),
      });

      if (m < 0.001) {
        ctx.drawImage(cache, 0, 0, width, height);
      } else {
        // Dots grow slower than the zoom, so zoomed-in land stays a fine
        // dot field instead of turning into blobs.
        const r = dotR * Math.pow(z, 0.55);
        ctx.fillStyle = `rgba(${dotRGB},${dotAlpha})`;
        ctx.beginPath();
        for (let i = 0; i < dots.length; i += 2) {
          const x = px + z * (dots[i] - f.x);
          const y = py + z * (dots[i + 1] - f.y);
          if (x < -r || x > width + r || y < -r || y > height + r) continue;
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      ctx.lineCap = "round";
      arcs.forEach((arc, i) => {
        const a = cam(arc.a);
        const c = cam(arc.c);
        const b = cam(arc.b);
        // Routes away from the focus fade back as the camera closes in.
        const w = Math.max(focusWeight(arc.from), focusWeight(arc.to));
        const dim = 1 + m * (w * 1.35 - 0.75);

        ctx.strokeStyle = `rgba(${accentRGB},${(isDark ? 0.07 : 0.1) * emphasis * dim})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(c.x, c.y, b.x, b.y);
        ctx.stroke();

        if (reduceMotion) return;

        const { travel, gap, offset } = TIMINGS[i];
        const cycle = ((t + offset) % (travel + gap)) / travel;
        // Eased so pulses leave and arrive gently instead of at a constant
        // speed.
        const head = cycle < 1 ? 0.5 - Math.cos(Math.PI * cycle) / 2 : 1;

        // Pulse: a tail of short segments fading out behind the head.
        if (cycle < 1 + TAIL) {
          const start = Math.max(0, head - TAIL);
          const end = Math.min(head, 1);
          const fadeOut = cycle > 1 ? 1 - (cycle - 1) / TAIL : 1;
          let prev = quad(a, c, b, start);
          for (let s = 1; s <= ARC_SAMPLES; s++) {
            const k = s / ARC_SAMPLES;
            const p = quad(a, c, b, start + (end - start) * k);
            ctx.strokeStyle = `rgba(${accentRGB},${Math.min(0.55 * k * fadeOut * dim, 0.85)})`;
            ctx.lineWidth = 1.25;
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            prev = p;
          }
        }

        // Ripple at the destination as the pulse lands.
        if (cycle >= 1 && cycle < 1.6) {
          const k = (cycle - 1) / 0.6;
          ctx.strokeStyle = `rgba(${accentRGB},${0.35 * (1 - k) * dim})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(b.x, b.y, 2 + k * 10, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      // Scroll-driven pulse carrying the camera between stops: its head
      // sits on the focus point, so the camera follows it along the route.
      if (leg && k > 0 && k < 1) {
        const a = cam(leg.a);
        const c = cam(leg.c);
        const b = cam(leg.b);
        const strength = Math.sin(Math.PI * k) * m;
        const dir = leg.from === stops[i0] ? 1 : -1;
        let prev = quad(a, c, b, legK);
        for (let s = 1; s <= ARC_SAMPLES; s++) {
          const q = s / ARC_SAMPLES;
          const p = quad(a, c, b, clamp01(legK - dir * 0.18 * q));
          ctx.strokeStyle = `rgba(${accentRGB},${0.9 * (1 - q) * strength})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          prev = p;
        }
        const head = quad(a, c, b, legK);
        ctx.fillStyle = `rgba(${accentRGB},${0.25 * strength})`;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${accentRGB},${strength})`;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Hubs, with a slow breathing glow.
      (Object.entries(hubPoints) as [Hub, Point][]).forEach(([name, hub], i) => {
        const p = cam(hub);
        const w = focusWeight(name) * m;
        const dim = 1 - m * 0.6 + w * 0.6;
        const breathe = reduceMotion ? 0.5 : 0.5 + Math.sin(t * 1.4 + i) / 2;
        ctx.fillStyle = `rgba(${accentRGB},${(0.1 + breathe * 0.1) * dim})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4.5 + w * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${accentRGB},${0.6 * dim + w * 0.35})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.6 + w * 1.4, 0, Math.PI * 2);
        ctx.fill();

        // Sonar rings off the focus hub once the camera has arrived; they
        // hand over from one stop to the next during a glide.
        if (w > 0.01) {
          const rings = reduceMotion ? [0.4] : [0, 0.5];
          for (const shift of rings) {
            const k = (t / 2.4 + shift) % 1;
            ctx.strokeStyle = `rgba(${accentRGB},${0.4 * (1 - k) * w})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6 + k * 34, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      });
    };

    const loop = (time: number) => {
      const m = camera?.current.zoom ?? 0;
      const stop = camera?.current.stop ?? 0;
      // Under reduced motion nothing animates on its own, so only redraw
      // when the scroll (or a resize) actually changed something.
      if (!reduceMotion || dirty || m !== lastZoom || stop !== lastStop) {
        draw(time, m, stop);
        lastZoom = m;
        lastStop = stop;
        dirty = false;
      }
      rafId = requestAnimationFrame(loop);
    };

    // Laid out synchronously before the first frame: ResizeObserver's
    // initial callback lands only after that frame's rAF callbacks, and
    // draw() needs the hub positions (the camera reads the stop hubs).
    layout();
    const resizeObserver = new ResizeObserver(layout);
    resizeObserver.observe(parent);
    rafId = requestAnimationFrame(loop);

    // Fade in once the first frame exists instead of popping in.
    const fadeInId = requestAnimationFrame(() => {
      canvas.style.opacity = "1";
    });

    return () => {
      cancelAnimationFrame(fadeInId);
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [isDark, camera, stops, emphasis]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 size-full opacity-0 transition-opacity duration-1000",
        // Fades toward the edges so the map melts into the page rather
        // than ending in a hard rectangle.
        "[mask-image:radial-gradient(ellipse_75%_70%_at_50%_50%,black_45%,transparent)]",
        // Phones rest the focus hub high (see draw), so the clear area is
        // taller and sits higher to keep it fully visible.
        "max-md:[mask-image:radial-gradient(ellipse_100%_80%_at_50%_45%,black_55%,transparent)]",
        className,
      )}
    />
  );
}
