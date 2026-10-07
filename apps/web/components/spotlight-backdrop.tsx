"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTheme } from "next-themes";
import { addBulgedGrid } from "@/lib/grid-bulge";
import { cn } from "@/lib/utils";

type Variant = "auth" | "landing";

// How each kind of page dresses the shared backdrop. Class strings are
// spelled out in full because Tailwind only generates classes it can see.
const VARIANTS: Record<
  Variant,
  {
    // Whether there's a grid at all — landing is a flat, solid surface now
    // (matching the dashboard's own content panel), so this is the only
    // field that variant actually reads; everything else below it is
    // dead weight for that variant and stays unread.
    hasGrid: boolean;
    gridAlpha: number;
    gridMask: string;
    // Whether the grid reacts to the cursor at all (a dome that rises under
    // it, a brighter "torch" circle that reveals the grid, a trailing glow).
    // When false the grid is just a static, flat backdrop.
    interactive: boolean;
    // Only read when interactive is true.
    lightAlpha: number;
    bulge: number;
    // A light- and dark-mode radial gradient pair — CSS handles this one
    // (unlike the canvas-drawn grid, which needs the resolved theme in JS).
    glow: string;
  }
> = {
  // Login/signup: the grid is barely there (and fades out down the page) so
  // the card stays the focus; the cursor light is what brings it to life.
  // The grid stays flat (bulge 0) — only the torch reveal and glow follow
  // the cursor, no dome swelling under it.
  auth: {
    hasGrid: true,
    gridAlpha: 0.05,
    gridMask:
      "[mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]",
    interactive: true,
    lightAlpha: 0.45,
    bulge: 0,
    glow: "bg-[radial-gradient(circle,rgba(0,0,0,0.06),transparent_70%)] dark:bg-[radial-gradient(circle,rgba(255,255,255,0.10),transparent_70%)]",
  },
  // Landing: a flat, solid surface — same idea as the dashboard's own
  // content panel — so the hero copy is the only thing to look at.
  landing: {
    hasGrid: false,
    gridAlpha: 0,
    gridMask: "",
    interactive: false,
    lightAlpha: 0,
    bulge: 0,
    glow: "",
  },
};

