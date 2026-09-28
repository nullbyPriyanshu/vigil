import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";

// Placeholder for a section whose real screen isn't built yet. Every
// sidebar destination renders one of these until its own page replaces it,
// so a first-time visitor sees an explanation instead of a blank route —
// the same empty-state rule the build plan applies to real list pages
// (day 51), just applied a step earlier, to the page itself.
export function PendingPage({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-20 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </div>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        <p className="text-xs text-muted-foreground/70">Coming soon</p>
      </div>
    </div>
  );
}
