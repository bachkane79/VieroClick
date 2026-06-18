import { z } from "zod";
import { createProjectDocSchema } from "@vieroc/validators";

export { createProjectDocSchema };
export const updateProjectDocSchema = createProjectDocSchema.partial();
export type CreateProjectDocInput = z.infer<typeof createProjectDocSchema>;
export type UpdateProjectDocInput = z.infer<typeof updateProjectDocSchema>;
