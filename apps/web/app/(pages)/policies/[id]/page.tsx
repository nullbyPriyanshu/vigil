import { WorkflowIcon } from "lucide-react";
import { PendingPage } from "@/components/shared/pending-page";

export default async function PolicyDetailPage(
  props: PageProps<"/policies/[id]">,
) {
  await props.params;

  return (
    <PendingPage
      icon={WorkflowIcon}
      title="Escalation Policy"
      description="Add, reorder, and configure the steps this policy escalates through."
    />
  );
}
