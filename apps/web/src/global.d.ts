import type viMessages from "./messages/vi.json";
import type { formats } from "./i18n/formats";

/**
 * Type-safe next-intl: `vi.json` is the structural source of truth, so every
 * `t("…")` key autocompletes and a typo fails `tsc`. `en.json` must keep the
 * same key shape (enforced in the Phase 6 QA sweep).
 */
declare module "next-intl" {
  interface AppConfig {
    Messages: typeof viMessages;
    Locale: "vi" | "en";
    Formats: typeof formats;
  }
}
