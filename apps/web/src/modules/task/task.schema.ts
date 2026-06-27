import { z } from "zod";
import { createTaskSchema, updateTaskSchema, moveTaskSchema } from "@vieroc/validators";

export { createTaskSchema, updateTaskSchema, moveTaskSchema };

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
