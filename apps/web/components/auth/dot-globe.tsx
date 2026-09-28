"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import {
  WORLD_GRID_LAT_TOP,
  WORLD_GRID_STEP,
  WORLD_ROWS,
} from "@/lib/world-dots";
import { cn } from "@/lib/utils";

// The side of the Earth the globe faces: the Americas, tilted slightly so
// the northern hemisphere reads first, with Europe and West Africa just
// coming round the limb.
const CENTER_LAT = 14;
const CENTER_LON = -58;

// Cities the routes run between, as [lat, lon].
const HUBS = {
  sf: [37.8, -122.4],
  mexico: [19.4, -99.1],
  ny: [40.7, -74],
  bogota: [4.7, -74.1],
  saoPaulo: [-23.5, -46.6],
  buenosAires: [-34.6, -58.4],
  london: [51.5, -0.1],
  lagos: [6.5, 3.4],
} as const satisfies Record<string, readonly [number, number]>;

type Hub = keyof typeof HUBS;

const LINKS: [Hub, Hub][] = [
  ["sf", "ny"],
  ["sf", "mexico"],
  ["mexico", "bogota"],
  ["ny", "london"],
  ["ny", "saoPaulo"],
  ["bogota", "saoPaulo"],
  ["saoPaulo", "buenosAires"],
  ["saoPaulo", "lagos"],
  ["london", "lagos"],
];

// Same pulse feel as the landing page map: deterministic, staggered
// per-route timing, an eased head and a fading tail.
const TIMINGS = LINKS.map((_, i) => ({
  travel: 2.4 + ((i * 7) % 5) * 0.35,
  gap: 1 + ((i * 11) % 7) * 0.4,
  offset: (i * 1.37) % 6,
}));
const TAIL = 0.3;
const SAMPLES = 64;
const DEG = Math.PI / 180;

type Vec = [number, number, number];

const toVec = (lat: number, lon: number): Vec => [
  Math.cos(lat * DEG) * Math.cos(lon * DEG),
  Math.cos(lat * DEG) * Math.sin(lon * DEG),
  Math.sin(lat * DEG),
];

