import {
  BarChart3Icon,
  BellRingIcon,
  CalendarClockIcon,
  HistoryIcon,
  ShieldCheckIcon,
  UsersIcon,
  WorkflowIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";
import { HeroActions } from "@/components/home/hero-actions";
import { LandingNavbar } from "@/components/home/landing-navbar";
import { ParticleLogo } from "@/components/home/particle-logo";
import { HowItWorks } from "@/components/home/how-it-works";
import { ProductShot } from "@/components/home/product-shot";
import { ProductStage } from "@/components/home/product-stage";
import { Reveal } from "@/components/home/reveal";
import { SiteFooter } from "@/components/home/site-footer";
import { cn } from "@/lib/utils";

const HIGHLIGHTS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: ZapIcon, title: "Faster response", text: "Page the right person first" },
  { icon: UsersIcon, title: "Team ready", text: "Always know who's on call" },
  { icon: ShieldCheckIcon, title: "Less downtime", text: "Nothing sits unanswered" },
];

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: BellRingIcon,
    title: "Alert routing",
    text: "Alerts go to whoever is on call right now, not to a shared inbox nobody is watching.",
  },
  {
    icon: CalendarClockIcon,
    title: "On-call schedules",
    text: "Rotations and hand-offs in one place, shown to each person in their own timezone.",
  },
  {
    icon: WorkflowIcon,
    title: "Escalation policies",
    text: "If nobody acknowledges in time, the next person is paged automatically.",
  },
  {
    icon: HistoryIcon,
    title: "Incident timeline",
    text: "Every trigger, page, acknowledgement and fix, in the order it happened.",
  },
  {
    icon: UsersIcon,
    title: "Teams and roles",
    text: "Owners, admins, responders and viewers each get the access they need and no more.",
  },
  {
    icon: BarChart3Icon,
    title: "Response analytics",
    text: "See how quickly incidents are acknowledged and resolved, week over week.",
  },
];

const ROLES = [
  { name: "Owner", can: "Runs the organization and can hand it over." },
  { name: "Admin", can: "Manages members and organization settings." },
  { name: "Responder", can: "Goes on call and responds to incidents." },
  { name: "Viewer", can: "Can see everything, without changing it." },
];

const BORDER = "border-black/[0.06] dark:border-white/[0.06]";

