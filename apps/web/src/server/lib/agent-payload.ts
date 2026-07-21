import "server-only";
import type { z } from "zod";

export type RejectedItem = {
  index: number;
  raw: unknown;
  issues: string[];
};

export type ParsedItems<T> = {
  valid: T[];
  rejected: RejectedItem[];
  /** Items that only passed because a lenient `.catch` fallback recovered a bad
   * field (bad enum → default, bad date → null). Counted so coercions surface
   * in the apply summary instead of happening silently. */
  coerced: number;
};

type ParseItemsOptions<T> = {
  /** No-`.catch` variant of the schema; an item passing the lenient schema but
   * failing this one was coerced. */
  strictSchema?: z.ZodTypeAny;
  /** Extra semantic check run after parsing; return an error message to reject
   * the item (e.g. mode-dependent title requirements). */
  validate?: (item: T) => string | null;
};

/**
 * Validate a batch of LLM-produced items one by one: salvage what parses,
 * reject (and report) what doesn't, and count lenient coercions.
 */
export function parseItems<S extends z.ZodTypeAny>(
  items: unknown[],
  schema: S,
  opts?: ParseItemsOptions<z.output<S>>
): ParsedItems<z.output<S>> {
  type T = z.output<S>;
  const valid: T[] = [];
  const rejected: RejectedItem[] = [];
  let coerced = 0;

  items.forEach((raw, index) => {
    const result = schema.safeParse(raw);
    if (!result.success) {
      rejected.push({
        index,
        raw,
        issues: result.error.issues.map((issue) =>
          issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message
        ),
      });
      return;
    }

    const semanticError = opts?.validate?.(result.data) ?? null;
    if (semanticError) {
      rejected.push({ index, raw, issues: [semanticError] });
      return;
    }

    if (opts?.strictSchema && !opts.strictSchema.safeParse(raw).success) {
      coerced++;
    }
    valid.push(result.data);
  });

  return { valid, rejected, coerced };
}
