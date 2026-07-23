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
  const isAuthPage = pathname.startsWith("/login");

  if (isAuthPage) {
    if (isLoggedIn) return withRequestId(NextResponse.redirect(new URL("/dashboard", req.url)));
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
