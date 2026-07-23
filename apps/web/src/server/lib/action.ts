import { ZodError } from "zod";
import { AppError } from "./errors";
import { logger, getRequestId } from "./logger";
import { recordRequestMetric } from "./metrics";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: string; details?: unknown };

/**
 * Wrap a server action body so the boundary always returns a serializable
 * result instead of throwing across the RSC boundary. Every call is also
 * logged here (WP-G1) — this is the single chokepoint all server actions
 * pass through, so `label` (defaults to "action") is the only per-callsite
 * detail worth threading; add it at sensitive mutation sites over time.
 */
export async function runAction<T>(fn: () => Promise<T>, label = "action"): Promise<ActionResult<T>> {
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
      logger.warn(label, { requestId, resultCode: "validation", latencyMs });
      void recordRequestMetric(label, "validation", latencyMs);
      return { ok: false, error: err.issues[0]?.message ?? "Invalid input", code: "validation" };
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
