"use client";

import { useTranslations } from "next-intl";
import type { ActionResult } from "@/server/lib/action";

/** The failed branch of `runAction()`'s result — type-only, erased at build. */
type ActionFailure = Extract<ActionResult<unknown>, { ok: false }>;

/**
 * Every lookup here is dynamic — the key is built from a runtime `code` /
 * `reason` / `zodCode` — so the generated key union buys nothing and naming it
 * at module scope trips `TS2590` (1400+ keys is too complex to represent).
 * We narrow the *translator* instead of the key: existence is still checked
 * with `t.has`, so a missing key degrades to the next fallback rather than
 * throwing.
 */
type LooseTranslator = (key: string, values?: Record<string, string | number>) => string;

/**
 * Localize a server-action error for display in a toast.
 *
 * `runAction()` returns `{ ok:false, code, error, details }`. `code` is one of
 * the seven stable `AppError` codes and stays low-cardinality because it also
 * feeds `logger` and `recordRequestMetric`; the *specific* reason rides in
 * `details` instead. Resolution runs most-specific-first:
 *
 *   1. `details.reason`            → `errors.reason.<reason>`   (semantic condition)
 *   2. `not_found` + `details.entity` → `errors.notFound` with a glossary noun
 *   3. `validation` + `details.zodCode` → `errors.zod.<code>` with field + limit
 *   4. `errors.code.<code>`        (the seven generics)
 *   5. the caller's localized `fallback`, else `errors.code.error`
 *
 * `res.error` is the server's raw **English** `AppError.message` and is never
 * rendered — surfacing it would put English in a Vietnamese toast, which is the
 * whole reason this seam exists. Steps 2 and 3 degrade safely: an entity or
 * field with no catalog label falls back to a generic noun, so the sentence
 * stays grammatical instead of leaking an identifier.
 *
 * Usage (client component):
 *   const actionError = useActionError();
 *   if (!res.ok) toast.error(actionError(res, t("telegram.connectFailed")));
 */
export function useActionError() {
  const t = useTranslations();
  const has = (key: string) => t.has(key as Parameters<typeof t.has>[0]);
  const tx = t as unknown as LooseTranslator;
  const pick = (key: string): string | null => (has(key) ? tx(key) : null);

  return (res: ActionFailure, fallback?: string): string => {
    const code = res.code ?? "error";
    const details = res.details ?? {};

    if (typeof details.reason === "string") {
      const reason = pick(`errors.reason.${details.reason}`);
      if (reason) return reason;
    }

    if (code === "not_found" && typeof details.entity === "string") {
      const entity = pick(`errors.entity.${details.entity}`) ?? tx("errors.entity.fallback");
      return tx("errors.notFound", { entity });
    }

    if (code === "validation" && typeof details.zodCode === "string") {
      const key = `errors.zod.${details.zodCode}`;
      if (has(key)) {
        const field =
          (typeof details.field === "string" && pick(`errors.field.${details.field}`)) ||
          tx("errors.field.fallback");
        return tx(key, {
          field,
          limit: typeof details.limit === "number" ? details.limit : 0,
        });
      }
    }

    if (code === "error" && fallback) return fallback;

    const generic = pick(`errors.code.${code}`);
    if (generic) return generic;

    return fallback ?? tx("errors.code.error");
  };
}
