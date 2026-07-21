import { z } from "zod";

export const permissionLevelSchema = z.enum(["view", "comment", "edit", "full"]);
export const resourceTypeSchema = z.enum(["project", "task", "doc"]);
export const subjectTypeSchema = z.enum(["member", "team"]);

export const shareGrantSchema = z.object({
  resourceType: resourceTypeSchema,
  resourceId: z.string().uuid(),
  subjectType: subjectTypeSchema,
  subjectId: z.string().uuid(),
  level: permissionLevelSchema,
});

export const revokeGrantSchema = shareGrantSchema.pick({
  resourceType: true,
  resourceId: true,
  subjectType: true,
  subjectId: true,
});

export const createTeamSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const teamMemberSchema = z.object({
  teamId: z.string().uuid(),
  workspaceMemberId: z.string().uuid(),
});

export type ShareGrantInput = z.infer<typeof shareGrantSchema>;
export type RevokeGrantInput = z.infer<typeof revokeGrantSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type TeamMemberInput = z.infer<typeof teamMemberSchema>;
