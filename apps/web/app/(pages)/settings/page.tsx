import { SettingsIcon } from "lucide-react";
import { PendingPage } from "@/components/shared/pending-page";

export default function SettingsPage() {
  return (
    <PendingPage
      icon={SettingsIcon}
      title="Settings"
      description="Organization details, members, invitations, and the danger zone."
    />
  );
}
