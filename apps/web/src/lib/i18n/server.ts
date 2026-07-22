import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "./dict";

/** Resolve the UI locale for the current request: cookie first, vi default. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const v = store.get(LOCALE_COOKIE)?.value;
  return v === "en" ? "en" : "vi";
}
