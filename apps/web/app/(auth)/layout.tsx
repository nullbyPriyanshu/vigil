import type { ReactNode } from "react";
import { AuthBackground } from "@/components/auth/auth-background";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthBackground>{children}</AuthBackground>;
}
