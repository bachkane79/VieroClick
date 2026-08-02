import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/server/auth/config";

// Edge-safe: build a minimal auth instance from the DB-free config.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-request-id", requestId);

  const withRequestId = (res: Response) => {
    res.headers.set("x-request-id", requestId);
    return res;
  };

  const pathname = req.nextUrl.pathname;

  // WP-G1: /api routes only need the requestId stamped for downstream
  // logging (api-handler.ts) — the auth gate below is for pages only, since
  // API routes handle their own auth (Bearer token or session, see context.ts).
  if (pathname.startsWith("/api")) {
    return withRequestId(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  const isLoggedIn = !!req.auth?.user?.id;
  // /login and /register render for everyone. We do NOT bounce a "logged-in"
  // visitor to /dashboard here: middleware runs at the edge and can only see
  // the raw JWT, not whether its user still exists (a token can outlive its
  // user after account deletion / a DB wipe). The pages themselves redirect a
  // genuinely signed-in user using a DB-verified session, so a stale token can
  // still reach the sign-in form instead of looping.
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");

  if (isAuthPage) {
    return withRequestId(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  // The marketing root is the product's only public page. Matched exactly —
  // a `startsWith` here would expose every route under it. `app/page.tsx`
  // sends signed-in visitors on to /dashboard itself, so this gate stays a
  // pure "anonymous traffic may render `/`" exception and nothing more.
  if (pathname === "/") {
    return withRequestId(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  if (!isLoggedIn) {
    return withRequestId(NextResponse.redirect(new URL("/login", req.url)));
  }

  return withRequestId(NextResponse.next({ request: { headers: requestHeaders } }));
});

export const config = {
  // Now includes /api (excluded before) so REST routes get x-request-id too;
  // still excludes static assets/framework internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
