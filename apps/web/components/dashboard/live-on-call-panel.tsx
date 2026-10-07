"use client";

import { useQuery } from "@tanstack/react-query";

import { OnCallPanel } from "@/components/dashboard/on-call-panel";
import { getOnCallApi } from "@/lib/api/schedules";

// "Mon 10:00" in the viewer's own timezone.
function untilLabel(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Fills the dashboard's "On call now" panel from the real schedules.
export function LiveOnCallPanel() {
  const { data } = useQuery({
    queryKey: ["on-call"],
    queryFn: async () => (await getOnCallApi()).data.data,
    refetchInterval: 60 * 1000,
  });

  // Schedules with nobody on call right now are left out.
  const entries = (data ?? [])
    .filter((row) => row.onCall && row.until)
    .map((row) => ({
      team: `${row.schedule.name} · ${row.team.name}`,
      user: row.onCall!.name,
      until: untilLabel(row.until!),
    }));

  return <OnCallPanel entries={entries} />;
}
