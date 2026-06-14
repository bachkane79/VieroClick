import NextAuth from "next-auth";
import { authConfig } from "@/server/auth/config";

// Edge-safe: build a minimal auth instance from the DB-free config.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith("/login");

  if (isAuthPage) {
    if (isLoggedIn) return Response.redirect(new URL("/dashboard", req.url));
    return;
  }

  if (!isLoggedIn) {
    return Response.redirect(new URL("/login", req.url));
  }
});

export const config = {
  // Exclude API routes (incl. /api/auth) and static assets from the gate.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
