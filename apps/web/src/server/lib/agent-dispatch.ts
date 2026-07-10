import "server-only";
import { agentJobs, db, type Executor } from "@vieroc/db";
import { and, eq } from "drizzle-orm";

type AgentRole =
  | "planning"
  | "assignment"
  | "observer"
  | "daily_report"
  | "morning_briefing"
  | "project_qa";

/**
 * Roles whose run calls back into a web `apply-*` route. Each such dispatch
 * mints a single-use `agent_jobs` record (the "dispatch record") whose id the
 * callback must present — the apply route validates and consumes it, so holding
 * the shared AGENT_API_SECRET alone is no longer enough to mutate a project.
 */
const CALLBACK_JOB_TYPES: Partial<Record<AgentRole, string>> = {
  planning: "planning_package",
  assignment: "assignment_suggestion",
  observer: "risk_scan",
};

/** A dispatch record older than this can no longer be consumed. */
export const DISPATCH_TTL_MS = 30 * 60 * 1000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DispatchInput = {
  targetRole: AgentRole;
  senderRole?: AgentRole;
  projectId: string;
  message: string;
  payload?: Record<string, unknown>;
  /**
   * User on whose behalf this dispatch runs (stamped as requestedByUserId on the
   * dispatch record). Omit / null for system-initiated runs (cron, chained
   * dispatches with no originating user).
   */
  actorUserId?: string | null;
};

/** Thrown when an apply route receives a missing/expired/mismatched dispatchId. */
export class DispatchRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DispatchRejectedError";
  }
}

/**
 * Dispatch an interactive job to the agent-api service (FastAPI, default :8000).
 *
 * agent-api is the single agent process — we POST to `/api/agents/{role}` and get
 * the structured result back synchronously. For callback roles (planning,
 * assignment, observer) a dispatch record is created first and its id travels
 * with the request; the apply-* callback consumes it. If the role finishes
 * without reaching its callback (LLM failure, nothing to apply), the record is
 * closed here so it can't leak in `running` state or be replayed later.
 */
export async function dispatchAgent(input: DispatchInput) {
  const baseUrl = process.env.AGENT_API_URL || "http://localhost:8000";
  const secret = process.env.AGENT_API_SECRET || "";

  const url = `${baseUrl.replace(/\/$/, "")}/api/agents/${input.targetRole}`;

  const jobType = CALLBACK_JOB_TYPES[input.targetRole];
  let dispatchId: string | undefined;
  if (jobType) {
    const [job] = await db
      .insert(agentJobs)
      .values({
        projectId: input.projectId,
        jobType,
        status: "running",
        input: {
          message: input.message,
          senderRole: input.senderRole ?? null,
          ...(input.payload ?? {}),
        },
        requestedByUserId: input.actorUserId ?? null,
        startedAt: new Date(),
      })
      .returning({ id: agentJobs.id });
    dispatchId = job?.id;
  }

  const closeDispatch = async (patch: {
    status: "succeeded" | "failed";
    output?: Record<string, unknown>;
    error?: string;
  }) => {
    if (!dispatchId) return;
    try {
      await db
        .update(agentJobs)
        .set({
          status: patch.status,
          output: patch.output,
          error: patch.error?.slice(0, 8000),
          finishedAt: new Date(),
        })
        .where(and(eq(agentJobs.id, dispatchId), eq(agentJobs.status, "running")));
    } catch (err) {
      console.error("Failed to close dispatch record:", err);
    }
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "X-Api-Secret": secret } : {}),
      },
      body: JSON.stringify({
        projectId: input.projectId,
        message: input.message,
        payload: input.payload ?? {},
        senderRole: input.senderRole,
        targetRole: input.targetRole,
        dispatchId,
      }),
      cache: "no-store",
    });
  } catch (err) {
    // Service unreachable — don't fail the underlying mutation that triggered it.
    const reason = err instanceof Error ? err.message : String(err);
    await closeDispatch({ status: "failed", error: `agent-api unreachable: ${reason}` });
    console.warn(`Agent dispatch skipped: agent-api unreachable at ${url} (${reason})`);
    return { dispatched: false, skipped: true };
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    await closeDispatch({
      status: "failed",
      error: `Agent dispatch failed (${response.status}): ${text || response.statusText}`,
    });
    throw new Error(`Agent dispatch failed (${response.status}): ${text || response.statusText}`);
  }

  const data = (await response.json()) as {
    dispatched: boolean;
    role?: string;
    result?: Record<string, unknown>;
  };

  const result = data.result;
  if (dispatchId && result && typeof result === "object") {
    if (result.ok === false) {
      await closeDispatch({
        status: "failed",
        error: typeof result.error === "string" ? result.error : "Agent run failed before apply",
      });
    } else {
      // No-op if the apply callback already consumed the record; otherwise the
      // role finished without applying anything (e.g. "all tasks assigned").
      await closeDispatch({ status: "succeeded", output: { closedBy: "dispatch", ...result } });
    }
  }

  return data;
}

