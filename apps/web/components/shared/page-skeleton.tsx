import { Skeleton } from "@/components/ui/skeleton";

// The generic "page is loading" shape: a title, a line of description and a
// block of content. Used wherever a page doesn't have its own skeleton, so
// loading looks the same everywhere.
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
