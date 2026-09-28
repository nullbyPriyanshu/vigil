import { HeroActions } from "@/components/home/hero-actions";
import { LandingScrollScene } from "@/components/home/landing-scroll-scene";
import { SiteFooter } from "@/components/home/site-footer";
import { Navbar } from "@/components/navbar";

export default function Home() {
  return (
    // Not SpotlightBackdrop: its overflow-hidden would make it the scroll
    // container for the sticky navbar and stage below, and pin nothing.
    // Same flat surface it gave the landing variant, though.
    <div className="relative bg-white text-foreground transition-colors duration-300 dark:bg-zinc-950">
      <div className="sticky top-0 z-20">
        <Navbar />
      </div>

      <main>
        <LandingScrollScene
          hero={
            <div className="animate-card-in relative mx-auto flex max-w-2xl flex-col items-center text-center">
              {/* <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/40 px-3 py-1 text-xs text-muted-foreground">
                <span aria-hidden className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full rounded-full bg-emerald-400/70 motion-safe:animate-ping" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
                </span>
                On-call incident management
              </span> */}

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
          }
        />
      </main>

      <SiteFooter />
    </div>
  );
}
