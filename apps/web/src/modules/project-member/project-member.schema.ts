import { z } from "zod";

export const projectRoleSchema = z.enum([
  "project_lead",
  "tech_lead",
  "member",
  "reviewer",
  "stakeholder",
]);

export const addProjectMemberSchema = z.object({
  workspaceMemberId: z.string().uuid(),
  role: projectRoleSchema.default("member"),
  allocationPercent: z.number().int().min(0).max(100).default(100),
});

export const updateProjectMemberSchema = z.object({
  role: projectRoleSchema.optional(),
  allocationPercent: z.number().int().min(0).max(100).optional(),
});

export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;
export type UpdateProjectMemberInput = z.infer<typeof updateProjectMemberSchema>;
