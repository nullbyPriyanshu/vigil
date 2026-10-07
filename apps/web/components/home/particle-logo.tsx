"use client";

import { useEffect, useRef } from "react";

import { LOGO_POLYGONS, LOGO_SIZE } from "@/lib/logo-shape";
import { cn } from "@/lib/utils";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  homeX: number;
  homeY: number;
  // When this dot starts flying in, in ms after the page loads.
  delay: number;
  // A fixed random 0..1, so dots differ a little in size and brightness.
  seed: number;
};

// Standard ray-casting test: is the point inside the polygon?
function isInside(x: number, y: number, polygon: [number, number][]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// The logo drawn out of dots. The dots drift in when the page loads, a slow
// band of light keeps passing over them, they part around the pointer and
// settle back when it leaves. Clicking sends them all flying once.
export function ParticleLogo({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let particles: Particle[] = [];
    let size = 0;
    let color = "";
    let frame = 0;
    let visible = true;
    let startedAt = 0;
    let lastTime = 0;

    // The pointer the dots react to trails the real one a little, and its
    // strength fades in and out, so nothing ever jumps.
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, strength: 0, inside: false };

    // Lay a fine grid of dots over the canvas and keep the ones inside the
    // logo.
    function build() {
      size = canvas!.clientWidth;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(size * ratio);
      canvas!.height = Math.round(size * ratio);
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);
      color = getComputedStyle(canvas!).color;

      const padding = size * 0.04;
      const scale = (size - padding * 2) / LOGO_SIZE;
      const gap = Math.max(3.2, size / 84);

      particles = [];
      let row = 0;
      for (let y = padding; y < size - padding; y += gap * 0.9, row++) {
        // Every other row is shifted half a step, which reads as texture
        // instead of a rigid grid.
        const shift = row % 2 === 0 ? 0 : gap / 2;
        for (let x = padding + shift; x < size - padding; x += gap) {
          const logoX = (x - padding) / scale;
          const logoY = (y - padding) / scale;
          if (!LOGO_POLYGONS.some((polygon) => isInside(logoX, logoY, polygon))) {
            continue;
          }
          // Each dot starts a little way out from its place, on a ring
          // around the logo, and the ones near the top arrive first.
          const angle = Math.random() * Math.PI * 2;
          const distance = size * (0.25 + Math.random() * 0.45);
          particles.push({
            x: reduceMotion ? x : x + Math.cos(angle) * distance,
            y: reduceMotion ? y : y + Math.sin(angle) * distance,
            vx: 0,
            vy: 0,
            homeX: x,
            homeY: y,
            delay: (y / size) * 500 + Math.random() * 450,
            seed: Math.random(),
          });
        }
      }
    }

    function draw(elapsed: number) {
      context!.clearRect(0, 0, size, size);
      context!.fillStyle = color;
      const baseRadius = Math.max(0.75, size / 440);

      for (const particle of particles) {
        // Dots fade in as they start moving.
        const appear = reduceMotion
          ? 1
          : Math.min(1, Math.max(0, (elapsed - particle.delay) / 500));
        if (appear === 0) continue;

        // A soft band of light that travels diagonally across the logo.
        const wave = reduceMotion
          ? 0.5
          : 0.5 +
            0.5 *
              Math.sin(
                elapsed * 0.0011 -
                  (particle.homeX + particle.homeY) * (5.5 / size),
              );

        // Dots that have been pushed out of place dim and shrink a bit.
        const offset = Math.hypot(
          particle.x - particle.homeX,
          particle.y - particle.homeY,
        );
        const away = Math.min(1, offset / (size * 0.18));

        context!.globalAlpha =
          appear * (0.42 + 0.4 * wave + 0.18 * particle.seed) * (1 - away * 0.45);
        context!.beginPath();
        context!.arc(
          particle.x,
          particle.y,
          baseRadius * (0.8 + 0.3 * particle.seed + 0.25 * wave),
          0,
          Math.PI * 2,
        );
        context!.fill();
      }
      context!.globalAlpha = 1;
    }

    function step(now: number) {
      if (!startedAt) {
        startedAt = now;
        lastTime = now;
      }
      const elapsed = now - startedAt;
      // Movement is scaled by real time, so it looks the same on a 60 Hz
      // and a 120 Hz screen.
      const k = Math.min(2.5, (now - lastTime) / 16.67);
      lastTime = now;

      pointer.x += (pointer.targetX - pointer.x) * Math.min(1, 0.16 * k);
      pointer.y += (pointer.targetY - pointer.y) * Math.min(1, 0.16 * k);
      pointer.strength +=
        ((pointer.inside ? 1 : 0) - pointer.strength) * Math.min(1, 0.07 * k);

      const radius = size * 0.24;
      const friction = Math.pow(0.86, k);

      for (const particle of particles) {
        if (elapsed < particle.delay) continue;

        // A soft spring pulls each dot back to its place in the logo. It
        // starts weak and firms up, which gives the slow, easy arrival.
        const settle = Math.min(1, (elapsed - particle.delay) / 900);
        const pull = 0.004 + 0.012 * settle;
        particle.vx += (particle.homeX - particle.x) * pull * k;
        particle.vy += (particle.homeY - particle.y) * pull * k;

        if (pointer.strength > 0.01) {
          const dx = particle.x - pointer.x;
          const dy = particle.y - pointer.y;
          const distance = Math.hypot(dx, dy);
          if (distance < radius && distance > 0.01) {
            // Strongest at the pointer, easing to nothing at the edge.
            const falloff = (1 - distance / radius) ** 2;
            const push = falloff * 1.9 * pointer.strength * k;
            particle.vx += (dx / distance) * push;
            particle.vy += (dy / distance) * push;
          }
        }

        particle.vx *= friction;
        particle.vy *= friction;
        particle.x += particle.vx * k;
        particle.y += particle.vy * k;
      }

      draw(elapsed);
      if (visible) frame = requestAnimationFrame(step);
    }

    function start() {
      cancelAnimationFrame(frame);
      if (reduceMotion) {
        draw(0);
        return;
      }
      // Don't count the time spent off screen as one giant step.
      lastTime = performance.now();
      frame = requestAnimationFrame(step);
    }

    function onPointerMove(event: PointerEvent) {
      const box = canvas!.getBoundingClientRect();
      pointer.targetX = event.clientX - box.left;
      pointer.targetY = event.clientY - box.top;
      const margin = size * 0.24;
      const inside =
        pointer.targetX > -margin &&
        pointer.targetY > -margin &&
        pointer.targetX < size + margin &&
        pointer.targetY < size + margin;
      // Coming in from outside: start at the real position instead of
      // sweeping across the logo from wherever the pointer last was.
      if (inside && !pointer.inside && pointer.strength < 0.05) {
        pointer.x = pointer.targetX;
        pointer.y = pointer.targetY;
      }
      pointer.inside = inside;
    }

    function onPointerLeave() {
      pointer.inside = false;
    }

    // A click pushes every dot outwards from where it was clicked.
    function onPointerDown(event: PointerEvent) {
      const box = canvas!.getBoundingClientRect();
      const clickX = event.clientX - box.left;
      const clickY = event.clientY - box.top;
      for (const particle of particles) {
        const dx = particle.x - clickX;
        const dy = particle.y - clickY;
        const distance = Math.hypot(dx, dy) || 1;
        const force = (5 + particle.seed * 9) * (1 - Math.min(0.7, distance / size));
        particle.vx += (dx / distance) * force;
        particle.vy += (dy / distance) * force;
      }
    }

    function onResize() {
      if (canvas!.clientWidth === size) return;
      build();
      // Already on screen, so skip the fly-in the second time.
      for (const particle of particles) {
        particle.x = particle.homeX;
        particle.y = particle.homeY;
        particle.delay = 0;
      }
      if (reduceMotion) draw(0);
    }

    build();
    start();

    // Stop drawing while the logo is scrolled out of view.
    const viewWatcher = new IntersectionObserver(([entry]) => {
      const nowVisible = entry.isIntersecting;
      if (nowVisible && !visible) {
        visible = true;
        start();
      }
      visible = nowVisible;
    });
    viewWatcher.observe(canvas);

    // Pick up the new text colour when the theme switches.
    const themeWatcher = new MutationObserver(() => {
      color = getComputedStyle(canvas!).color;
      if (reduceMotion) draw(0);
    });
    themeWatcher.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("resize", onResize);
    document.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("pointerdown", onPointerDown);

    return () => {
      cancelAnimationFrame(frame);
      viewWatcher.disconnect();
      themeWatcher.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("aspect-square cursor-pointer text-foreground", className)}
    />
  );
}
