import { BarChart3Icon } from "lucide-react";
import { PendingPage } from "@/components/shared/pending-page";

export default function AnalyticsPage() {
  return (
    <PendingPage
      icon={BarChart3Icon}
      title="Analytics"
      description="MTTA, MTTR, and incident trends over time — how well your team is actually responding."
    />
  );
}
