import { PageSkeleton } from "@/components/shared/page-skeleton";

// Shown while moving between pages in the app, before the next one is ready.
export default function PagesLoading() {
  return <PageSkeleton />;
}
