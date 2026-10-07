"use client";

import { CheckIcon } from "lucide-react";
import {
  SettingsPageTitle,
  SettingsSection,
} from "@/components/settings/settings-section";
import { COLOR_THEMES, useColorTheme } from "@/lib/hooks/use-color-theme";
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
  const { theme: colorTheme, setTheme: setColorTheme } = useColorTheme();

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

        <SettingsSection
          title="Colour"
          description="Each colour has its own light and dark version, so it works with either theme above."
        >
          <div role="radiogroup" aria-label="Colour" className="grid grid-cols-2 gap-4">
            {COLOR_THEMES.map((option) => {
              const selected = mounted && colorTheme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setColorTheme(option.value)}
                  className={cn(
                    "cursor-pointer rounded-lg border p-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60",
                    selected
                      ? "border-emerald-500"
                      : "border-black/10 hover:border-black/25 dark:border-white/10 dark:hover:border-white/25",
                  )}
                >
                  {/* A tiny mock of the app in that colour. Setting the
                      theme on this box makes everything inside it use that
                      theme's colours, whatever the page itself is using. */}
                  <div
                    aria-hidden
                    data-theme={option.value}
                    className={cn(
                      "flex h-24 gap-1.5 rounded-md bg-(--paper-2) p-1.5",
                      isDark && "dark bg-(--ink-0)",
                    )}
                  >
                    <div className="flex w-1/4 flex-col gap-1 pt-1">
                      <span className="h-1 w-4/5 rounded-full bg-emerald-500" />
                      <span className="h-1 w-3/5 rounded-full bg-black/15 dark:bg-white/15" />
                      <span className="h-1 w-4/5 rounded-full bg-black/15 dark:bg-white/15" />
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5 rounded border border-black/10 bg-(--paper) p-2 dark:border-white/10 dark:bg-(--ink-1)">
                      <span className="h-1.5 w-1/3 rounded-full bg-black/20 dark:bg-white/25" />
                      <span className="h-1 w-2/3 rounded-full bg-black/10 dark:bg-white/15" />
                      <span className="mt-auto h-3 w-2/5 rounded-full bg-emerald-500" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-1 pt-2.5 pb-0.5">
                    <span>
                      <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {option.label}
                      </span>
                      <span className="block text-xs text-zinc-500">
                        {option.description}
                      </span>
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
