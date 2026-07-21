import "server-only";
import { db, deadLetter } from "@vieroc/db";

export type DeadLetterInput = {
  /** Origin of the failure, e.g. "celery:generate_daily_report" or "apply-plan". */
  source: string;
  jobType?: string | null;
  projectId?: string | null;
  payload?: Record<string, unknown>;
  error: string;
  retryCount?: number;
};

/**
 * Record a terminally-failed piece of agent work to the dead_letter log.
 *
 * Best-effort: this must never throw, so it can be called from a catch block
 * without masking the original error. Failures to record are logged and swallowed.
 */
export async function recordDeadLetter(input: DeadLetterInput): Promise<void> {
  try {
    await db.insert(deadLetter).values({
      source: input.source,
      jobType: input.jobType ?? null,
      projectId: input.projectId ?? null,
      payload: input.payload ?? {},
      error: input.error.slice(0, 8000),
      retryCount: input.retryCount ?? 0,
    });
  } catch (err) {
    console.error("Failed to record dead-letter entry:", err);
  }
}
