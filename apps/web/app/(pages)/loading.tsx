import { Loader2 } from "lucide-react";

// Fallback for every authenticated route that doesn't define its own more
// specific loading.tsx (dashboard/loading.tsx overrides this for
// /dashboard). Most of those routes are still pending pages with no real
// content shape yet, so a spinner is the honest choice here — a skeleton
// would just be guessing at a layout that doesn't exist.
export default function PagesLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
