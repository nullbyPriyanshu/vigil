import { UsersIcon } from "lucide-react";
import { PendingPage } from "@/components/shared/pending-page";

export default function TeamsPage() {
  return (
    <PendingPage
      icon={UsersIcon}
      title="Teams"
      description="Named groups of engineers who share on-call duty."
    />
  );
}
