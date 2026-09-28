import { CalendarClockIcon } from "lucide-react";
import { PendingPage } from "@/components/shared/pending-page";

export default async function ScheduleDetailPage(
  props: PageProps<"/schedules/[id]">,
) {
  await props.params;

  return (
    <PendingPage
      icon={CalendarClockIcon}
      title="Schedule"
      description="The rotation order, upcoming handoffs, and who's on call now will live here."
    />
  );
}
