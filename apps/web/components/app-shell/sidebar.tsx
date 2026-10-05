"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftCloseIcon, PanelLeftOpenIcon, XIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocalStorageState } from "@/lib/hooks/use-local-storage-state";
import { dashboardStats } from "@/lib/mock/dashboard";
import {
  BACK_TO_APP_NAV_ITEM,
  NAV_GROUPS,
  SETTINGS_NAV_GROUPS,
  SETTINGS_NAV_ITEM,
  type NavItem,
} from "@/lib/nav";
import { cn } from "@/lib/utils";

// Primary nav, shared by every authenticated page via (pages)/layout.tsx.
// On large screens it's a static column next to the content, collapsible to
// an icon rail; below that it becomes an overlay drawer instead (always at
// full width there — collapsing only makes sense for a column that's
// permanently on screen). `open`/`onClose` are lifted into AppShell so the
// header's menu button and the drawer's own close controls can share one
// piece of state.
export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useLocalStorageState(
    "vigil:sidebar-collapsed",
    false,
  );

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  // Inside settings, this same sidebar shows the settings pages instead of
  // the main navigation, so there's only ever one menu on screen.
  const inSettings = isActive(SETTINGS_NAV_ITEM.href);
  const groups = inSettings ? SETTINGS_NAV_GROUPS : NAV_GROUPS;

  // A count badge only exists for Incidents today (it's the one number the
  // rest of the app already has on hand via the dashboard's mock stats).
  // Collapsed mode has no room for the badge itself, so its count folds
  // into the tooltip text instead.
  const badgeFor = (item: NavItem) =>
    item.href === "/incidents" ? dashboardStats.openIncidents : null;

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    const badge = badgeFor(item);

    const link = (
      <Link
        href={item.href}
        onClick={onClose}
        aria-label={collapsed ? item.label : undefined}
        className={cn(
          "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium tracking-tight transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:outline-none",
          collapsed && "justify-center px-0",
          active
            ? "bg-black/[0.06] text-zinc-900 dark:bg-white/[0.06] dark:text-white"
            : "text-zinc-500 hover:bg-black/[0.03] hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.03] dark:hover:text-zinc-200",
        )}
      >
        {/* The active indicator: a slim glowing bar, not a filled
            background — the tint above is what "selected" now means, this
            is just the accent that says which one. */}
        {active && (
          <span
            aria-hidden
            className="absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
          />
        )}
        <Icon
          className={cn("size-4 shrink-0", active && "text-emerald-400")}
        />
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            {badge !== null && (
              <span className="rounded-md bg-amber-500/15 px-1.5 text-xs font-medium text-amber-400">
                {badge}
              </span>
            )}
          </>
        )}
      </Link>
    );

    if (!collapsed) return link;

    return (
      <Tooltip key={item.href}>
        <TooltipTrigger render={link} delay={300} />
        <TooltipContent side="right">
          {item.label}
          {badge !== null ? ` (${badge})` : ""}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <>
      {/* Backdrop: click-outside-to-close, mobile only. The drawer itself
          is inert on large screens (translate-x-0, static), so this never
          renders there regardless of `open`. */}
      {open && (
        <div
          aria-hidden
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
        />
      )}
      <aside
        className={cn(
          // transition-all (not just -transform) so the bg/border dark:
          // swap fades in step with the rest of the shell instead of
          // snapping instantly while everything around it fades.
          "fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-black/[0.06] bg-white transition-all duration-300 ease-out dark:border-white/[0.06] dark:bg-[#09090b]",
          collapsed ? "lg:w-16" : "lg:w-60",
          "lg:static lg:z-0 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-black/[0.06] px-4 transition-colors duration-300 lg:hidden dark:border-white/[0.06]">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-200">
            Menu
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex size-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-black/[0.04] hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:outline-none dark:hover:bg-white/[0.04] dark:hover:text-zinc-200"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {inSettings && (
            <div className="mb-3 border-b border-black/[0.06] pb-3 dark:border-white/[0.06]">
              {renderItem(BACK_TO_APP_NAV_ITEM)}
            </div>
          )}
          {groups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="mt-4 mb-1 px-3 text-[11px] font-medium tracking-wider text-zinc-500 uppercase first:mt-0">
                  {group.label}
                </p>
              )}
              <div className={cn("space-y-1", collapsed && "mt-4 first:mt-0")}>
                {group.items.map((item) => (
                  <div key={item.href}>{renderItem(item)}</div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Pinned to the bottom: Settings, then the collapse toggle. */}
        <div className="space-y-1 border-t border-black/[0.06] p-3 transition-colors duration-300 dark:border-white/[0.06]">
          {!inSettings && renderItem(SETTINGS_NAV_ITEM)}

          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? "Expand sidebar" : undefined}
            className={cn(
              "hidden w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 transition-colors duration-200 hover:bg-black/[0.03] hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:outline-none lg:flex dark:hover:bg-white/[0.03] dark:hover:text-zinc-200",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? (
              <PanelLeftOpenIcon className="size-4 shrink-0" />
            ) : (
              <PanelLeftCloseIcon className="size-4 shrink-0" />
            )}
            {!collapsed && "Collapse"}
          </button>
        </div>
      </aside>
    </>
  );
}
