import { cn } from "@/lib/utils";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function UserAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-linear-to-b from-zinc-100 to-zinc-200 font-semibold text-zinc-700 ring-1 ring-black/10 select-none ring-inset dark:from-zinc-700 dark:to-zinc-800 dark:text-zinc-200 dark:ring-white/10",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
