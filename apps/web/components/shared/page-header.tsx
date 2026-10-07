import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// Title + description + optional action, in the same spot on every page.
// List pages pass their sidebar icon, which gives each section of the app
// its own mark at the top.
export function PageHeader({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3.5">
        {Icon && (
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Icon className="size-5" />
          </span>
        )}
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {title}
          </h1>
          {description && (
            <p className="max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}
