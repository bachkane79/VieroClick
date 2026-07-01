import { z } from "zod";
import { createTaskSchema, updateTaskSchema, moveTaskSchema, reviewTaskSchema } from "@vieroc/validators";

export { createTaskSchema, updateTaskSchema, moveTaskSchema, reviewTaskSchema };

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
export type ReviewTaskInput = z.infer<typeof reviewTaskSchema>;
