"use client";

import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";

// The corner-wave toggle logic, shared by every place a theme switch is
// rendered (the switch-style ThemeToggle in menu rows, the circular
// ThemeToggleIcon in a bare navbar) so the animation only has to be gotten
// right once.
//
// `mounted` guards against a real hydration mismatch: next-themes only
// knows the real theme after reading localStorage on the client, so
// `resolvedTheme` is `undefined` on the server and briefly on the client's
// first render too — a component that renders differently based on it
// immediately (like ThemeToggleIcon, which is part of the page's initial
// output) would render one icon server-side and another once the client
// catches up, which React flags as a mismatch. `isDark` stays `false`
// until `mounted` flips true in an effect (client-only, post-hydration),
// so the first paint is identical on both sides; consumers that only ever
// render after some interaction (ThemeToggle, inside an already-closed
// menu) never hit this path in practice, since `mounted` is already true
// by the time they first render.
export function useThemeTransition() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // The standard next-themes "avoid a hydration mismatch" recipe: there's
  // no way to compute "has the client finished hydrating yet" during
  // render itself — an effect is the only place that's ever true, so this
  // one genuinely can't be rewritten to not call setState here.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  const toggle = useCallback(() => {
    const next = isDark ? "light" : "dark";

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // Unsupported browser, or motion turned off: just flip the theme.
    // Every themed surface's own transition-colors still gives a plain
    // smooth fade — this wave is a fancier treatment layered on top of
    // that, only where it's supported.
    if (!document.startViewTransition || reduceMotion) {
      setTheme(next);
      return;
    }

    // The circle is anchored at a fixed corner (top-right, in CSS), but its
    // radius has to fit *this* viewport — computed here as the exact
    // distance to the farthest corner (bottom-left) so the wave finishes
    // covering the whole screen exactly as the animation ends, on any
    // window size, rather than a guessed constant that over- or
    // undershoots.
    const radius = Math.hypot(window.innerWidth, window.innerHeight);
    document.documentElement.style.setProperty(
      "--theme-toggle-radius",
      `${radius}px`,
    );

    document.startViewTransition(() => {
      // next-themes applies the class to <html> inside a plain useEffect,
      // not a layout effect — flushSync forces React's own synchronous
      // work but *not* passive effects, so relying on it alone leaves the
      // transition capturing a stale "after" snapshot. Applying the class
      // here ourselves makes the DOM correct the instant this synchronous
      // callback returns, which is what the transition actually needs;
      // flushSync still keeps React's own state in sync for every other
      // useTheme() consumer.
      document.documentElement.classList.toggle("dark", next === "dark");
      flushSync(() => setTheme(next));
    });
  }, [isDark, setTheme]);

  return { isDark, mounted, toggle };
}
