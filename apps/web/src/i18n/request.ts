import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, DEFAULT_LOCALE, isLocale } from "./locale";
import { formats } from "./formats";

/**
 * Per-request i18n config (next-intl, cookie-based — no locale in the URL).
 * Reads the `vc-locale` cookie, falls back to the default locale, and loads
 * the matching message catalog.
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieValue = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieValue) ? cookieValue : DEFAULT_LOCALE;
  const messages = (await import(`../messages/${locale}.json`)).default;
  return {
    locale,
    messages,
    // Single-region app (VN). If per-user timezones are added later, resolve here.
    timeZone: "Asia/Ho_Chi_Minh",
    formats,
  };
});
