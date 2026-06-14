import { z } from "zod";
import { createTaskStatusSchema } from "@vieroc/validators";

export { createTaskStatusSchema };

export const updateTaskStatusSchema = createTaskStatusSchema.partial();

export type CreateTaskStatusInput = z.infer<typeof createTaskStatusSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
