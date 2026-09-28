import { CalendarClockIcon } from "lucide-react";
import { PendingPage } from "@/components/shared/pending-page";

export default function SchedulesPage() {
  return (
    <PendingPage
      icon={CalendarClockIcon}
      title="Schedules"
      description="Rotations that answer one question: who is on call right now?"
    />
  );
}
