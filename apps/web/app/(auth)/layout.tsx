import type { ReactNode } from "react";
import { AuthBackground } from "@/components/auth/auth-background";

// Shared by every auth page. Layouts stay mounted when navigating between
// sibling routes, so the left panel (and its carousel) doesn't restart when
// switching between login and signup. Only the form on the right changes.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthBackground>{children}</AuthBackground>;
}
