import { SirenIcon } from "lucide-react";
import { PendingPage } from "@/components/shared/pending-page";

export default async function IncidentDetailPage(
  props: PageProps<"/incidents/[number]">,
) {
  const { number } = await props.params;

  return (
    <PendingPage
      icon={SirenIcon}
      title={`Incident INC-${number}`}
      description="The full timeline, escalation status, and comments for this incident will live here."
    />
  );
}
