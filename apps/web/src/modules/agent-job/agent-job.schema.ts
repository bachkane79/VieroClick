import { z } from "zod";

export const createAgentJobSchema = z.object({
  jobType: z.enum(["daily_report", "task_assignment", "risk_scan", "qa", "planning"]),
  input: z.record(z.unknown()).default({}),
});

export type CreateAgentJobInput = z.infer<typeof createAgentJobSchema>;
