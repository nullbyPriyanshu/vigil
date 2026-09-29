import type { ReactNode } from "react";
import { AuthShowcase } from "@/components/auth/auth-showcase";
import { Navbar } from "@/components/navbar";
import { SpotlightBackdrop } from "@/components/spotlight-backdrop";

// Shared chrome for auth pages (signup, login, ...): the navbar over a
// two-column split on wide screens, a static incident timeline on the left and
// the page's form on the right. Phones get the form alone. The form
// sits straight on the page surface (no card), so the layout itself does
// the framing. Pulled out so every auth page doesn't have to re-implement
// the same layout.
export function AuthBackground({ children }: { children: ReactNode }) {
  return (
    <SpotlightBackdrop variant="landing" className="h-dvh">
      {/* No login/user section here: these pages are only reachable while
          logged out, and the page itself already has the login/signup form. */}
      <Navbar showAuth={false} />

      <div className="relative grid min-h-0 flex-1 lg:grid-cols-2">
        <div
          aria-hidden
          className="relative hidden border-r border-border lg:block"
        >
          <AuthShowcase />
        </div>
        <div className="flex items-center justify-center overflow-y-auto px-4 py-8 sm:px-6">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
      </div>
    </SpotlightBackdrop>
  );
}
