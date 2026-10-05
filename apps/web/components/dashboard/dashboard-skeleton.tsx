import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Fixed pixel heights matching WeeklyIncidentsChart's own sizing, so the
// skeleton's bars sit exactly where the real bars will render — see that
// component for why pixels are used instead of percentage heights.
const CHART_ROW_HEIGHT = 200;
const BAR_HEIGHTS = [70, 105, 62, 123, 167, 35, 53];

// Mirrors the real dashboard's layout piece for piece (four stat cards, the
// on-call/weekly-chart row, the open-incidents list) so nothing shifts or
// resizes when the real content swaps in. Rendered by dashboard/loading.tsx
// as the route's Suspense fallback, and reusable later as a client-side
// fallback too, once the dashboard fetches from a real endpoint.
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent>
              <Skeleton className="size-9 rounded-lg" />
              <Skeleton className="mt-4 h-7 w-20" />
              <Skeleton className="mt-2 h-4 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <div
              className="flex items-end gap-2"
              style={{ height: CHART_ROW_HEIGHT }}
            >
              {BAR_HEIGHTS.map((h, i) => (
                <div
                  key={i}
                  className="flex flex-1 flex-col justify-end"
                  style={{ height: CHART_ROW_HEIGHT }}
                >
                  <Skeleton
                    className="w-full rounded-t-sm"
                    style={{ height: h }}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </CardContent>
        </Card>

      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <div className="divide-y divide-border/60">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-(--card-spacing) py-3"
            >
              <Skeleton className="size-2 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-14 shrink-0" />
              <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
              <div className="min-w-48 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
