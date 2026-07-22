import { z } from "zod";
import { createWorkspaceSchema, updateWorkspaceSchema } from "@vieroc/validators";

export { createWorkspaceSchema, updateWorkspaceSchema };

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "admin", "leader", "member", "viewer", "guest"]),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

