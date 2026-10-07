import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];

const AUTH_ROUTES = ["/login", "/signup", "/forgot-password"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    PUBLIC_ROUTES.includes(pathname) ||
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/a/");
  const isAuthRoute = AUTH_ROUTES.includes(pathname);
  const hasToken = Boolean(request.cookies.get("vigil_token")?.value);

  const hasRefreshToken = Boolean(
    request.cookies.get("vigil_refresh_token")?.value,
  );

  if (!hasToken && !hasRefreshToken && !isPublic) {
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
