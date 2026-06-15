import { z } from "zod";

// ─── Workspace ───────────────────────────────────────────────────────────────

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
});

export const updateWorkspaceSchema = createWorkspaceSchema.partial();

// ─── Project ──────────────────────────────────────────────────────────────────

export const projectStatusSchema = z.enum(["draft", "active", "paused", "completed", "archived"]);

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  scope: z.string().optional(),
  status: projectStatusSchema.default("draft"),
  leadMemberId: z.string().uuid().optional(),
  startDate: z.string().date().optional(),
  targetEndDate: z.string().date().optional(),
  goals: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  expectedDeliverables: z.array(z.string()).default([]),
  memberIds: z.array(z.string().uuid()).default([]),
  initialContext: z.string().optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

// ─── Task ─────────────────────────────────────────────────────────────────────

export const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

export const acceptanceCriterionSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1).max(500),
  required: z.boolean().default(true),
  checked: z.boolean().default(false),
});

export const taskAcceptanceCriteriaSchema = z
  .array(
    z.union([
      acceptanceCriterionSchema,
      z.string().min(1).max(500).transform((text) => ({
        text,
        required: true,
        checked: false,
      })),
    ])
  )
  .default([]);

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  statusId: z.string().uuid(),
  priority: taskPrioritySchema.default("medium"),
  assigneeMemberId: z.string().uuid().nullable().optional(),
  reporterMemberId: z.string().uuid().nullable().optional(),
  parentTaskId: z.string().uuid().nullable().optional(),
  startDate: z.string().date().optional(),
  dueDate: z.string().date().optional(),
  estimateHours: z.number().min(0).optional(),
  acceptanceCriteria: taskAcceptanceCriteriaSchema,
  labels: z.array(z.string()).default([]),
  position: z.number().int().min(0).default(0),
  isMilestone: z.boolean().default(false),
  blockerReason: z.string().optional(),
  allowBlockedOverride: z.boolean().default(false),
});

export const updateTaskSchema = createTaskSchema.partial();

export const moveTaskSchema = z.object({
  statusId: z.string().uuid(),
  position: z.number().int().min(0),
  blockerReason: z.string().optional(),
  allowBlockedOverride: z.boolean().default(false),
});

// ─── Task Status ──────────────────────────────────────────────────────────────

export const taskStatusTypeSchema = z.enum([
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
]);

export const createTaskStatusSchema = z.object({
  name: z.string().min(1).max(100),
  type: taskStatusTypeSchema,
  position: z.number().int().min(0).default(0),
  isDefault: z.boolean().default(false),
});

// ─── Task Comment ─────────────────────────────────────────────────────────────

export const createCommentSchema = z.object({
  body: z.string().min(1),
  metadata: z.record(z.unknown()).default({}),
});

// ─── Daily Update ─────────────────────────────────────────────────────────────

export const createDailyUpdateSchema = z.object({
  workDate: z.string().date(),
  completedText: z.string().optional(),
  inProgressText: z.string().optional(),
  blockersText: z.string().optional(),
  confidenceLevel: z.number().int().min(1).max(5).optional(),
  supportNeeded: z.string().optional(),
  concerns: z.string().optional(),
});

// ─── Blocker ──────────────────────────────────────────────────────────────────

export const blockerStatusSchema = z.enum(["open", "in_review", "resolved", "ignored"]);

export const createBlockerSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().optional(),
  taskId: z.string().uuid().optional(),
  severity: taskPrioritySchema.default("medium"),
  ownerMemberId: z.string().uuid().optional(),
});

export const updateBlockerSchema = z.object({
  status: blockerStatusSchema.optional(),
  ownerMemberId: z.string().uuid().optional(),
  resolvedByMemberId: z.string().uuid().optional(),
});

// ─── Project Doc ──────────────────────────────────────────────────────────────

export const projectDocTypeSchema = z.enum([
  "requirement",
  "technical_note",
  "decision",
  "meeting_note",
  "scope",
  "other",
]);

export const createProjectDocSchema = z.object({
  title: z.string().min(1).max(300),
  type: projectDocTypeSchema.default("other"),
  content: z.string().min(1),
});

export const updateProjectDocSchema = createProjectDocSchema.partial();

// ─── Decision Log ─────────────────────────────────────────────────────────────

export const createDecisionLogSchema = z.object({
  title: z.string().min(1).max(300),
  decision: z.string().min(1),
  reason: z.string().optional(),
  decidedByMemberId: z.string().uuid().optional(),
  affectedTaskIds: z.array(z.string().uuid()).default([]),
});

// ─── Risk ─────────────────────────────────────────────────────────────────────

export const createRiskSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().optional(),
  probability: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  ownerMemberId: z.string().uuid().optional(),
  mitigation: z.string().optional(),
  escalationPath: z.string().optional(),
});

// ─── Member Profile ───────────────────────────────────────────────────────────

export const updateMemberProfileSchema = z.object({
  skills: z.array(z.string()).optional(),
  seniorityLevel: z.number().int().min(1).max(10).optional(),
  availabilityHoursPerWeek: z.number().min(0).max(168).optional(),
  timezone: z.string().optional(),
  profileNotes: z.string().optional(),
});

// ─── Pagination ───────────────────────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type AcceptanceCriterionInput = z.infer<typeof acceptanceCriterionSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateDailyUpdateInput = z.infer<typeof createDailyUpdateSchema>;
export type CreateBlockerInput = z.infer<typeof createBlockerSchema>;
export type CreateProjectDocInput = z.infer<typeof createProjectDocSchema>;
export type CreateDecisionLogInput = z.infer<typeof createDecisionLogSchema>;
export type CreateRiskInput = z.infer<typeof createRiskSchema>;
export type UpdateMemberProfileInput = z.infer<typeof updateMemberProfileSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
