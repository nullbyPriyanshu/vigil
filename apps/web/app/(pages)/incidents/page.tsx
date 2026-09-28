import { SirenIcon } from "lucide-react";
import { PendingPage } from "@/components/shared/pending-page";

export default function IncidentsPage() {
  return (
    <PendingPage
      icon={SirenIcon}
      title="Incidents"
      description="A live list of every incident happening across your organization right now."
    />
  );
}
