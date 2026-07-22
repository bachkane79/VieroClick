import { z } from "zod";
import { createWorkspaceSchema, updateWorkspaceSchema } from "@vieroc/validators";

export { createWorkspaceSchema, updateWorkspaceSchema };

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

export const workspaceRoleSchema = z.enum(["owner", "admin", "leader", "member", "viewer", "guest"]);

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: workspaceRoleSchema,
});

// WP-C2: runtime guards for member-management args that arrive from server
// actions typed-only (WorkspaceRole/string) — enforce the §4.3 parse contract.
export const memberIdSchema = z.string().uuid();

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