export default function Home() {
  return (
    <div className="relative bg-white text-foreground transition-colors duration-300 dark:bg-[#050505]">
      <LandingNavbar />

      <main>
        {/* ---------- Hero ---------- */}
        <section className="relative overflow-hidden">
          <div className="animate-card-in mx-auto flex max-w-5xl flex-col items-center px-4 pt-14 pb-16 text-center sm:px-6 sm:pt-20 lg:pb-24">
            <p className="text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
              Vigil · On-call and incident response
            </p>

            <ParticleLogo className="mt-6 w-[min(21rem,72vw)]" />

            <h1 className="mt-4 text-5xl leading-[0.95] font-semibold text-balance text-zinc-950 sm:text-6xl lg:text-[4.75rem] dark:text-zinc-100">
              On-call, without the chaos.
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-pretty text-zinc-600 sm:text-lg dark:text-zinc-400">
              See who&apos;s on call, route every alert to the right person,
              and resolve incidents faster.
            </p>

            <HeroActions
              className="mt-9 justify-center"
              secondary={{ label: "See how it works", sectionId: "how-it-works" }}
            />

            <ul className={cn("mt-16 grid w-full gap-px overflow-hidden rounded-xl border text-left sm:grid-cols-3", BORDER)}>
              {HIGHLIGHTS.map((item) => (
                <li key={item.title} className="flex items-center gap-3 px-5 py-4">
                  <item.icon className="size-[18px] shrink-0 text-zinc-500 dark:text-zinc-400" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {item.title}
                    </span>
                    <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                      {item.text}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <ProductStage />

        {/* ---------- Features ---------- */}
        <section id="features" className={cn("scroll-mt-16 border-t", BORDER)}>
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
            <Reveal>
              <SectionLabel index={2}>Features</SectionLabel>
              <h2 className="mt-4 max-w-2xl font-heading text-4xl leading-[1.02] font-semibold tracking-[-0.035em] text-balance text-zinc-950 sm:text-5xl dark:text-zinc-100">
                Everything on-call needs, in one place.
              </h2>
              <p className="mt-5 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
                From the first alert to the final fix, Vigil keeps the whole
                response in view.
              </p>
            </Reveal>

            <div className={cn("mt-12 grid overflow-hidden rounded-2xl border sm:grid-cols-2 lg:grid-cols-3", BORDER)}>
              {FEATURES.map((feature, i) => (
                <Reveal
                  key={feature.title}
                  delay={(i % 3) * 80}
                  className={cn(
                    "border-b p-7 sm:border-r lg:[&:nth-child(3n)]:border-r-0 lg:[&:nth-last-child(-n+3)]:border-b-0 sm:max-lg:[&:nth-child(2n)]:border-r-0 sm:max-lg:[&:nth-last-child(-n+2)]:border-b-0 max-sm:last:border-b-0",
                    BORDER,
                  )}
                >
                  <span className={cn("flex size-10 items-center justify-center rounded-lg border", BORDER)}>
                    <feature.icon className="size-[18px] text-zinc-500 dark:text-zinc-400" />
                  </span>
                  <h3 className="mt-5 text-base font-medium text-zinc-900 dark:text-zinc-100">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {feature.text}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section id="how-it-works" className={cn("scroll-mt-16 overflow-x-clip border-t", BORDER)}>
          <div className="mx-auto grid max-w-7xl gap-x-16 gap-y-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
            {/* Stays in view on wide screens while the steps scroll past. */}
            <Reveal className="lg:sticky lg:top-32 lg:self-start">
              <SectionLabel index={3}>How it works</SectionLabel>
              <h2 className="mt-4 font-heading text-4xl leading-[1.02] font-semibold tracking-[-0.035em] text-balance text-zinc-950 sm:text-5xl dark:text-zinc-100">
                From alert to resolved in three steps.
              </h2>
              <p className="mt-5 max-w-sm text-lg text-zinc-600 dark:text-zinc-400">
                Nobody has to work out who to call. Vigil does the routing, so
                your team can go straight to the fix.
              </p>
            </Reveal>

            <HowItWorks />
          </div>
        </section>

        {/* ---------- Team ---------- */}
        <section className={cn("overflow-hidden border-t", BORDER)}>
          <div className="mx-auto grid max-w-7xl items-center gap-x-14 gap-y-14 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <Reveal>
              <SectionLabel index={4}>Your team</SectionLabel>
              <h2 className="mt-4 font-heading text-4xl leading-[1.02] font-semibold tracking-[-0.035em] text-balance text-zinc-950 sm:text-5xl dark:text-zinc-100">
                Everyone in, each with the right access.
              </h2>
              <p className="mt-5 max-w-md text-lg text-zinc-600 dark:text-zinc-400">
                See who&apos;s in your organization at a glance, and change
                what each person can do in a couple of clicks.
              </p>

              <dl className={cn("mt-8 divide-y border-y", BORDER, "divide-black/[0.06] dark:divide-white/[0.06]")}>
                {ROLES.map((role) => (
                  <div key={role.name} className="flex gap-6 py-3.5">
                    <dt className="w-24 shrink-0 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {role.name}
                    </dt>
                    <dd className="text-sm text-zinc-600 dark:text-zinc-400">
                      {role.can}
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>

            <ProductShot
              name="members"
              className="lg:w-[140%]"
              alt="The members page in Vigil: everyone in the organization with their role, timezone and join date."
            />
          </div>
        </section>

        {/* ---------- Closing call to action ---------- */}
        <section className={cn("border-t", BORDER)}>
          <Reveal className="mx-auto flex max-w-7xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-28">
            <h2 className="max-w-3xl font-heading text-4xl leading-[1.02] font-semibold tracking-[-0.035em] text-balance text-zinc-950 sm:text-6xl dark:text-zinc-100">
              Ready for calmer on-call?
            </h2>
            <p className="mt-5 max-w-lg text-base text-zinc-600 dark:text-zinc-400">
              Set up your organization in a couple of minutes and see who&apos;s
              covering what.
            </p>
            <HeroActions className="mt-9 justify-center" />
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

// The small numbered line above each section's headline: "02 / FEATURES".
function SectionLabel({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  return (
    <p className="text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
      {String(index).padStart(2, "0")} / {children}
    </p>
  );
}
