import { z } from "zod";
import { createWorkspaceSchema, updateWorkspaceSchema } from "@vieroc/validators";

export { createWorkspaceSchema, updateWorkspaceSchema };

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
