// 5 -> "5 minutes", 60 -> "1 hour", 90 -> "90 minutes", 1440 -> "24 hours".
// Whole hours read better as hours; everything else stays in minutes.
export function formatMinutes(minutes: number) {
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

// "Stop after the last step", "Repeat once", "Repeat 3 times".
export function formatRepeat(repeatCount: number) {
  if (repeatCount === 0) return "Doesn't repeat";
  if (repeatCount === 1) return "Repeats once";
  return `Repeats ${repeatCount} times`;
}
