import { useEffect, useRef } from "react";

// True while the person is typing somewhere, or a dialog is open: single
// letter shortcuts must not fire then.
export function isTyping(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  if (event.metaKey || event.ctrlKey || event.altKey) return true;
  if (!target) return false;
  if (target.isContentEditable) return true;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return true;
  return document.querySelector("[role=dialog]") !== null;
}

// Runs `action` when a single key is pressed, e.g. useShortcut("a", ...).
export function useShortcut(key: string, action: () => void, enabled = true) {
  // Always call the newest version of the action without re-binding.
  const latest = useRef(action);
  useEffect(() => {
    latest.current = action;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event) || event.repeat) return;
      if (event.key.toLowerCase() !== key) return;
      event.preventDefault();
      latest.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key, enabled]);
}
