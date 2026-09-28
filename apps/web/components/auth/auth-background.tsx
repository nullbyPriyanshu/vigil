import type { ReactNode } from "react";
import { Navbar } from "@/components/navbar";
import { SpotlightBackdrop } from "@/components/spotlight-backdrop";

// Shared chrome for auth pages (signup, login, ...): the navbar, the same
// flat, solid backdrop as the landing page, and a centered column for the
// page's own card. Pulled out so every auth page doesn't have to
// re-implement the same layout.
export function AuthBackground({ children }: { children: ReactNode }) {
  return (
    <SpotlightBackdrop variant="landing" className="h-dvh">
      {/* No login/user section here: these pages are only reachable while
          logged out, and the page itself already has the login/signup form. */}
      <Navbar showAuth={false} />

      {/* Content area fills the space below the navbar and centers the card
          in it, so the navbar gets its own row instead of overlapping. */}
      <div className="relative flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="relative w-full max-w-[500px]">{children}</div>
      </div>
    </SpotlightBackdrop>
  );
}
