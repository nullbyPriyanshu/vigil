"use client";

import { useCallback, useSyncExternalStore } from "react";

// Per-key set of same-tab subscribers. The browser's native "storage" event
// only fires in *other* tabs, never the one that made the change — and
// dispatching a synthetic one to fill that gap turns out to be dangerous:
// `new StorageEvent("storage", { key })` with no `newValue`/`storageArea`
// gets treated by Chromium as "this key was deleted" and actually removes
// it from real storage (confirmed with a bare, React-free repro). A plain
// in-memory Set sidesteps that footgun entirely for the same-tab case; the
// real native event (safe, browser-generated) still covers other tabs.
const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

function subscribe(key: string, onStoreChange: () => void) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(onStoreChange);

  const onStorage = (e: StorageEvent) => {
    if (e.key === key) onStoreChange();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.get(key)?.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

// A boolean piece of state backed by localStorage under `key`. Built on
// useSyncExternalStore rather than useState+useEffect specifically because
// this is external, already-synchronized state (the browser's storage),
// which is exactly what that hook is for — and it has a real SSR story
// built in: `getServerSnapshot` always returns `initialValue`, so the
// server (and the client's first render, to match it and avoid a hydration
// mismatch) never reaches into `window`. The real stored value only takes
// effect once the browser re-subscribes after mount.
export function useLocalStorageState(key: string, initialValue: boolean) {
  const getSnapshot = useCallback(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? initialValue : stored === "true";
    } catch {
      return initialValue;
    }
  }, [key, initialValue]);

  const getServerSnapshot = useCallback(() => initialValue, [initialValue]);

  const value = useSyncExternalStore(
    (onStoreChange) => subscribe(key, onStoreChange),
    getSnapshot,
    getServerSnapshot,
  );

  const setValue = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const resolved = typeof next === "function" ? next(getSnapshot()) : next;
      try {
        window.localStorage.setItem(key, String(resolved));
      } catch {
        // Storage blocked — nothing meaningful to do about it here.
      }
      notify(key);
    },
    [key, getSnapshot],
  );

  return [value, setValue] as const;
}
