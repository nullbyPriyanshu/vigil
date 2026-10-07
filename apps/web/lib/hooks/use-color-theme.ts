"use client";

import { useSyncExternalStore } from "react";

// The colour themes. "mono" is the default black and white one. The colours
// themselves are in globals.css, under "Colour themes".
export const COLOR_THEMES = [
  { value: "mono", label: "Mono", description: "Black and white" },
  { value: "indigo", label: "Indigo", description: "Deep blue-violet" },
  { value: "forest", label: "Forest", description: "Fresh green" },
  { value: "ember", label: "Ember", description: "Warm orange" },
] as const;

export type ColorTheme = (typeof COLOR_THEMES)[number]["value"];

export const COLOR_THEME_KEY = "vigil:color-theme";
const CHANGED = "vigil:color-theme-changed";

// Runs in the page's <head> before anything is drawn, so a saved theme is
// there from the first paint instead of flashing in afterwards.
export const COLOR_THEME_SCRIPT = `try{var t=localStorage.getItem("${COLOR_THEME_KEY}");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  return () => window.removeEventListener(CHANGED, onChange);
}

function read() {
  return (document.documentElement.dataset.theme as ColorTheme) || "mono";
}

// The colour theme in use, and a function to change it. The choice is
// saved in this browser (like light/dark), not on the account.
export function useColorTheme() {
  const theme = useSyncExternalStore(subscribe, read, () => "mono" as ColorTheme);

  const setTheme = (next: ColorTheme) => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(COLOR_THEME_KEY, next);
    } catch {}
    window.dispatchEvent(new Event(CHANGED));
  };

  return { theme, setTheme };
}
