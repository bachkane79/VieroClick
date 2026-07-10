import { z } from "zod";
import { taskAcceptanceCriteriaSchema, taskPrioritySchema } from "./task-core";

// ─── Agent apply payloads ─────────────────────────────────────────────────────
// Zod schemas for the LLM-produced payloads the web apply-* routes receive.
// Two variants per entity where coercion is possible:
//   - the default (lenient) schema recovers from noise the way the routes always
//     have (bad priority → "medium", bad date → null) so a mostly-good item is
//     not thrown away;
//   - the *Strict* schema has no `.catch` fallbacks. `parseItems` re-parses each
//     accepted item against it to detect that a coercion happened, so coercions
//     are counted and surfaced instead of silent.
// Structurally invalid items (no usable title, bad uuid, missing endpoints) are
// rejected per-item and reported by the route — never silently defaulted.

const nonEmpty = z.string().trim().min(1);

const isoDateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const planRefSchema = nonEmpty.max(64);

export const planEntityActionSchema = z.enum(["add", "update", "keep"]);

// ── Plan tasks ──

// Absent fields must stay `undefined` (replan updates only touch fields the LLM
// explicitly provided), so `.optional()` comes BEFORE `.catch(...)`: absent →
// undefined, present-but-invalid → coerced default.
const planTaskCommonFields = {
  planRef: planRefSchema.optional(),
  title: nonEmpty.max(500).optional(),
  wbsTitle: z.string().optional(),
  wbs: z.string().optional(),
  reason: z.string().optional(),
};

export const planTaskStrictSchema = z
  .object({
    ...planTaskCommonFields,
    description: z.string().nullish(),
    priority: taskPrioritySchema.optional(),
    startDate: isoDateString.nullish(),
    dueDate: isoDateString.nullish(),
    estimateHours: z.coerce.number().positive().nullish(),
    estimatedHours: z.coerce.number().positive().nullish(),
    acceptanceCriteria: taskAcceptanceCriteriaSchema.optional(),
    labels: z.array(nonEmpty).optional(),
    milestoneId: z.string().uuid().nullish(),
    action: planEntityActionSchema.optional(),
  })
  .passthrough();

export const planTaskSchema = z
  .object({
    ...planTaskCommonFields,
    description: z.string().nullish().catch(null),
    priority: taskPrioritySchema.optional().catch("medium"),
    startDate: isoDateString.nullish().catch(null),
    dueDate: isoDateString.nullish().catch(null),
    estimateHours: z.coerce.number().positive().nullish().catch(null),
    estimatedHours: z.coerce.number().positive().nullish().catch(null),
    acceptanceCriteria: taskAcceptanceCriteriaSchema.optional().catch([]),
    labels: z.array(nonEmpty).optional().catch([]),
    milestoneId: z.string().uuid().nullish().catch(null),
    action: planEntityActionSchema.optional().catch("add"),
  })
  .passthrough();

export type PlanTaskInput = z.infer<typeof planTaskSchema>;

// ── Plan WBS nodes ──

export const planWbsSchema = z
  .object({
    planRef: planRefSchema.optional(),
    title: nonEmpty.max(300),
    description: z.string().nullish().catch(null),
    node_type: z.string().optional(),
    nodeType: z.string().optional(),
    action: planEntityActionSchema.optional().catch("add"),
    reason: z.string().optional(),
  })
  .passthrough();

export type PlanWbsInput = z.infer<typeof planWbsSchema>;

// ── Plan milestones ──
// The milestone upsert always writes title, so title is required in both modes
// (a title-less replan entry would otherwise clobber the existing title).

const planMilestoneCommonFields = {
  planRef: planRefSchema.optional(),
  title: nonEmpty.max(300),
  status: z.string().optional(),
  action: planEntityActionSchema.optional().catch("add"),
  reason: z.string().optional(),
};

export const planMilestoneStrictSchema = z
  .object({
    ...planMilestoneCommonFields,
    description: z.string().nullish(),
    targetDate: isoDateString.nullish(),
  })
  .passthrough();

export const planMilestoneSchema = z
  .object({
    ...planMilestoneCommonFields,
    description: z.string().nullish().catch(null),
    targetDate: isoDateString.nullish().catch(null),
  })
  .passthrough();

export type PlanMilestoneInput = z.infer<typeof planMilestoneSchema>;

// ── Plan risks ──

const planRiskCommonFields = {
  planRef: planRefSchema.optional(),
  title: nonEmpty.max(300),
  action: planEntityActionSchema.optional().catch("add"),
  reason: z.string().optional(),
};

const riskScore = z.coerce.number().int().min(1).max(5);

export const planRiskStrictSchema = z
  .object({
    ...planRiskCommonFields,
    description: z.string().nullish(),
    mitigation: z.string().nullish(),
    probability: riskScore,
    impact: riskScore,
  })
  .passthrough();

// The risk upsert always writes probability/impact, so absent → 3 is the
// desired value (matches the old `Number(x) || 3` behavior), via .catch.
export const planRiskSchema = z
  .object({
    ...planRiskCommonFields,
    description: z.string().nullish().catch(null),
    mitigation: z.string().nullish().catch(null),
    probability: riskScore.catch(3),
    impact: riskScore.catch(3),
  })
  .passthrough();

export type PlanRiskInput = z.infer<typeof planRiskSchema>;

// ── Plan dependencies ──

