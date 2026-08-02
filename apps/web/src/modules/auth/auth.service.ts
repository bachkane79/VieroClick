import "server-only";

import bcrypt from "bcryptjs";
import { db, users } from "@vieroc/db";
import { eq } from "drizzle-orm";
import { AppError } from "@/server/lib/errors";
import { registerSchema, loginSchema, type RegisterInput, type LoginInput } from "./auth.schema";

const BCRYPT_ROUNDS = 12;

/**
 * Create an account from email + password. Throws `AppError("emailTaken")` when
 * the email already exists so the register form can surface a localized message
 * (see `errors.reason.emailTaken` in the catalogs). Registration does NOT log
 * the user in — the flow returns to /login where they sign in explicitly.
 */
export async function registerUser(input: RegisterInput): Promise<{ id: string }> {
  const { fullName, email, password } = registerSchema.parse(input);

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) {
    throw new AppError("Email already registered", "validation", 422, { reason: "emailTaken" });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const [row] = await db
    .insert(users)
    .values({ email, fullName, passwordHash })
    .returning({ id: users.id });

  if (!row) throw new AppError("Failed to create account", "error", 500);
  return { id: row.id };
}

/**
 * Does a user row still exist? The session is a stateless JWT with no DB
 * adapter, so a token can outlive its user (e.g. after the account is deleted
 * or the DB is wiped). The `session` callback calls this so a phantom session
 * degrades to anonymous — otherwise the stale token reads as "logged in" and
 * hijacks the public landing page into the app.
 */
export async function userExists(id: string): Promise<boolean> {
  if (!id) return false;
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  return !!row;
}

/**
 * Verify email + password for the NextAuth Credentials `authorize` callback.
 * Returns the identity NextAuth stamps onto the JWT, or `null` on any failure
 * (unknown email, no password set, wrong password) — NextAuth renders a generic
 * "invalid credentials" for all three, which is the desired non-enumerable UX.
 */
export async function verifyCredentials(
  raw: LoginInput
): Promise<{ id: string; email: string; name: string } | null> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { email, password } = parsed.data;

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user?.passwordHash) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;

  return { id: user.id, email: user.email, name: user.fullName };
}
