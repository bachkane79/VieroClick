"use server";

import { runAction } from "@/server/lib/action";
import { registerUser } from "./auth.service";
import { registerSchema } from "./auth.schema";

/**
 * Register a new account (email + password). Thin `"use server"` wrapper — the
 * service holds the logic. On success the client redirects to /login; we do not
 * auto-sign-in so the sign-in step stays explicit (per product flow).
 */
export async function registerAction(input: unknown) {
  return runAction(async () => {
    const parsed = registerSchema.parse(input);
    return registerUser(parsed);
  }, "auth.register");
}
