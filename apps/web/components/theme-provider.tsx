"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

// Thin client-boundary wrapper — next-themes' own provider needs to run on
// the client (it reads/writes localStorage and the <html> class), and the
// root layout that mounts it is a Server Component.
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
