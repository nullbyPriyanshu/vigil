import { BoxesIcon } from "lucide-react";
import { PendingPage } from "@/components/shared/pending-page";

export default function ServicesPage() {
  return (
    <PendingPage
      icon={BoxesIcon}
      title="Services"
      description="The things that can break. Each service owns an escalation policy, API keys, and integration instructions."
    />
  );
}
