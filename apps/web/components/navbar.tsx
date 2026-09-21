import Link from "next/link";

// Minimal top navbar shared across pages. Keep this simple: just a brand
// link for now. If a page needs extra items later (nav links, a user menu),
// add an optional prop rather than hardcoding page-specific logic here.
export function Navbar() {
  return (
    // "relative z-10" keeps this above any absolutely-positioned decorative
    // background a page places behind it (positioned elements otherwise
    // paint above static ones by default, which would leave the blur with
    // nothing behind it to actually frost).
    <header className="relative z-10 flex h-12 w-full shrink-0 items-center border-b border-border/40 bg-background/30 px-4 backdrop-blur-md sm:px-6">
      <Link
        href="/"
        className="text-base font-semibold tracking-tight text-foreground"
      >
        Vigil
      </Link>
    </header>
  );
}
