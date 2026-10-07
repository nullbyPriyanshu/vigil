import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function ListCard({ rows }: { rows: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </CardContent>
    </Card>
  );
}

// The dashboard's shape while it loads: greeting, the two columns, and the
// activity card underneath, so nothing jumps when the real content arrives.
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-7">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <ListCard rows={4} />
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-28" />
            </CardHeader>
            <CardContent className="space-y-5">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-[150px] w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <ListCard rows={3} />
          <ListCard rows={5} />
        </div>
      </div>

      <ListCard rows={3} />
    </div>
  );
}
