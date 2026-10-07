"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

// The last line of defence: something broke outside the app's own pages.
export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <p className="text-sm font-semibold tracking-[0.2em] text-foreground">
          VIGIL
        </p>
        <h1 className="mt-6 text-lg font-semibold text-foreground">
          Something went wrong
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          It&apos;s on our side, not yours. Trying again usually works.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={retry} className="h-9 px-4">
            Try again
          </Button>
          <Button variant="outline" className="h-9 px-4" render={<Link href="/" />}>
            Go home
          </Button>
        </div>
      </div>
    </main>
  );
}
