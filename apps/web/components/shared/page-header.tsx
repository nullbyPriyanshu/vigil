import type { ReactNode } from "react";

// Title + description + optional action, in the same spot on every page.
// Real list pages (once built) use this the same way PendingPage does now,
// so a page moving from "pending" to real content keeps the same header.
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
