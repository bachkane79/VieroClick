"use client";

import { createContext, useContext } from "react";
import type { Locale } from "./dict";

/**
 * Locale context for Client Components. The dashboard (server) layout reads
 * the cookie and feeds the provider; router.refresh() after a toggle re-renders
 * the tree with the new value — no client cookie parsing.
 */
const LocaleContext = createContext<Locale>("vi");

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}
