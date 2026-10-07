"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isTyping } from "@/lib/use-shortcut";

// Press G, then one of these letters, to jump to a page.
const GO_TO = [
  { key: "d", label: "Dashboard", href: "/dashboard" },
  { key: "i", label: "Incidents", href: "/incidents" },
  { key: "s", label: "Services", href: "/services" },
  { key: "p", label: "Policies", href: "/policies" },
  { key: "c", label: "Schedules", href: "/schedules" },
  { key: "m", label: "Members", href: "/members" },
  { key: "t", label: "Teams", href: "/teams" },
  { key: "a", label: "Analytics", href: "/analytics" },
];

const OTHER = [
  { keys: ["Ctrl", "K"], label: "Search" },
  { keys: ["A"], label: "Acknowledge the open incident" },
  { keys: ["R"], label: "Resolve the open incident" },
  { keys: ["?"], label: "Show this list" },
];

// How long after G the second key still counts.
const WAIT_MS = 1200;

function Key({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-black/[0.12] px-1.5 font-mono text-[11px] text-zinc-700 dark:border-white/[0.14] dark:text-zinc-300">
      {children}
    </kbd>
  );
}

// "G then D" style navigation for the whole app, and the list of every
// shortcut, which opens with the ? key.
export function KeyboardShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    let waitingSince = 0;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event) || event.repeat) return;
      const key = event.key.toLowerCase();

      if (key === "?") {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }

      const target = GO_TO.find((item) => item.key === key);
      if (waitingSince && Date.now() - waitingSince < WAIT_MS && target) {
        event.preventDefault();
        // The second letter belongs to "go to" only. Without this, G then A
        // would also run a page's own A shortcut (acknowledge).
        event.stopImmediatePropagation();
        waitingSince = 0;
        router.push(target.href);
        return;
      }
      waitingSince = key === "g" ? Date.now() : 0;
    };

    // Capture phase, so this sees the key before any page shortcut does.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [router]);

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          <ul className="space-y-2">
            {OTHER.map((item) => (
              <li key={item.label} className="flex items-center justify-between gap-4">
                <span className="text-zinc-700 dark:text-zinc-300">{item.label}</span>
                <span className="flex gap-1">
                  {item.keys.map((k) => (
                    <Key key={k}>{k}</Key>
                  ))}
                </span>
              </li>
            ))}
          </ul>

          <div>
            <p className="mb-2 text-xs text-zinc-500">
              Go to a page: press G, then the letter
            </p>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2">
              {GO_TO.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-4">
                  <span className="text-zinc-700 dark:text-zinc-300">{item.label}</span>
                  <span className="flex gap-1">
                    <Key>G</Key>
                    <Key>{item.key.toUpperCase()}</Key>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
