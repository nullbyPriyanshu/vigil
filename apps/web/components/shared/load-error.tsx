import { RotateCwIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

// What a page shows when its data couldn't be loaded: one sentence and a
// way to try again, instead of a skeleton that never finishes.
export function LoadError({
  what = "this page",
  onRetry,
}: {
  what?: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-black/15 px-6 py-14 text-center dark:border-white/15">
      <div className="flex size-11 items-center justify-center rounded-full bg-black/[0.04] text-muted-foreground dark:bg-white/[0.05]">
        <TriangleAlertIcon className="size-5" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">
          Couldn&apos;t load {what}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Check your connection and try again.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCwIcon className="size-3.5" />
        Try again
      </Button>
    </div>
  );
}
