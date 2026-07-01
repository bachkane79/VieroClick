import "server-only";

type AgentRole =
  | "planning"
  | "assignment"
  | "observer"
  | "daily_report"
  | "morning_briefing"
  | "project_qa";

type DispatchInput = {
  targetRole: AgentRole;
  senderRole?: AgentRole;
  projectId: string;
  message: string;
  payload?: Record<string, unknown>;
};

/**
 * Dispatch an interactive job to the agent-api service (FastAPI, default :8000).
 *
 * agent-api is the single agent process — we POST to `/api/agents/{role}` and get
 * the structured result back synchronously. (The former band-agents :8001 service
 * has been removed; automated rhythms run via agent-api's Celery Beat.)
 */
export async function dispatchAgent(input: DispatchInput) {
  const baseUrl = process.env.AGENT_API_URL || "http://localhost:8000";
  const secret = process.env.AGENT_API_SECRET || "";

  const url = `${baseUrl.replace(/\/$/, "")}/api/agents/${input.targetRole}`;

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
      }),
      cache: "no-store",
    });
  } catch (err) {
    // Service unreachable — don't fail the underlying mutation that triggered it.
    console.warn(
      `Agent dispatch skipped: agent-api unreachable at ${url} (${
        err instanceof Error ? err.message : String(err)
      })`
    );
    return { dispatched: false, skipped: true };
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Agent dispatch failed (${response.status}): ${text || response.statusText}`);
  }

  return response.json() as Promise<{ dispatched: boolean; role?: string; result?: unknown }>;
}
