import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config: secret, pages and the `authorized` callback only.
 * No database access here so it can be imported by `middleware.ts` (edge runtime).
 *
 * Providers are intentionally empty in this edge config: the only sign-in method
 * is email + password, whose `authorize` needs the DB and bcrypt (both Node-only),
 * so the Credentials provider is defined in `./index.ts` (the full Node instance).
 * Middleware never runs `authorize` — it only decodes the JWT session — so an
 * empty provider list here is correct and keeps the edge bundle DB-free.
 */

// WP-C1: fail fast instead of silently falling back to a hardcoded secret. A
// missing AUTH_SECRET previously fell back to a public string committed to the
// repo — anyone who read the source could forge a valid session JWT for any
// user. This module is imported by middleware.ts (edge runtime), so the throw
// below happens at cold start, before any request is served.
const AUTH_SECRET = process.env.AUTH_SECRET;
if (!AUTH_SECRET) {
  throw new Error(
    "AUTH_SECRET is required. Set it in your env (see .env.local) before starting the app."
  );
}

export const authConfig: NextAuthConfig = {
  secret: AUTH_SECRET,
  trustHost: true,
  providers: [],
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    authorized() {
      return true;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
};
