import { z } from "zod";
import { createProjectSchema, updateProjectSchema } from "@vieroc/validators";

export { createProjectSchema, updateProjectSchema };

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
