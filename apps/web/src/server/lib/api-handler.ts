import "server-only";
import { NextResponse } from "next/server";
import { AppError } from "./errors";
import { logger } from "./logger";
import { recordRequestMetric } from "./metrics";

/**
 * Wraps a REST route handler with structured request logging + the standard
 * AppError -> {status,code} mapping every route was hand-rolling already.
 * `routeName` is the log `event` (e.g. "api.tasks.create").
 */
export function withApiLogging(
  routeName: string,
  handler: (request: Request) => Promise<Response>
) {
  return async (request: Request): Promise<Response> => {
    const start = Date.now();
    const requestId = request.headers.get("x-request-id") ?? undefined;
    try {
      const res = await handler(request);
      const latencyMs = Date.now() - start;
      logger.info(routeName, { requestId, resultCode: res.status, latencyMs });
      void recordRequestMetric(routeName, res.status, latencyMs);
      return res;
    } catch (err) {
      const latencyMs = Date.now() - start;
      if (err instanceof AppError) {
        logger.warn(routeName, { requestId, resultCode: err.code, latencyMs });
        void recordRequestMetric(routeName, err.status, latencyMs);
        return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
      }
      if (err instanceof Error) {
        logger.error(routeName, {
          requestId,
          resultCode: "error",
          latencyMs,
          message: err.message,
        });
        void recordRequestMetric(routeName, 500, latencyMs);
        return NextResponse.json({ error: err.message, code: "error" }, { status: 500 });
      }
      logger.error(routeName, { requestId, resultCode: "error", latencyMs });
      void recordRequestMetric(routeName, 500, latencyMs);
      return NextResponse.json({ error: "Unknown error", code: "error" }, { status: 500 });
    }
  };
}
