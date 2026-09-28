import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell/app-shell";

// Shared frame for every authenticated route. Mounting AppShell here once,
// rather than per-page, is what makes navigating between sidebar links
// swap only the page content instead of remounting the header/sidebar.
export default function PagesLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
