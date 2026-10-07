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

// Seconds as a short duration: 45 -> "45s", 252 -> "4m 12s", 2280 -> "38m",
// 5400 -> "1h 30m". null (nothing to average) -> "–".
export function formatSeconds(seconds: number | null) {
  if (seconds === null) return "–";
  if (seconds < 60) return `${Math.round(seconds)}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 10) {
    const rest = Math.round(seconds % 60);
    return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
  }
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes === 0 ? `${hours}h` : `${hours}h ${restMinutes}m`;
}
