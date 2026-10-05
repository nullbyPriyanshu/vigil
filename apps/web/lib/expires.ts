// "expires in 6 days", "expires in 5 hours", "expires soon".
export function expiresIn(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const days = Math.floor(hours / 24);

  if (days >= 1) return `expires in ${days} ${days === 1 ? "day" : "days"}`;
  if (hours >= 1) return `expires in ${hours} ${hours === 1 ? "hour" : "hours"}`;
  return "expires soon";
}
