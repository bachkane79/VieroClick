import NextAuth from "next-auth";
import { db, users } from "@vieroc/db";
import { authConfig } from "./config";

const authResult = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    /**
     * On initial sign-in, upsert the OAuth profile into our own `users` table
     * (mapping name → full_name, picture → avatar_url) and stamp our internal
     * user id onto the JWT. We do not use a database session adapter, so this
     * keeps the design's `users` schema as the source of truth without needing
     * Auth.js's accounts/sessions tables.
     */
    async jwt({ token, profile, account, user }) {
      if (account && account.provider === "credentials" && user?.email) {
        const email = user.email;
        const fullName = user.name ?? email;
        const avatarUrl = null;

        const [row] = await db
          .insert(users)
          .values({ email, fullName, avatarUrl })
          .onConflictDoUpdate({
            target: users.email,
            set: { fullName, updatedAt: new Date() },
          })
          .returning({ id: users.id });

        if (row) token.userId = row.id;
      } else if (account && profile?.email) {
        const email = profile.email;
        const fullName = (profile.name as string | undefined) ?? email;
        const avatarUrl =
          (profile.picture as string | undefined) ??
          (profile.avatar_url as string | undefined) ??
          null;

        const [row] = await db
          .insert(users)
          .values({ email, fullName, avatarUrl })
          .onConflictDoUpdate({
            target: users.email,
            set: { fullName, avatarUrl, updatedAt: new Date() },
          })
          .returning({ id: users.id });

        if (row) token.userId = row.id;
      }
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
