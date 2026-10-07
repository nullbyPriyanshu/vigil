import type { RotationType } from "@/lib/api/schedules";

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// "Every Monday at 10:00" / "Every day at 09:00"
export function describeRotation(schedule: {
  rotationType: RotationType;
  handoffDay: number | null;
  handoffTime: string;
}) {
  if (schedule.rotationType === "WEEKLY" && schedule.handoffDay !== null) {
    return `Every ${WEEKDAYS[schedule.handoffDay]} at ${schedule.handoffTime}`;
  }
  return `Every day at ${schedule.handoffTime}`;
}

// "Mon 12 Jan, 10:00" in the viewer's own timezone.
export function formatShiftTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "+05:30"-style label for a timezone, e.g. "GMT+5:30".
function offsetLabel(timeZone: string) {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  })
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? "";
}

// Every timezone the browser knows, for a Select. `current` is added in
// case it's one this browser doesn't list.
export function timezoneItems(current?: string) {
  const all = Intl.supportedValuesOf("timeZone");
  if (current && !all.includes(current)) all.unshift(current);
  return all.map((tz) => ({
    value: tz,
    label: `${tz.replaceAll("_", " ")} (${offsetLabel(tz)})`,
  }));
}
