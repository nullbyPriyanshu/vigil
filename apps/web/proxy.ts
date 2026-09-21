import { NextRequest, NextResponse } from "next/server";

// Reachable without logging in.
const PUBLIC_ROUTES = ["/", "/login", "/signup", "/forgot-password"];

// Only for logged-out users. Logged-in users get sent to Home instead.
// Keep "/" out of this list, or "/" would redirect to itself forever.
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    PUBLIC_ROUTES.includes(pathname) ||
    pathname.startsWith("/invite/") || // day 13
    pathname.startsWith("/a/"); // day 38, one-click acknowledge
  const isAuthRoute = AUTH_ROUTES.includes(pathname);
  const hasToken = Boolean(request.cookies.get("vigil_token")?.value);

  if (!hasToken && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasToken && isAuthRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
