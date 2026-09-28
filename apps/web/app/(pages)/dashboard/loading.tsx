import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";

// Next's automatic Suspense fallback for the /dashboard segment — shown
// while navigating in, before the page's content is ready. Nested under
// dashboard/ so it's specific to this route rather than the generic one at
// (pages)/loading.tsx.
export default function DashboardLoading() {
  return <DashboardSkeleton />;
}