export const planDependencySchema = z
  .object({
    blockerTaskTitle: z.string().optional(),
    blocker: z.string().optional(),
    blockedTaskTitle: z.string().optional(),
    blocked: z.string().optional(),
    blockerPlanRef: z.string().optional(),
    blockedPlanRef: z.string().optional(),
    dependencyType: z.string().catch("finish_to_start").default("finish_to_start"),
  })
  .passthrough()
  .refine(
    (d) =>
      Boolean(d.blockerPlanRef || d.blockerTaskTitle || d.blocker) &&
      Boolean(d.blockedPlanRef || d.blockedTaskTitle || d.blocked),
    { message: "Dependency needs both a blocker and a blocked endpoint" }
  );

export type PlanDependencyInput = z.infer<typeof planDependencySchema>;

// ── apply-plan request ──
// Entity arrays stay unknown[] here — items are validated individually by the
// route (parseItems) so one bad item doesn't reject the whole plan.

export const applyPlanRequestSchema = z.preprocess(
  (body) => {
    if (body && typeof body === "object") {
      const b = body as Record<string, unknown>;
      // Legacy alias: some callers send the plan under `payload`.
      if (b.plan === undefined && b.payload !== undefined) return { ...b, plan: b.payload };
    }
    return body;
  },
  z.object({
    projectId: z.string().uuid(),
    dispatchId: z.string().uuid(),
    mode: z.enum(["initial", "replan"]).default("initial"),
    plan: z
      .object({
        wbs: z.array(z.unknown()).default([]),
        tasks: z.array(z.unknown()).default([]),
        milestones: z.array(z.unknown()).default([]),
        risks: z.array(z.unknown()).default([]),
        dependencies: z.array(z.unknown()).default([]),
      })
      .passthrough(),
  })
);

export type ApplyPlanRequest = z.infer<typeof applyPlanRequestSchema>;

// ── Assignments ──
// The assignment LLM emits snake_case keys (task_id / member_id); normalize both
// spellings before validating.

export const agentAssignmentSchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const r = raw as Record<string, unknown>;
    return {
      taskId: r.taskId ?? r.task_id,
      memberId: r.memberId ?? r.member_id,
      confidence: r.confidence,
      reason: r.reason,
      risk: r.risk,
      taskTitle: r.taskTitle ?? r.task_title,
      memberName: r.memberName ?? r.member_name,
    };
  },
  z.object({
    taskId: z.string().uuid(),
    memberId: z.string().uuid(),
    confidence: z.coerce.number().min(0).max(1).nullish().catch(null),
    reason: z.string().nullish(),
    risk: z.string().nullish(),
    taskTitle: z.string().nullish(),
    memberName: z.string().nullish(),
  })
);

export type AgentAssignmentInput = z.infer<typeof agentAssignmentSchema>;

export const applyAssignmentsRequestSchema = z.preprocess(
  (body) => {
    if (body && typeof body === "object") {
      const b = body as Record<string, unknown>;
      if (b.assignments === undefined && b.payload && typeof b.payload === "object") {
        return { ...b, assignments: (b.payload as Record<string, unknown>).assignments };
      }
    }
    return body;
  },
  z.object({
    projectId: z.string().uuid(),
    dispatchId: z.string().uuid(),
    assignments: z.array(z.unknown()).min(1),
  })
);

export type ApplyAssignmentsRequest = z.infer<typeof applyAssignmentsRequestSchema>;

// ── Observer suggestions ──

export const observerActionTypeSchema = z.enum([
  "create_risk",
  "escalate_blocker",
  "trigger_replan",
  "notify_lead",
  "notify_member",
]);

export const observerSuggestionSchema = z
  .object({
    suggestion_type: z
      .enum([
        "risk_detected",
        "blocker_escalation",
        "plan_deviation",
        "clarification_needed",
        "silent_member",
        "project_hole",
      ])
      .catch("risk_detected")
      .default("risk_detected"),
    action_type: observerActionTypeSchema,
    title: nonEmpty.max(300),
    body: z.string().catch("").default(""),
    payload: z
      .object({
        affected_task_ids: z.array(z.string()).catch([]).default([]),
        affected_member_ids: z.array(z.string().uuid()).catch([]).default([]),
        blocker_id: z.string().uuid().nullish().catch(null),
        severity: z.enum(["low", "medium", "high", "urgent"]).catch("medium").default("medium"),
      })
      .passthrough()
      .catch({
        affected_task_ids: [],
        affected_member_ids: [],
        blocker_id: null,
        severity: "medium",
      })
      .default({
        affected_task_ids: [],
        affected_member_ids: [],
        blocker_id: null,
        severity: "medium",
      }),
  })
  .passthrough();

export type ObserverSuggestionInput = z.infer<typeof observerSuggestionSchema>;

export const applyObserverRequestSchema = z.object({
  projectId: z.string().uuid(),
  dispatchId: z.string().uuid(),
  suggestions: z.array(z.unknown()).default([]),
});

export type ApplyObserverRequest = z.infer<typeof applyObserverRequestSchema>;

// ── Deviations (deterministic, produced by web code — schema is a guard rail) ──

export const deviationSchema = z
  .object({
    type: z.enum(["milestone_at_risk", "task_delayed", "dependency_conflict"]),
    taskId: z.string().uuid().nullish().catch(null),
    severity: z.enum(["low", "medium", "high", "urgent"]).catch("medium").default("medium"),
    reason: z.string().catch("").default(""),
  })
  .passthrough();

export type DeviationInput = z.infer<typeof deviationSchema>;

export const applyDeviationsRequestSchema = z.object({
  projectId: z.string().uuid(),
  deviations: z.array(z.unknown()).default([]),
});

export type ApplyDeviationsRequest = z.infer<typeof applyDeviationsRequestSchema>;

// ── Project agent-autonomy settings ──

export const agentAutonomySchema = z.enum(["full_auto", "review_required"]);
export type AgentAutonomy = z.infer<typeof agentAutonomySchema>;
