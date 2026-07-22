import { z } from "zod";
import {
  acceptanceCriterionSchema,
  taskAcceptanceCriteriaSchema,
  taskPrioritySchema,
} from "./task-core";
import { agentAutonomySchema } from "./agent-payloads";

/** Normalize user-authored text before validation and persistence.
 * NFC keeps Vietnamese diacritics byte-stable across forms, search and views.
 * Exported (WP-C4) so module-local schemas share the exact same normalization
 * instead of re-declaring their own.
 */
export const nfc = (value: unknown) => (typeof value === "string" ? value.normalize("NFC") : value);
export const nfcText = (schema: z.ZodString) => z.preprocess(nfc, schema);

// WP-C4 length caps — every free-text field gets a max so a single request can't
// carry an unbounded payload. Tiers: SHORT ≈ titles, LONG ≈ descriptions/notes,
// HUGE ≈ document bodies, TAG ≈ individual array items (labels/skills/goals).
export const TEXT_LIMITS = { SHORT: 300, LONG: 10_000, HUGE: 50_000, TAG: 500, TZ: 100 } as const;
const shortText = () => nfcText(z.string().trim().min(1).max(TEXT_LIMITS.SHORT));
const longText = () => nfcText(z.string().trim().max(TEXT_LIMITS.LONG));
const tagText = () => nfcText(z.string().trim().min(1).max(TEXT_LIMITS.TAG));

export * from "./task-core";
export * from "./agent-payloads";

// ─── Workspace ───────────────────────────────────────────────────────────────

export const workspaceKindSchema = z.enum(["personal", "team"]);

export const createWorkspaceSchema = z.object({
  name: nfcText(z.string().trim().min(1).max(100)),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  kind: workspaceKindSchema.default("personal"),
});

export const updateWorkspaceSchema = createWorkspaceSchema.partial();

// ─── Onboarding ───────────────────────────────────────────────────────────────
// The first-run wizard: mode (personal/team) + a starter template (or the AI
// path) + a name, optionally inviting teammates. One action creates the
// workspace, its first project, seeds the template tasks and marks onboarding
// done. Template ids mirror modules/onboarding/templates.ts.
export const onboardingTemplateSchema = z.enum([
  "personal-planning",
  "study",
  "freelance-client",
  "small-team-project",
  "blank",
  "ai-generated",
]);

export const completeOnboardingSchema = z.object({
  mode: workspaceKindSchema,
  template: onboardingTemplateSchema,
  workspaceName: nfcText(z.string().trim().min(1).max(100)),
  projectName: nfcText(z.string().trim().min(1).max(200)),
  // AI path only: the free-text project description the planner works from.
  aiPrompt: nfcText(z.string().max(2000)).optional(),
  // Team mode only: emails to invite (optional, skippable).
  invites: z.array(z.string().email()).max(50).default([]),
});

// ─── Project ──────────────────────────────────────────────────────────────────

export const projectStatusSchema = z.enum(["draft", "active", "paused", "completed", "archived"]);

export const createProjectSchema = z.object({
  name: nfcText(z.string().trim().min(1).max(200)),
  description: longText().optional(),
  scope: longText().optional(),
  status: projectStatusSchema.default("draft"),
  leadMemberId: z.string().uuid().optional(),
  startDate: z.string().date().optional(),
  targetEndDate: z.string().date().optional(),
  goals: z.array(tagText()).max(100).default([]),
  constraints: z.array(tagText()).max(100).default([]),
  expectedDeliverables: z.array(tagText()).max(100).default([]),
  memberIds: z.array(z.string().uuid()).default([]),
  initialContext: nfcText(z.string().trim().max(20_000)).optional(),
  // AI Leader master switch chosen at creation. When false, the project is
  // created for manual work and no planning agent is dispatched.
  aiEnabled: z.boolean().default(true),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  agentAutonomy: agentAutonomySchema.optional(),
  agentConfidenceThreshold: z.number().min(0).max(1).optional(),
  aiEnabled: z.boolean().optional(),
  // WP-D3: optimistic-concurrency token. When provided, the update is rejected
  // with a 409 conflict if it no longer matches the row's current version.
  version: z.number().int().min(1).optional(),
});

// ─── Task ─────────────────────────────────────────────────────────────────────
// taskPrioritySchema / acceptanceCriterionSchema / taskAcceptanceCriteriaSchema
// live in ./task-core (shared with ./agent-payloads) and are re-exported above.

export const createTaskSchema = z.object({
  title: nfcText(z.string().trim().min(1).max(500)),
  description: longText().optional(),
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
  labels: z.array(nfcText(z.string().trim().min(1).max(100))).max(50).default([]),
  position: z.number().int().min(0).default(0),
  isMilestone: z.boolean().default(false),
  blockerReason: nfcText(z.string().trim().max(2000)).optional(),
  allowBlockedOverride: z.boolean().default(false),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  // Actual hours logged (assignee or manager can set; feeds speed score + accuracy).
  actualHours: z.number().min(0).max(100000).nullable().optional(),
  // WP-D3: optimistic-concurrency token. When provided, the update is rejected
  // with a 409 conflict if it no longer matches the row's current version.
  // Optional because updateTask() is also called internally (assignTask,
  // changeTaskStatus, moveTask) without a version to check.
  version: z.number().int().min(1).optional(),
});

