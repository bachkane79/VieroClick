import "server-only";
import { headers } from "next/headers";

type LogFields = Record<string, unknown>;

function emit(level: "info" | "warn" | "error", event: string, fields?: LogFields) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, fields?: LogFields) => emit("error", event, fields),
};

/**
 * Reads the `x-request-id` stamped by middleware.ts. Only works inside a
 * request scope (Server Actions, Route Handlers via next/headers) — returns
 * undefined outside one instead of throwing, since not every caller runs in
 * that scope.
 */
export async function getRequestId(): Promise<string | undefined> {
  try {
    const h = await headers();
    return h.get("x-request-id") ?? undefined;
  } catch {
    return undefined;
  }
}
