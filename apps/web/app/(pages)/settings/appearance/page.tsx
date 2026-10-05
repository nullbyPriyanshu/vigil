"use client";

import { CheckIcon } from "lucide-react";
import {
  SettingsPageTitle,
  SettingsSection,
} from "@/components/settings/settings-section";
import { useThemeTransition } from "@/lib/hooks/use-theme-transition";
import { cn } from "@/lib/utils";

const THEMES = [
  {
    value: "light",
    label: "Light",
    page: "bg-zinc-100",
    panel: "bg-white border-zinc-200",
    line: "bg-zinc-300",
  },
  {
    value: "dark",
    label: "Dark",
    page: "bg-zinc-950",
    panel: "bg-zinc-900 border-zinc-800",
    line: "bg-zinc-700",
  },
] as const;

export default function AppearanceSettingsPage() {
  const { isDark, mounted, toggle } = useThemeTransition();
  const current = isDark ? "dark" : "light";

  return (
    <div>
      <SettingsPageTitle
        title="Appearance"
        description="Choose how Vigil looks on this device."
      />

      <div>
        <SettingsSection
          title="Theme"
          description="Saved in this browser, so each device can have its own."
        >
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-4">
            {THEMES.map((theme) => {
              const selected = mounted && current === theme.value;
              return (
                <button
                  key={theme.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    if (!selected) toggle();
                  }}
                  className={cn(
                    "cursor-pointer rounded-lg border p-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60",
                    selected
                      ? "border-emerald-500"
                      : "border-black/10 hover:border-black/25 dark:border-white/10 dark:hover:border-white/25",
                  )}
                >
                  {/* A tiny mock of the app in that theme. */}
                  <div
                    aria-hidden
                    className={cn("flex h-24 gap-1.5 rounded-md p-1.5", theme.page)}
                  >
                    <div className="flex w-1/4 flex-col gap-1 pt-1">
                      <span className={cn("h-1 w-4/5 rounded-full", theme.line)} />
                      <span className={cn("h-1 w-3/5 rounded-full", theme.line)} />
                      <span className={cn("h-1 w-4/5 rounded-full", theme.line)} />
                    </div>
                    <div
                      className={cn(
                        "flex flex-1 flex-col gap-1.5 rounded border p-2",
                        theme.panel,
                      )}
                    >
                      <span className={cn("h-1.5 w-1/3 rounded-full", theme.line)} />
                      <span className={cn("h-1 w-2/3 rounded-full", theme.line)} />
                      <span className="mt-auto h-2 w-1/4 rounded-full bg-emerald-500" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-1 pt-2.5 pb-0.5">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {theme.label}
                    </span>
                    {selected && (
                      <CheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}
