import { LOGO_POLYGONS, LOGO_SIZE } from "@/lib/logo-shape";
import { cn } from "@/lib/utils";

// The Vigil mark. It takes the text colour, so it works on any background.
export function VigilMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${LOGO_SIZE} ${LOGO_SIZE}`}
      fill="currentColor"
      aria-hidden
      className={cn("size-[22px] shrink-0", className)}
    >
      {LOGO_POLYGONS.map((points, index) => (
        <polygon key={index} points={points.map((p) => p.join(",")).join(" ")} />
      ))}
    </svg>
  );
}
