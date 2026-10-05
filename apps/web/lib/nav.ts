import {
  ArrowLeftIcon,
  BarChart3Icon,
  BoxesIcon,
  Building2Icon,
  CalendarClockIcon,
  LayoutDashboardIcon,
  PaletteIcon,
  SettingsIcon,
  SirenIcon,
  UserIcon,
  UsersIcon,
  WorkflowIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

// Grouped for the sidebar's section headings. Settings is deliberately not
// in here — it's pinned to the sidebar's own bottom instead (see
// SETTINGS_NAV_ITEM below), the way most SaaS dashboards keep it out of the
// main task groups.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operate",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
      { label: "Incidents", href: "/incidents", icon: SirenIcon },
    ],
  },
  {
    label: "Configure",
    items: [
      { label: "Services", href: "/services", icon: BoxesIcon },
      { label: "Policies", href: "/policies", icon: WorkflowIcon },
      { label: "Schedules", href: "/schedules", icon: CalendarClockIcon },
    ],
  },
  {
    label: "Organization",
    items: [
      { label: "Teams", href: "/teams", icon: UsersIcon },
      { label: "Analytics", href: "/analytics", icon: BarChart3Icon },
    ],
  },
];

export const SETTINGS_NAV_ITEM: NavItem = {
  label: "Settings",
  href: "/settings",
  icon: SettingsIcon,
};

// What the sidebar shows instead of NAV_GROUPS on any /settings/* page.
// Add a new settings page by adding one line here (and its page.tsx).
export const SETTINGS_NAV_GROUPS: NavGroup[] = [
  {
    label: "Settings",
    items: [
      { label: "Profile", href: "/settings/profile", icon: UserIcon },
      {
        label: "Your organization",
        href: "/settings/organization",
        icon: Building2Icon,
      },
      { label: "Appearance", href: "/settings/appearance", icon: PaletteIcon },
    ],
  },
];

export const BACK_TO_APP_NAV_ITEM: NavItem = {
  label: "Back to dashboard",
  href: "/dashboard",
  icon: ArrowLeftIcon,
};

// Flattened, including Settings — for anything that just needs to look up
// "what page is this route" (the header's breadcrumb) without caring about
// the sidebar's grouping.
export const NAV_ITEMS: NavItem[] = [
  ...NAV_GROUPS.flatMap((group) => group.items),
  SETTINGS_NAV_ITEM,
];
