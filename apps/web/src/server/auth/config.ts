import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

/**
 * Edge-safe auth config: providers, pages and the `authorized` callback only.
 * No database access here so it can be imported by `middleware.ts` (edge runtime).
 * The full config in `./index.ts` extends this with DB-touching callbacks.
 */
/**
 * The passwordless dev-bypass must never exist in production: gating the
 * provider itself (not just the login form) means a hand-crafted POST to the
 * credentials callback also fails. Set ALLOW_DEV_BYPASS=true to re-enable on a
 * non-public staging build.
 */
export const devBypassEnabled =
  process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_BYPASS === "true";

const providers: any[] = [];

if (devBypassEnabled) {
  providers.push(
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "dev@example.com" },
        name: { label: "Name", type: "text", placeholder: "Developer" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        return {
          id: "",
          email: credentials.email as string,
          name: (credentials.name as string) || (credentials.email as string),
        };
      },
    })
  );
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    })
  );
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const authConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET || "default-fallback-secret-for-development-only-12345",
  trustHost: true,
  providers,
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
