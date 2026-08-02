import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./config";
import { verifyCredentials } from "@/modules/auth/auth.service";

/**
 * Full (Node-runtime) auth instance. The only provider is email + password.
 * Its `authorize` runs the DB lookup + bcrypt compare — Node-only work that
 * must not leak into the edge middleware, which is why the provider lives here
 * and `./config.ts` (imported by middleware) keeps an empty provider list.
 *
 * Sessions are JWT (no DB adapter), so our `users` table is the source of truth.
 * `authorize` already resolves the real internal user id, so the `jwt` callback
 * only needs to carry it onto the token.
 */
const authResult = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        return verifyCredentials({
          email: String(credentials?.email ?? ""),
          password: String(credentials?.password ?? ""),
        });
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      // On sign-in, `user` is the object returned by `authorize` (id is our
      // internal users.id). Persist it so subsequent requests carry the id.
      if (user?.id) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string;
      return session;
    },
  },
});

export const handlers = authResult.handlers;
export const auth = authResult.auth;
export const signIn = authResult.signIn as (...args: any[]) => Promise<any>;
export const signOut = authResult.signOut as (...args: any[]) => Promise<any>;
