import { ZodError } from "zod";
import { AppError } from "./errors";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: string; details?: unknown };

/**
 * Wrap a server action body so the boundary always returns a serializable
 * result instead of throwing across the RSC boundary.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof ZodError) {
      return { ok: false, error: err.issues[0]?.message ?? "Invalid input", code: "validation" };
    }
    if (err instanceof AppError) {
      return { ok: false, error: err.message, code: err.code, details: err.details };
    }
    if (err instanceof Error) {
      return { ok: false, error: err.message, code: "error" };
    }
    return { ok: false, error: "Unknown error", code: "error" };
  }
}
