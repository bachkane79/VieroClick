import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";

interface AgentJobLike {
  id: string;
  jobType: string;
}

export function agentJobRequested(exec: Executor, ctx: ActorContext, job: AgentJobLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "agent_job",
    entityId: job.id,
    eventType: "agent.job_requested",
    after: { jobType: job.jobType },
  });
}
