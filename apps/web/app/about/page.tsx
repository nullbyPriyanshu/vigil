import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";

import { LandingNavbar } from "@/components/home/landing-navbar";
import { SiteFooter } from "@/components/home/site-footer";
import { VigilMark } from "@/components/logo";

export const metadata: Metadata = {
  title: "About · Vigil",
  description: "Who built Vigil, and why.",
};

const REPO_URL = "https://github.com/nullbyPriyanshu/vigil";
const PROFILE_URL = "https://github.com/nullbyPriyanshu";

const BORDER = "border-black/[0.08] dark:border-white/[0.08]";
const LABEL =
  "text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase";
const LINK =
  "inline-flex items-center gap-1 rounded-md font-medium text-zinc-900 underline decoration-black/20 underline-offset-4 outline-none hover:decoration-black/60 focus-visible:ring-2 focus-visible:ring-emerald-400/60 dark:text-zinc-100 dark:decoration-white/25 dark:hover:decoration-white/70";

// What Vigil does, in the order it happens to an alert.
const WHAT_IT_DOES = [
  {
    title: "Takes the alert",
    text: "Monitoring tools post to one address. Repeats of the same problem are folded into one incident instead of twenty.",
  },
  {
    title: "Finds the right person",
    text: "Rotating schedules decide who is on call, in each person's own timezone, daylight saving included.",
  },
  {
    title: "Doesn't let it sit",
    text: "If nobody answers in time, the escalation policy pages the next person, and the one after that.",
  },
  {
    title: "Keeps the record",
    text: "Every page, acknowledgement and fix lands on a timeline, so the review afterwards writes itself.",
  },
];

const BUILT_WITH = [
  { name: "Next.js and React", use: "the app you are looking at" },
  { name: "NestJS", use: "the API behind it" },
  { name: "PostgreSQL and Prisma", use: "where everything is kept" },
  { name: "Redis and BullMQ", use: "the timers that drive escalation" },
  { name: "Socket.IO", use: "live updates without refreshing" },
  { name: "Resend", use: "the emails that page people" },
];

export default function AboutPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-white text-foreground transition-colors duration-300 dark:bg-(--ink-0)">
      <LandingNavbar />

      <main className="flex-1">
        {/* ---------- The person ---------- */}
        <section className="mx-auto grid max-w-5xl items-center gap-x-16 gap-y-10 px-4 pt-16 pb-20 sm:px-6 sm:pt-24 md:grid-cols-[auto_minmax(0,1fr)]">
          <div className={`animate-card-in mx-auto size-48 overflow-hidden rounded-full border sm:size-60 md:mx-0 ${BORDER}`}>
            <Image
              src="/about/priyanshu.jpg"
              alt="Priyanshu Maurya"
              width={449}
              height={449}
              priority
              className="size-full object-cover"
            />
          </div>

          <div className="animate-card-in text-center md:text-left">
            <p className={LABEL}>About</p>
            <h1 className="mt-5 text-4xl leading-[1] font-semibold text-balance text-zinc-950 sm:text-6xl dark:text-zinc-100">
              Hi, I&apos;m Priyanshu.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-pretty text-zinc-600 sm:text-xl dark:text-zinc-400">
              I&apos;m Priyanshu Maurya, a full-stack developer who loves to
              cook. In the kitchen and in code I like the same things: good
              ingredients, a clear recipe, and knowing exactly what is
              happening under the lid.
            </p>
            <p className="mt-6 text-sm text-zinc-500">
              <Link href={PROFILE_URL} target="_blank" rel="noreferrer" className={LINK}>
                @nullbyPriyanshu
                <ArrowUpRightIcon className="size-3.5" />
              </Link>
              <span className="mx-3" aria-hidden>
                ·
              </span>
              <Link href="mailto:pmaurya.dev@gmail.com" className={LINK}>
                pmaurya.dev@gmail.com
              </Link>
            </p>
          </div>
        </section>

        {/* ---------- Why Vigil ---------- */}
        <section className={`border-t ${BORDER}`}>
          <div className="mx-auto grid max-w-5xl gap-x-16 gap-y-8 px-4 py-20 sm:px-6 sm:py-24 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div>
              <p className={LABEL}>01 / Why I built it</p>
              <h2 className="mt-5 font-heading text-3xl leading-[1.05] font-semibold tracking-[-0.03em] text-balance text-zinc-950 sm:text-4xl dark:text-zinc-100">
                Someone has to be awake when it breaks.
              </h2>
            </div>
            <div className="space-y-5 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
              <p>
                A vigil is a watch kept through the night. That is what
                on-call is: one person staying ready so everyone else can
                sleep.
              </p>
              <p>
                I wanted to understand how that really works. Not the
                dashboard, but the parts underneath: how an alert becomes
                exactly one incident, how a timer survives a server restart,
                how two people pressing Acknowledge at the same moment
                doesn&apos;t make a mess.
              </p>
              <p>
                So I built the whole thing, start to finish, the way I would
                learn a dish: by making it myself until it came out right.
              </p>
            </div>
          </div>
        </section>

        {/* ---------- What it does ---------- */}
        <section className={`border-t ${BORDER}`}>
          <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-24">
            <p className={LABEL}>02 / What Vigil does</p>
            <ol className={`mt-10 grid overflow-hidden rounded-2xl border sm:grid-cols-2 ${BORDER}`}>
              {WHAT_IT_DOES.map((item, index) => (
                <li
                  key={item.title}
                  className={`border-b p-7 last:border-b-0 sm:odd:border-r sm:[&:nth-last-child(-n+2)]:border-b-0 ${BORDER}`}
                >
                  <span className="font-mono text-xs text-zinc-500">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 text-base font-medium text-zinc-900 dark:text-zinc-100">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {item.text}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- Built with ---------- */}
        <section className={`border-t ${BORDER}`}>
          <div className="mx-auto grid max-w-5xl gap-x-16 gap-y-8 px-4 py-20 sm:px-6 sm:py-24 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div>
              <p className={LABEL}>03 / The ingredients</p>
              <h2 className="mt-5 font-heading text-3xl leading-[1.05] font-semibold tracking-[-0.03em] text-balance text-zinc-950 sm:text-4xl dark:text-zinc-100">
                What it&apos;s made of.
              </h2>
            </div>
            <dl className={`divide-y border-y ${BORDER} divide-black/[0.08] dark:divide-white/[0.08]`}>
              {BUILT_WITH.map((item) => (
                <div key={item.name} className="flex flex-wrap justify-between gap-x-6 gap-y-1 py-3.5">
                  <dt className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {item.name}
                  </dt>
                  <dd className="text-sm text-zinc-500">{item.use}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ---------- Closing ---------- */}
        <section className={`border-t ${BORDER}`}>
          <div className="mx-auto flex max-w-5xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-24">
            <VigilMark className="size-10" />
            <h2 className="mt-6 max-w-xl font-heading text-3xl leading-[1.05] font-semibold tracking-[-0.03em] text-balance text-zinc-950 sm:text-4xl dark:text-zinc-100">
              The code is open. Have a look under the hood.
            </h2>
            <Link
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-emerald-400 px-7 text-[15px] font-semibold text-(--brand-foreground) transition-colors outline-none hover:bg-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              View Vigil on GitHub
              <ArrowUpRightIcon className="size-4" />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
