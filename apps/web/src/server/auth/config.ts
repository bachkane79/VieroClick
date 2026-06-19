import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

/**
 * Edge-safe auth config: providers, pages and the `authorized` callback only.
 * No database access here so it can be imported by `middleware.ts` (edge runtime).
 * The full config in `./index.ts` extends this with DB-touching callbacks.
 */
export const authConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      name: "Developer Bypass",
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
    }),
  ],
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
