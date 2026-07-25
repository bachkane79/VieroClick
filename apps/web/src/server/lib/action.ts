import { ZodError, type ZodIssue } from "zod";
import { AppError, type ErrorDetails } from "./errors";
import { logger, getRequestId } from "./logger";
import { recordRequestMetric } from "./metrics";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: string; details?: ErrorDetails };

/**
 * Translate a Zod issue into a catalog key + ICU params.
 *
 * We map by **issue code**, never by `issue.message`: across `packages/validators`
 * and all 22 module schemas there are only 4 custom messages, so `issue.message`
 * is almost always Zod's built-in English ("String must contain at least 3
 * character(s)"). Rendering it would put English in a Vietnamese toast — the
 * exact defect this seam exists to prevent (§5.5).
 *
 * `field` is the last named path segment (array indices dropped); the client
 * looks up `errors.field.<field>` and falls back to a generic noun when the
 * field has no label, so an unlabelled field degrades to a still-correct
 * sentence rather than leaking an identifier.
 */
function zodDetails(issue: ZodIssue): ErrorDetails {
  const field = issue.path.filter((p): p is string => typeof p === "string").pop();
  const base: ErrorDetails = { zodCode: zodKey(issue), field };
  if (issue.code === "too_small" || issue.code === "too_big") {
    const limit = issue.code === "too_small" ? issue.minimum : issue.maximum;
    return { ...base, limit: typeof limit === "bigint" ? Number(limit) : limit };
  }
  return base;
}

function zodKey(issue: ZodIssue): string {
  switch (issue.code) {
    case "invalid_type":
      return issue.received === "undefined" || issue.received === "null"
        ? "required"
        : "invalidType";
    case "too_small":
      return issue.type === "string"
        ? "tooShort"
        : issue.type === "array" || issue.type === "set"
          ? "tooFew"
          : issue.type === "date"
            ? "dateTooEarly"
            : "tooSmall";
    case "too_big":
      return issue.type === "string"
        ? "tooLong"
        : issue.type === "array" || issue.type === "set"
          ? "tooMany"
          : issue.type === "date"
            ? "dateTooLate"
            : "tooBig";
    case "invalid_string":
      return typeof issue.validation === "string" &&
        ["email", "url", "uuid"].includes(issue.validation)
        ? `invalid${issue.validation.charAt(0).toUpperCase()}${issue.validation.slice(1)}`
        : "invalidFormat";
    case "invalid_enum_value":
    case "invalid_union_discriminator":
      return "invalidOption";
    case "invalid_date":
      return "invalidDate";
    case "not_multiple_of":
    case "not_finite":
      return "invalidNumber";
    default:
      // `custom`, `invalid_union`, `unrecognized_keys`, … have no user-meaningful
      // shape; the client falls through to the generic validation copy.
      return "generic";
  }
}

/**
 * Wrap a server action body so the boundary always returns a serializable
 * result instead of throwing across the RSC boundary. Every call is also
 * logged here (WP-G1) — this is the single chokepoint all server actions
 * pass through, so `label` (defaults to "action") is the only per-callsite
 * detail worth threading; add it at sensitive mutation sites over time.
 */
export async function runAction<T>(
  fn: () => Promise<T>,
  label = "action"
): Promise<ActionResult<T>> {
  const start = Date.now();
  const requestId = await getRequestId();
  try {
    const data = await fn();
    const latencyMs = Date.now() - start;
    logger.info(label, { requestId, resultCode: "ok", latencyMs });
    void recordRequestMetric(label, "ok", latencyMs);
    return { ok: true, data };
  } catch (err) {
    const latencyMs = Date.now() - start;
    if (err instanceof ZodError) {
      const issue = err.issues[0];
      logger.warn(label, { requestId, resultCode: "validation", latencyMs });
      void recordRequestMetric(label, "validation", latencyMs);
      return {
        ok: false,
        error: issue?.message ?? "Invalid input",
        code: "validation",
        details: issue ? zodDetails(issue) : undefined,
      };
    }
    if (err instanceof AppError) {
      logger.warn(label, { requestId, resultCode: err.code, latencyMs });
      void recordRequestMetric(label, err.code, latencyMs);
      return { ok: false, error: err.message, code: err.code, details: err.details };
    }
    if (err instanceof Error) {
      logger.error(label, { requestId, resultCode: "error", latencyMs, message: err.message });
      void recordRequestMetric(label, "error", latencyMs);
      return { ok: false, error: err.message, code: "error" };
    }
    logger.error(label, { requestId, resultCode: "error", latencyMs });
    void recordRequestMetric(label, "error", latencyMs);
    return { ok: false, error: "Unknown error", code: "error" };
  }
}
