// Landing-page footer: copyright on the left, GitHub and About us on the
// right. Same border and surface as the navbar so the page is framed by
// matching chrome top and bottom. The right-hand items are placeholders
// for now: plain buttons with no action until there's somewhere for them
// to go.
export function SiteFooter() {
  const item =
    "cursor-pointer rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:outline-none";

  return (
    <footer className="relative z-10 border-t border-black/[0.06] bg-white transition-colors duration-300 dark:border-white/[0.06] dark:bg-[#09090b]">
      <div className="flex flex-col-reverse items-center justify-between gap-3 px-4 py-6 sm:flex-row sm:px-6">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Vigil. All rights reserved.
        </p>
        <div className="flex items-center gap-5">
          <button type="button" aria-label="GitHub" className={item}>
            <GitHubMark className="size-4" />
          </button>
          <button type="button" className={`${item} text-xs`}>
            About us
          </button>
        </div>
      </div>
    </footer>
  );
}

// Lucide dropped brand icons, so the GitHub mark is inlined here.
function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}
