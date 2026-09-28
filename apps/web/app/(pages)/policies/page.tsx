import { WorkflowIcon } from "lucide-react";
import { PendingPage } from "@/components/shared/pending-page";

export default function PoliciesPage() {
  return (
    <PendingPage
      icon={WorkflowIcon}
      title="Escalation Policies"
      description="The ordered list of who gets notified, and how long to wait, before moving on to the next step."
    />
  );
}
