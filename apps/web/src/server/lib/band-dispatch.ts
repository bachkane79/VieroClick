import "server-only";

type BandAgentRole =
  | "planning"
  | "assignment"
  | "observer"
  | "daily_report"
  | "morning_briefing"
  | "project_qa";

type DispatchInput = {
  targetRole: BandAgentRole;
  senderRole?: BandAgentRole;
  projectId: string;
  message: string;
  payload?: Record<string, unknown>;
};

export async function dispatchBandAgent(input: DispatchInput) {
  const baseUrl = process.env.AGENT_API_URL;
  const secret = process.env.AGENT_API_SECRET;

  if (!baseUrl || !secret) {
    console.warn("Band dispatch skipped: AGENT_API_URL or AGENT_API_SECRET is not configured");
    return { dispatched: false, skipped: true };
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/band/dispatch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Secret": secret,
    },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Band dispatch failed (${response.status}): ${text || response.statusText}`);
  }

  return response.json() as Promise<{ dispatched: boolean; message_id?: string }>;
}