export const reviewTaskSchema = z.object({
  decision: z.enum(["approve", "rework"]),
  feedback: nfcText(z.string().max(2000)).optional(),
  actualHours: z.number().min(0).max(100000).nullable().optional(),
});

export const moveTaskSchema = z.object({
  statusId: z.string().uuid(),
  position: z.number().int().min(0),
  blockerReason: nfcText(z.string().trim().max(2000)).optional(),
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
  name: nfcText(z.string().trim().min(1).max(100)),
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
    // Assigned comment (ClickUp-style): the member who must act on/resolve it.
    assignedMemberId: z.string().uuid().nullable().optional(),
    resolved: z.boolean().optional(),
  })
  .passthrough();

export const createCommentSchema = z.object({
  body: nfcText(z.string().trim().min(1).max(TEXT_LIMITS.LONG)),
  // Threaded reply target (null/omitted = top-level comment).
  parentCommentId: z.string().uuid().nullable().optional(),
  metadata: commentMetadataSchema.default({ links: [] }),
});

// ─── Daily Update ─────────────────────────────────────────────────────────────

export const createDailyUpdateSchema = z.object({
  workDate: z.string().date(),
  completedText: longText().optional(),
  inProgressText: longText().optional(),
  blockersText: longText().optional(),
  confidenceLevel: z.number().int().min(1).max(5).optional(),
  supportNeeded: longText().optional(),
  concerns: longText().optional(),
});

// ─── Blocker ──────────────────────────────────────────────────────────────────

export const blockerStatusSchema = z.enum(["open", "in_review", "resolved", "ignored"]);

export const createBlockerSchema = z.object({
  title: shortText(),
  description: longText().optional(),
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
  title: shortText(),
  type: projectDocTypeSchema.default("other"),
  content: nfcText(z.string().trim().min(1).max(TEXT_LIMITS.HUGE)),
});

export const updateProjectDocSchema = createProjectDocSchema.partial();

// ─── Decision Log ─────────────────────────────────────────────────────────────

export const createDecisionLogSchema = z.object({
  title: shortText(),
  decision: nfcText(z.string().trim().min(1).max(TEXT_LIMITS.LONG)),
  reason: longText().optional(),
  decidedByMemberId: z.string().uuid().optional(),
  affectedTaskIds: z.array(z.string().uuid()).default([]),
});

// ─── Risk ─────────────────────────────────────────────────────────────────────

export const createRiskSchema = z.object({
  title: shortText(),
  description: longText().optional(),
  probability: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  ownerMemberId: z.string().uuid().optional(),
  mitigation: longText().optional(),
  escalationPath: nfcText(z.string().trim().max(5000)).optional(),
});

// ─── Member Profile ───────────────────────────────────────────────────────────

export const updateMemberProfileSchema = z.object({
  skills: z.array(nfcText(z.string().trim().min(1).max(100))).max(100).optional(),
  seniorityLevel: z.number().int().min(1).max(10).optional(),
  availabilityHoursPerWeek: z.number().min(0).max(168).optional(),
  timezone: z.string().trim().max(TEXT_LIMITS.TZ).optional(),
  profileNotes: longText().optional(),
});

// ─── Agent jobs, roles & suggestions ───────────────────────────────────────────
// Single source of truth for the agent enums shared between web and agent-api.
// The DB columns (agent_jobs.job_type, agent_suggestions.suggestion_type) are plain
// text; these schemas are what web validates against, and their literal sets must
// stay in sync with the Python side (see the notes on each).

// Async job types dispatched to agent-api's Celery queue via POST /api/jobs/.
// MUST match the task_map keys in apps/agent-api/app/api/routes/jobs.py.
export const agentJobTypeSchema = z.enum(["daily_report", "task_assignment", "risk_scan", "qa"]);

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

// ─── Cursor pagination (WP-D1) ────────────────────────────────────────────────
// Keyset pagination input, shared by every paginated list endpoint. `cursor` is
// an opaque string produced by the previous page's `nextCursor` (see
// apps/web/src/server/lib/cursor.ts) — NOT the offset-based `paginationSchema`
// below, which is unused dead code and the wrong pattern for large lists.

export const cursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Pagination ───────────────────────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type WorkspaceKind = z.infer<typeof workspaceKindSchema>;
export type OnboardingTemplate = z.infer<typeof onboardingTemplateSchema>;
export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;
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
export type CursorQueryInput = z.infer<typeof cursorQuerySchema>;
export type AgentJobType = z.infer<typeof agentJobTypeSchema>;
export type AgentRole = z.infer<typeof agentRoleSchema>;
export type AgentSuggestionType = z.infer<typeof agentSuggestionTypeSchema>;
