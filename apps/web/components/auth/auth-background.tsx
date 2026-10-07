import type { ReactNode } from "react";
import { VigilMark } from "@/components/logo";
import { Navbar } from "@/components/navbar";

// Shared frame for the auth pages (login, signup, password reset): the
// navbar, then the logo and the page's form centred on a plain background.
export function AuthBackground({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white text-foreground transition-colors duration-300 dark:bg-[#050505]">
      {/* No login/user section here: these pages are only reachable while
          logged out, and the page itself already has the login/signup form. */}
      <Navbar showAuth={false} />

      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        {/* The headline and the line under the form are centred; the form
            fields themselves stay left-aligned. */}
        <div className="w-full max-w-[400px] [&_h1]:text-center [&_h1+p]:text-center [&>p]:text-center">
          <VigilMark className="mx-auto mb-7 size-10" />
          {children}
        </div>
      </div>
    </div>
  );
}