export type ValidatedDispatch = {
  id: string;
  requestedByUserId: string | null;
};

/**
 * Validate the dispatch record an apply-* callback presented. Throws
 * DispatchRejectedError (→ respond 403) unless the record exists, is still
 * `running`, targets this project with the expected job type, and is within TTL.
 */
export async function validateDispatch(
  dispatchId: string,
  projectId: string,
  expectedJobTypes: string[]
): Promise<ValidatedDispatch> {
  if (!UUID_RE.test(dispatchId)) {
    throw new DispatchRejectedError("Invalid dispatchId");
  }

  const [row] = await db
    .select({
      id: agentJobs.id,
      projectId: agentJobs.projectId,
      jobType: agentJobs.jobType,
      status: agentJobs.status,
      requestedByUserId: agentJobs.requestedByUserId,
      startedAt: agentJobs.startedAt,
    })
    .from(agentJobs)
    .where(eq(agentJobs.id, dispatchId))
    .limit(1);

  if (!row) throw new DispatchRejectedError("Unknown dispatchId");
  if (row.status !== "running") {
    throw new DispatchRejectedError(`Dispatch already ${row.status} (single-use)`);
  }
  if (row.projectId !== projectId) {
    throw new DispatchRejectedError("Dispatch was issued for a different project");
  }
  if (!expectedJobTypes.includes(row.jobType)) {
    throw new DispatchRejectedError(`Dispatch job type mismatch (${row.jobType})`);
  }
  if (!row.startedAt || Date.now() - row.startedAt.getTime() > DISPATCH_TTL_MS) {
    throw new DispatchRejectedError("Dispatch expired");
  }

  return { id: row.id, requestedByUserId: row.requestedByUserId };
}

/**
 * Consume a dispatch record inside the same transaction as the mutation it
 * authorizes. The `status = running` guard makes consumption atomic and
 * single-use: a concurrent or replayed consume finds no row and throws.
 */
export async function consumeDispatch(
  exec: Executor,
  dispatchId: string,
  patch: {
    status: "succeeded" | "failed";
    output?: Record<string, unknown>;
    error?: string;
  }
): Promise<void> {
  const rows = await exec
    .update(agentJobs)
    .set({
      status: patch.status,
      output: patch.output,
      error: patch.error?.slice(0, 8000),
      finishedAt: new Date(),
    })
    .where(and(eq(agentJobs.id, dispatchId), eq(agentJobs.status, "running")))
    .returning({ id: agentJobs.id });

  if (rows.length === 0) {
    throw new DispatchRejectedError("Dispatch already consumed (single-use)");
  }
}

/**
 * Best-effort: mark a dispatch record failed from an apply route's error path.
 * Never throws.
 */
export async function failDispatch(dispatchId: string | null, error: string): Promise<void> {
  if (!dispatchId || !UUID_RE.test(dispatchId)) return;
  try {
    await db
      .update(agentJobs)
      .set({ status: "failed", error: error.slice(0, 8000), finishedAt: new Date() })
      .where(and(eq(agentJobs.id, dispatchId), eq(agentJobs.status, "running")));
  } catch (err) {
    console.error("Failed to mark dispatch record failed:", err);
  }
}