// Full-page shell shared by the landing page and the auth pages: a backdrop
// grid, with the page's own content (navbar, cards, hero, ...) rendered on
// top. On variants marked `interactive` the grid also swells into a dome
// under the cursor and lights up around it. Follows the real site theme
// (next-themes, via the class on <html>) rather than forcing dark, so the
// canvas-drawn grid's stroke color is resolved here in JS and repainted
// whenever the theme changes — CSS `dark:` can't reach inside a canvas
// draw call the way it can a background-image. Pulled out so no page has
// to re-implement the same background logic. The caller sets the height
// (e.g. "h-dvh" or "min-h-dvh") via className.
export function SpotlightBackdrop({
  children,
  className,
  variant,
}: {
  children: ReactNode;
  className?: string;
  variant: Variant;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [isSpotlightActive, setIsSpotlightActive] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const lightRef = useRef<HTMLCanvasElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);

  const { hasGrid, gridAlpha, gridMask, interactive, lightAlpha, bulge, glow } =
    VARIANTS[variant];
  // Dark-mode lines are light-on-dark (white); light-mode lines are the
  // reverse (a soft near-black, matching the app-shell's own zinc-900
  // borders rather than pure black).
  const strokeRGB = isDark ? "241,240,238" : "13,13,13";

  // Static grid for non-interactive variants: drawn once (and on resize,
  // or a theme change), with no cursor tracking at all. No-ops for
  // interactive variants, which draw the same base canvas themselves
  // (bent together with the light canvas) in the effect below — and for
  // variants with no grid at all, which don't even render the canvas this
  // would draw into.
  useEffect(() => {
    if (interactive || !hasGrid) return;
    const root = rootRef.current;
    const baseCanvas = baseRef.current;
    const baseCtx = baseCanvas?.getContext("2d");
    if (!root || !baseCanvas || !baseCtx) return;

    let width = 0;
    let height = 0;

    const paint = () => {
      const grid = new Path2D();
      addBulgedGrid(grid, width, height, 0, 0, 0);
      baseCtx.clearRect(0, 0, width, height);
      baseCtx.strokeStyle = `rgba(${strokeRGB},${gridAlpha})`;
      baseCtx.lineWidth = 1;
      baseCtx.stroke(grid);
    };

    // Drawn at device resolution (capped at 2x) so the 1px lines stay crisp;
    // resizing a canvas resets its transform and clears it.
    const resize = () => {
      width = root.clientWidth;
      height = root.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      baseCanvas.width = Math.round(width * dpr);
      baseCanvas.height = Math.round(height * dpr);
      baseCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint();
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);

    // The grid only exists once this effect has run, so fade it in rather
    // than have it pop in after the page has already painted.
    const fadeInId = requestAnimationFrame(() => {
      baseCanvas.style.opacity = "1";
    });

    return () => {
      cancelAnimationFrame(fadeInId);
      resizeObserver.disconnect();
    };
  }, [interactive, hasGrid, gridAlpha, strokeRGB]);

  // Cursor effects (dome + torch reveal + trailing glow) for variants that
  // opt in. Everything here is imperative (canvas draws, CSS variables,
  // transforms) so a mouse move never triggers a React re-render. The only
  // state is whether the pointer is inside, which just toggles opacity
  // classes.
  useEffect(() => {
    if (!interactive) return;
    const root = rootRef.current;
    const baseCanvas = baseRef.current;
    const lightCanvas = lightRef.current;
    const flow = flowRef.current;
    const baseCtx = baseCanvas?.getContext("2d");
    const lightCtx = lightCanvas?.getContext("2d");
    if (!root || !baseCanvas || !lightCanvas || !flow || !baseCtx || !lightCtx) {
      return;
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let width = 0;
    let height = 0;
    let rafId = 0;
    let inside = false;
    // Cursor motion is eased (lerped) toward the pointer every frame instead
    // of snapping straight to it, so things have weight and trail smoothly
    // rather than jumping 1:1 with the mouse. The dome eases more slowly than
    // the light, which is what makes it feel like it flows after the cursor.
    const pointer = { x: 0, y: 0 };
    const light = { x: 0, y: 0 };
    const dome = { x: 0, y: 0 };
    // 0 = flat grid, 1 = full dome; eased so the dome rises and settles.
    let strength = 0;

    const paint = () => {
      const grid = new Path2D();
      addBulgedGrid(grid, width, height, dome.x, dome.y, strength, bulge);
      // Same geometry on both layers: the faint base grid (masked by CSS) and
      // the brighter one revealed only around the cursor (masked to a circle
      // that follows --x/--y). They have to bend together or lines would
      // double up where the two overlap.
      for (const [ctx, alpha] of [
        [baseCtx, gridAlpha],
        [lightCtx, lightAlpha],
      ] as const) {
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = `rgba(${strokeRGB},${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke(grid);
      }
    };

    // --x/--y are set directly on the DOM node rather than through React's
    // style prop so a re-render can't clobber the live cursor position.
    const applyLight = () => {
      lightCanvas.style.setProperty("--x", `${light.x}px`);
      lightCanvas.style.setProperty("--y", `${light.y}px`);
      // calc(...% ) centers the blob on the point since percentages in
      // translate resolve against the element's own size.
      flow.style.transform = `translate3d(calc(${light.x}px - 50%), calc(${light.y}px - 50%), 0)`;
    };

    const step = () => {
      rafId = 0;
      const targetStrength = inside ? 1 : 0;

      light.x += (pointer.x - light.x) * 0.14;
      light.y += (pointer.y - light.y) * 0.14;
      dome.x += (pointer.x - dome.x) * 0.08;
      dome.y += (pointer.y - dome.y) * 0.08;
      strength += (targetStrength - strength) * 0.08;

      const settled =
        Math.abs(pointer.x - light.x) < 0.4 &&
        Math.abs(pointer.y - light.y) < 0.4 &&
        Math.abs(pointer.x - dome.x) < 0.4 &&
        Math.abs(pointer.y - dome.y) < 0.4 &&
        Math.abs(targetStrength - strength) < 0.003;
      if (settled) {
        Object.assign(light, pointer);
        Object.assign(dome, pointer);
        strength = targetStrength;
      }

      applyLight();
      paint();
      // Stops the loop once everything has caught up, so an idle page
      // isn't redrawing a canvas 60 times a second.
      if (!settled) rafId = requestAnimationFrame(step);
    };

    const startLoop = () => {
      if (!rafId) rafId = requestAnimationFrame(step);
    };

    // Driven from the move handler (not just pointerenter) so the fade-in
    // can't be skipped if enter/leave boundary events don't fire cleanly.
    const handlePointerMove = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;

      if (!inside) {
        inside = true;
        setIsSpotlightActive(true);
        // Coming back after the dome has all but gone: start it under the
        // cursor instead of sweeping in from wherever it last was.
        if (strength < 0.05) {
          Object.assign(light, pointer);
          Object.assign(dome, pointer);
        }
      }

      if (reduceMotion) {
        Object.assign(light, pointer);
        Object.assign(dome, pointer);
        strength = 1;
        applyLight();
        paint();
        return;
      }
      startLoop();
    };

    const handlePointerLeave = () => {
      if (!inside) return;
      inside = false;
      setIsSpotlightActive(false);

      if (reduceMotion) {
        strength = 0;
        paint();
        return;
      }
      startLoop();
    };

    // Canvases are drawn at device resolution (capped at 2x) so the 1px
    // lines stay crisp; resizing a canvas resets its transform and clears it.
    const resize = () => {
      width = root.clientWidth;
      height = root.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (const [canvas, ctx] of [
        [baseCanvas, baseCtx],
        [lightCanvas, lightCtx],
      ] as const) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      paint();
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);
    root.addEventListener("pointermove", handlePointerMove);
    root.addEventListener("pointerleave", handlePointerLeave);

    // The grid only exists once this effect has run, so fade it in rather
    // than have it pop in after the page has already painted.
    const fadeInId = requestAnimationFrame(() => {
      baseCanvas.style.opacity = "1";
    });

    return () => {
      cancelAnimationFrame(fadeInId);
      if (rafId) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      root.removeEventListener("pointermove", handlePointerMove);
      root.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [interactive, gridAlpha, lightAlpha, bulge, strokeRGB]);

  return (
    // "text-foreground" is explicit (not just inherited from <body>) so it
    // stays correct regardless of where in the tree this backdrop sits.
    <div
      ref={rootRef}
      className={cn(
        "relative flex flex-col overflow-hidden bg-white text-foreground transition-colors duration-300 dark:bg-zinc-950",
        className,
      )}
    >
      {/* Ambient grid: faint, fading out toward the edges, no imagery.
          Not rendered at all for a flat, solid variant (landing). */}
      {hasGrid && (
        <canvas
          ref={baseRef}
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 size-full opacity-0 transition-opacity duration-700",
            gridMask,
          )}
        />
      )}
      {interactive && (
        <>
          {/* Same grid, brighter, revealed only in a circle that eases
              toward the cursor (see applyLight). */}
          <canvas
            ref={lightRef}
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 size-full opacity-0 transition-opacity duration-300 [mask-image:radial-gradient(circle_240px_at_var(--x,50%)_var(--y,0px),black,transparent_70%)]",
              isSpotlightActive && "opacity-100",
            )}
          />
          {/* Soft glow that trails the same eased cursor position — the
              "flow" layer that gives the backdrop a sense of fluid motion
              beyond the grid reveal. Positioned via transform (GPU-friendly)
              so it never triggers layout, only composited movement. */}
          <div
            ref={flowRef}
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-0 left-0 h-[380px] w-[380px] rounded-full opacity-0 blur-2xl transition-opacity duration-500 will-change-transform",
              glow,
              isSpotlightActive && "opacity-100",
            )}
          />
        </>
      )}
      {/* Reuses hasGrid: for the two variants that exist today, "no grid"
          and "no ambient glow" are the same call — a fully flat surface,
          not just a flat one with a soft blob left over. */}
      {hasGrid && (
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 left-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/10 blur-[120px]"
        />
      )}

      {children}
    </div>
  );
}
