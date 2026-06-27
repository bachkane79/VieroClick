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
 * Dispatch a job to the local agent service (FastAPI, default :8001).
 *
 * Band.ai has been removed — agents now communicate over plain local HTTP I/O.
 * We POST directly to `/agents/{role}` and get the structured result back.
 * The legacy name is kept so existing call sites don't need to change.
 */
export async function dispatchBandAgent(input: DispatchInput) {
  const baseUrl = process.env.AGENT_SERVICE_URL || "http://localhost:8001";
  const secret = process.env.AGENT_SERVICE_SECRET || process.env.AGENT_API_SECRET || "";

  const url = `${baseUrl.replace(/\/$/, "")}/agents/${input.targetRole}`;

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
      `Agent dispatch skipped: local agent service unreachable at ${url} (${
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
