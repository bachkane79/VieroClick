import "server-only";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import { createAgentJobSchema } from "./agent-job.schema";
import { assertCanRunAgentJobs } from "./agent-job.policy";
import * as repo from "./agent-job.repo";
import * as events from "./agent-job.events";

/**
 * Best-effort dispatch of a queued job to the Python agent service. Failures
 * are swallowed by the caller so a down agent service never fails the request.
 */
async function dispatchToAgentApi(job: repo.AgentJobRow): Promise<void> {
  if (!process.env.AGENT_API_URL) return;
  await fetch(`${process.env.AGENT_API_URL}/api/jobs/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Secret": process.env.AGENT_API_SECRET ?? "",
    },
    body: JSON.stringify({
      job_type: job.jobType,
      project_id: job.projectId,
      input: job.input,
      requested_by_user_id: job.requestedByUserId,
    }),
  });
}

export async function listJobs(workspaceId: string, projectId: string) {
  await requireActor(workspaceId, projectId);
  return repo.listByProject(projectId);
}

export async function getJob(workspaceId: string, projectId: string, jobId: string) {
  await requireActor(workspaceId, projectId);
  const job = await repo.findById(jobId);
  if (!job || job.projectId !== projectId) throw new NotFoundError("Agent job");
  return job;
}

export async function requestJob(p: {
  workspaceId: string;
  projectId: string;
  input: unknown;
}) {
  const data = createAgentJobSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanRunAgentJobs(ctx);

  const job = await db.transaction(async (tx) => {
    const created = await repo.create(
      {
        projectId: p.projectId,
        jobType: data.jobType,
        status: "queued",
        input: data.input,
        requestedByUserId: ctx.userId,
      },
      tx
    );

    await events.agentJobRequested(tx, ctx, created);

    return created;
  });

  // Best-effort: never fail the request if the agent service is unreachable.
  try {
    await dispatchToAgentApi(job);
  } catch {
    // swallowed intentionally
  }

  return job;
}
