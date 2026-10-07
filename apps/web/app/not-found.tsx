import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <p className="text-sm font-semibold tracking-[0.2em] text-foreground">
          VIGIL
        </p>
        <p className="mt-6 font-mono text-sm text-muted-foreground">404</p>
        <h1 className="mt-1 text-lg font-semibold text-foreground">
          This page doesn&apos;t exist
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          The link may be old, or the address was mistyped.
        </p>
        <Button className="mt-6 h-9 px-4" render={<Link href="/dashboard" />}>
          Go to the dashboard
        </Button>
      </div>
    </main>
  );
}
