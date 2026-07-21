import { z } from "zod";
import { agentJobTypeSchema } from "@vieroc/validators";

// Async job types only — these map 1:1 to agent-api's Celery task_map. Interactive
// roles (planning, assignment, observer, ...) go through the sync dispatch path
// (dispatchAgent → POST /api/agents/{role}), not this queue.
export const createAgentJobSchema = z.object({
  jobType: agentJobTypeSchema,
  input: z.record(z.unknown()).default({}),
});

export type CreateAgentJobInput = z.infer<typeof createAgentJobSchema>;
