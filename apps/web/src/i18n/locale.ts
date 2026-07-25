/**
 * Locale primitives for the web app (i18n foundation, next-intl).
 * `vi` is the default/primary market language; `en` is fully supported.
 * The cookie name is preserved from the previous home-rolled system so
 * existing users keep their stored preference.
 */
export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "vi";
export const LOCALE_COOKIE = "vc-locale";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}
