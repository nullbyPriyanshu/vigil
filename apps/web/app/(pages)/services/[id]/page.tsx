import { BoxesIcon } from "lucide-react";
import { PendingPage } from "@/components/shared/pending-page";

export default async function ServiceDetailPage(
  props: PageProps<"/services/[id]">,
) {
  await props.params;

  return (
    <PendingPage
      icon={BoxesIcon}
      title="Service"
      description="API keys, integration snippets, and recent alerts for this service will live here."
    />
  );
}