// Static dotted globe for the login/signup pages: the landing page's land
// mask projected orthographically onto a sphere that never rotates, with
// routes arcing above the surface between cities and pulses travelling
// along them, the same motion language as the landing map. Dots dim and
// shrink toward the limb, which is what gives the flat canvas its
// roundness. The globe, dots and faint routes are drawn once per
// resize/theme change; each frame only adds the pulses. Reduced motion
// gets a single still frame.
export function DotGlobe({ className }: { className?: string }) {
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

    const dotRGB = isDark ? "255,255,255" : "15,15,17";
    // emerald-400 / emerald-500, the app's accent.
    const accentRGB = isDark ? "52,211,153" : "16,185,129";

    const base = document.createElement("canvas");
    const baseCtx = base.getContext("2d");
    if (!baseCtx) return;

    // Camera basis: rotate the world so the centre point faces the viewer.
    const sinLat = Math.sin(CENTER_LAT * DEG);
    const cosLat = Math.cos(CENTER_LAT * DEG);
    const sinLon = Math.sin(CENTER_LON * DEG);
    const cosLon = Math.cos(CENTER_LON * DEG);
    // Unit-sphere point -> screen-space unit coords (y down) plus depth
    // toward the viewer (> 0 is the visible hemisphere).
    const view = ([x, y, z]: Vec) => {
      const x1 = x * cosLon + y * sinLon;
      const y1 = -x * sinLon + y * cosLon;
      return {
        x: y1,
        y: -(z * cosLat - x1 * sinLat),
        depth: x1 * cosLat + z * sinLat,
      };
    };

    const land: { x: number; y: number; depth: number }[] = [];
    WORLD_ROWS.forEach((line, row) => {
      const lat = WORLD_GRID_LAT_TOP - (row + 0.5) * WORLD_GRID_STEP;
      for (let col = 0; col < line.length; col++) {
        if (line[col] !== "#") continue;
        const p = view(toVec(lat, -180 + (col + 0.5) * WORLD_GRID_STEP));
        if (p.depth > 0) land.push(p);
      }
    });

    const hubs = Object.fromEntries(
      Object.entries(HUBS).map(([name, [lat, lon]]) => [
        name,
        view(toVec(lat, lon)),
      ]),
    ) as Record<Hub, ReturnType<typeof view>>;

    // Each route: points along the great circle between its two cities
    // (slerp), lifted off the surface in proportion to its length so long
    // hops arc higher. A point counts as hidden when it's behind the
    // sphere's disc.
    const routes = LINKS.map(([from, to]) => {
      const a = toVec(HUBS[from][0], HUBS[from][1]);
      const b = toVec(HUBS[to][0], HUBS[to][1]);
      const omega = Math.acos(
        Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]),
      );
      const lift = 0.08 + omega * 0.18;
      return Array.from({ length: SAMPLES + 1 }, (_, s) => {
        const t = s / SAMPLES;
        const wa = Math.sin((1 - t) * omega) / Math.sin(omega);
        const wb = Math.sin(t * omega) / Math.sin(omega);
        const h = 1 + lift * Math.sin(Math.PI * t);
        const p = view([
          (wa * a[0] + wb * b[0]) * h,
          (wa * a[1] + wb * b[1]) * h,
          (wa * a[2] + wb * b[2]) * h,
        ]);
        const hidden = p.depth < 0 && Math.hypot(p.x, p.y) < 1;
        return { ...p, hidden };
      });
    });

    let width = 0;
    let height = 0;
    let cx = 0;
    let cy = 0;
    let radius = 0;
    let rafId = 0;

    const sx = (x: number) => cx + x * radius;
    const sy = (y: number) => cy + y * radius;
    const dotRadius = (depth: number) =>
      radius * 0.0085 * (0.45 + 0.55 * depth);

    const layout = () => {
      width = parent.clientWidth;
      height = parent.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      radius = Math.min(width, height) * 0.33;
      cx = width / 2;
      cy = height / 2;

      for (const c of [canvas, base]) {
        c.width = Math.round(width * dpr);
        c.height = Math.round(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      baseCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      baseCtx.clearRect(0, 0, width, height);

      // Barely-there shading and rim so the sphere holds its shape over
      // the ocean without becoming a solid disc.
      const body = baseCtx.createRadialGradient(
        cx - radius * 0.4,
        cy - radius * 0.45,
        0,
        cx,
        cy,
        radius,
      );
      body.addColorStop(0, `rgba(${dotRGB},${isDark ? 0.05 : 0.04})`);
      body.addColorStop(1, `rgba(${dotRGB},0)`);
      baseCtx.fillStyle = body;
      baseCtx.beginPath();
      baseCtx.arc(cx, cy, radius, 0, Math.PI * 2);
      baseCtx.fill();
      baseCtx.strokeStyle = `rgba(${dotRGB},${isDark ? 0.07 : 0.09})`;
      baseCtx.lineWidth = 1;
      baseCtx.stroke();

      // Land, bucketed by depth so each band is one path and one fill.
      const bands = 5;
      for (let b = 0; b < bands; b++) {
        baseCtx.fillStyle = `rgba(${dotRGB},${(isDark ? 0.07 : 0.09) + (b / (bands - 1)) * (isDark ? 0.2 : 0.24)})`;
        baseCtx.beginPath();
        for (const d of land) {
          if (Math.min(Math.floor(d.depth * bands), bands - 1) !== b) continue;
          const r = dotRadius(d.depth);
          baseCtx.moveTo(sx(d.x) + r, sy(d.y));
          baseCtx.arc(sx(d.x), sy(d.y), r, 0, Math.PI * 2);
        }
        baseCtx.fill();
      }

      // Faint permanent routes.
      baseCtx.strokeStyle = `rgba(${accentRGB},${isDark ? 0.14 : 0.18})`;
      baseCtx.lineWidth = 1;
      for (const route of routes) {
        baseCtx.beginPath();
        let drawing = false;
        for (const p of route) {
          if (p.hidden) {
            drawing = false;
            continue;
          }
          if (drawing) baseCtx.lineTo(sx(p.x), sy(p.y));
          else baseCtx.moveTo(sx(p.x), sy(p.y));
          drawing = true;
        }
        baseCtx.stroke();
      }

      // Hubs.
      for (const h of Object.values(hubs)) {
        if (h.depth <= 0) continue;
        baseCtx.fillStyle = `rgba(${accentRGB},${0.15 * h.depth})`;
        baseCtx.beginPath();
        baseCtx.arc(sx(h.x), sy(h.y), 4.5, 0, Math.PI * 2);
        baseCtx.fill();
        baseCtx.fillStyle = `rgba(${accentRGB},${0.4 + 0.5 * h.depth})`;
        baseCtx.beginPath();
        baseCtx.arc(sx(h.x), sy(h.y), 1.8, 0, Math.PI * 2);
        baseCtx.fill();
      }
    };

    const pointAt = (route: (typeof routes)[number], t: number) =>
      route[Math.round(Math.min(Math.max(t, 0), 1) * SAMPLES)];

    const draw = (time: number) => {
      const t = time / 1000;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(base, 0, 0, width, height);
      if (reduceMotion) return;

      ctx.lineCap = "round";
      routes.forEach((route, i) => {
        const { travel, gap, offset } = TIMINGS[i];
        const cycle = ((t + offset) % (travel + gap)) / travel;
        const head = cycle < 1 ? 0.5 - Math.cos(Math.PI * cycle) / 2 : 1;

        if (cycle < 1 + TAIL) {
          const start = Math.max(0, head - TAIL);
          const end = Math.min(head, 1);
          const fadeOut = cycle > 1 ? 1 - (cycle - 1) / TAIL : 1;
          const steps = 24;
          let prev = pointAt(route, start);
          for (let s = 1; s <= steps; s++) {
            const k = s / steps;
            const p = pointAt(route, start + (end - start) * k);
            if (!p.hidden && !prev.hidden) {
              ctx.strokeStyle = `rgba(${accentRGB},${0.75 * k * fadeOut})`;
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(sx(prev.x), sy(prev.y));
              ctx.lineTo(sx(p.x), sy(p.y));
              ctx.stroke();
            }
            prev = p;
          }
        }

        // Ripple at the destination as the pulse lands.
        const dest = route[SAMPLES];
        if (cycle >= 1 && cycle < 1.6 && !dest.hidden) {
          const k = (cycle - 1) / 0.6;
          ctx.strokeStyle = `rgba(${accentRGB},${0.45 * (1 - k)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(sx(dest.x), sy(dest.y), 2 + k * 12, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
    };

    const loop = (time: number) => {
      draw(time);
      rafId = requestAnimationFrame(loop);
    };

    layout();
    const resizeObserver = new ResizeObserver(() => {
      layout();
      if (reduceMotion) draw(0);
    });
    resizeObserver.observe(parent);
    if (reduceMotion) draw(0);
    else rafId = requestAnimationFrame(loop);

    const fadeInId = requestAnimationFrame(() => {
      canvas.style.opacity = "1";
    });

    return () => {
      cancelAnimationFrame(fadeInId);
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 size-full opacity-0 transition-opacity duration-1000",
        className,
      )}
    />
  );
}
