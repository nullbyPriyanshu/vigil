import { UserCogIcon } from "lucide-react";
import { PendingPage } from "@/components/shared/pending-page";

export default function ProfileSettingsPage() {
  return (
    <PendingPage
      icon={UserCogIcon}
      title="Profile"
      description="Your name, timezone, and password."
    />
  );
}
