import { z } from "zod";

export const createTaskDependencySchema = z.object({
  blockerTaskId: z.string().uuid(),
  blockedTaskId: z.string().uuid(),
  dependencyType: z.string().default("finish_to_start"),
});

export type CreateTaskDependencyInput = z.infer<typeof createTaskDependencySchema>;
