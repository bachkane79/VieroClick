"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "./locale";
import { getUserId } from "@/server/lib/context";
import { updateUserDetails } from "@/modules/workspace/workspace.repo";

/**
 * Switch the UI language: cookie is the request-time source of truth
 * (next-intl reads it in `request.ts`); `users.locale` is persisted
 * best-effort so the preference follows the account across devices.
 */
export async function setLocaleAction(locale: Locale) {
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  try {
    const userId = await getUserId();
    await updateUserDetails(userId, { locale });
  } catch {
    // Signed-out surfaces (login) still get the cookie.
  }
  return { ok: true as const };
}
