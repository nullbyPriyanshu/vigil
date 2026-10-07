// How close a time is to its target: the bar fills up to the target line
// and turns amber once it's over.
export function TargetBar({
  actualSeconds,
  targetSeconds,
}: {
  actualSeconds: number | null;
  targetSeconds: number;
}) {
  const share =
    actualSeconds === null ? 0 : Math.min(actualSeconds / (targetSeconds * 2), 1);
  const over = actualSeconds !== null && actualSeconds > targetSeconds;

  return (
    <div aria-hidden className="relative h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
      <div
        className={`h-1.5 rounded-full ${over ? "bg-amber-500" : "bg-emerald-500 dark:bg-emerald-400"}`}
        style={{ width: `${share * 100}%` }}
      />
      {/* The target sits at the halfway mark. */}
      <span className="absolute top-1/2 left-1/2 h-3 w-px -translate-y-1/2 bg-black/30 dark:bg-white/40" />
    </div>
  );
}
