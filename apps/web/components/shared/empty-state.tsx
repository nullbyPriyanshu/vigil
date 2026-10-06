import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// The dashed box a list page shows when there's nothing in it yet.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-black/15 px-6 py-16 text-center dark:border-white/15">
      <div className="flex size-11 items-center justify-center rounded-full bg-black/[0.04] text-muted-foreground dark:bg-white/[0.05]">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
