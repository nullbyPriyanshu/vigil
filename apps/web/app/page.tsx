import { HeroActions } from "@/components/home/hero-actions";
import { Navbar } from "@/components/navbar";
import { SpotlightBackdrop } from "@/components/spotlight-backdrop";

export default function Home() {
  return (
    <SpotlightBackdrop variant="landing" className="min-h-dvh">
      <Navbar />

      {/* flex-1 + centering puts the hero in the middle of whatever is left
          below the navbar; min-h-dvh on the shell lets short screens scroll
          instead of clipping. */}
      <main className="relative flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
        <div className="animate-card-in mx-auto flex max-w-2xl flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/40 px-3 py-1 text-xs text-muted-foreground">
            <span aria-hidden className="relative flex size-1.5">
              <span className="absolute inline-flex size-full rounded-full bg-emerald-400/70 motion-safe:animate-ping" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
            </span>
            On-call incident management
          </span>

          {/* The fade-to-transparent gradient reads fine in dark mode
              (bright white easing to a still-legible gray), but the same
              /55 endpoint on a light background washes the second line out
              almost completely — light mode gets a much gentler fade to
              keep it readable. */}
          <h1 className="mt-6 bg-linear-to-b from-foreground to-foreground/80 bg-clip-text text-4xl leading-[1.05] font-semibold tracking-tight text-balance text-transparent sm:text-6xl dark:to-foreground/55">
            On-call, without the chaos.
          </h1>

          <p className="mt-5 max-w-lg text-base text-pretty text-muted-foreground sm:text-lg">
            Vigil keeps your team ready. See who&apos;s on call, manage alerts,
            and resolve incidents faster.
          </p>

          <HeroActions />
        </div>
      </main>
    </SpotlightBackdrop>
  );
}
