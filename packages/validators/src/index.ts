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
      z
        .string()
        .min(1)
        .max(500)
        .transform((text) => ({
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
  milestoneId: z.string().uuid().nullable().optional(),
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

export const updateTaskSchema = createTaskSchema.partial().extend({
  // Actual hours logged (assignee or manager can set; feeds speed score + accuracy).
  actualHours: z.number().min(0).max(100000).nullable().optional(),
});

export const reviewTaskSchema = z.object({
  decision: z.enum(["approve", "rework"]),
  feedback: z.string().max(2000).optional(),
  actualHours: z.number().min(0).max(100000).nullable().optional(),
});

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

export const linkedEntitySchema = z.object({
  type: z.enum(["task", "doc", "comment"]),
  id: z.string().uuid(),
  label: z.string().max(160).optional(),
});

export const commentMetadataSchema = z
  .object({
    links: z.array(linkedEntitySchema).max(20).default([]),
  })
  .passthrough();

export const createCommentSchema = z.object({
  body: z.string().min(1),
  // Threaded reply target (null/omitted = top-level comment).
  parentCommentId: z.string().uuid().nullable().optional(),
  metadata: commentMetadataSchema.default({ links: [] }),
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

// ─── Agent jobs, roles & suggestions ───────────────────────────────────────────
// Single source of truth for the agent enums shared between web and agent-api.
// The DB columns (agent_jobs.job_type, agent_suggestions.suggestion_type) are plain
// text; these schemas are what web validates against, and their literal sets must
// stay in sync with the Python side (see the notes on each).

// Async job types dispatched to agent-api's Celery queue via POST /api/jobs/.
// MUST match the task_map keys in apps/agent-api/app/api/routes/jobs.py.
export const agentJobTypeSchema = z.enum([
  "daily_report",
  "task_assignment",
  "risk_scan",
  "qa",
]);

// Interactive agent roles dispatched synchronously via POST /api/agents/{role}.
// MUST match AGENT_RUNNERS in apps/agent-api/app/agents/roles/__init__.py.
export const agentRoleSchema = z.enum([
  "planning",
  "assignment",
  "observer",
  "daily_report",
  "morning_briefing",
  "project_qa",
]);

// suggestion_type values persisted on agent_suggestions. Produced by the web
// apply-* routes (planning_package / assignment_suggestion / risk_scan) and by
// the observer + Q&A roles (the rest).
export const agentSuggestionTypeSchema = z.enum([
  "planning_package",
  "assignment_suggestion",
  "risk_scan",
  "risk_detected",
  "blocker_escalation",
  "plan_deviation",
  "clarification_needed",
  "silent_member",
  "project_hole",
]);

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
export type AgentJobType = z.infer<typeof agentJobTypeSchema>;
export type AgentRole = z.infer<typeof agentRoleSchema>;
export type AgentSuggestionType = z.infer<typeof agentSuggestionTypeSchema>;
