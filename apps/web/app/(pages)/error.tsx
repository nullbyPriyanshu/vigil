"use client";

import { useEffect } from "react";

import { LoadError } from "@/components/shared/load-error";

// Catches a crash inside any page of the app. The sidebar and header stay
// put, so the person can retry or go somewhere else.
export default function PagesError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <LoadError onRetry={retry} />;
}
