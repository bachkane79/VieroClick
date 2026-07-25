import { z } from "zod";

/** Whitelist of eventTypes an automation may bind to — keeps trigger_type from
 * silently referencing a typo'd event that will never fire (see plan §schema). */
export const AUTOMATION_TRIGGER_TYPES = [
  "task.created",
  "task.updated",
  "task.status_changed",
  "task.assigned",
  "task.deleted",
  "task.restored",
  "task.submitted_for_review",
  "task.approved",
  "task.rework_requested",
  "task.comment_added",
  "task.dependency_added",
  "task.dependency_removed",
  // "plan.deviation" — tạm thời bỏ (không đưa vào whitelist), xem lý do ở CLAUDE.md/báo cáo.
  "blocker.created",
  "blocker.updated",
  "blocker.resolved",
  "risk.created",
  "risk.updated",
  "milestone.created",
  "milestone.updated",
  "daily_update.submitted",
  // "decision.created" — tạm thời bỏ (không đưa vào whitelist), xem lý do ở CLAUDE.md/báo cáo.
] as const;

/** Group A = DB-only (run inside the actions transaction, rollback-safe).
 *  Group B = external I/O (run after Group A commits, idempotent + dead-letter). */
export const AUTOMATION_ACTION_TYPES = [
  "update_status",
  "update_priority",
  "update_assignee",
  "create_risk",
  "escalate_blocker",
  "notify_lead",
  "notify_member",
  "trigger_replan",
] as const;

export const GROUP_A_ACTION_TYPES: ReadonlySet<string> = new Set([
  "update_status",
  "update_priority",
  "update_assignee",
  "create_risk",
  "escalate_blocker",
]);

const conditionSchema = z.object({
  field: z.string().min(1),
  op: z.enum(["eq", "neq", "in", "gt", "lt", "contains"]),
  value: z.unknown(),
});

const actionSchema = z.object({
  type: z.enum(AUTOMATION_ACTION_TYPES),
  params: z.record(z.unknown()).default({}),
});

export const createAutomationSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  // null = applies workspace-wide; omitted = scoped to the project it's created in.
  projectId: z.string().uuid().nullable().optional(),
  // null/omitted = matches any entity; set = pinned to one specific task (or
  // other entity) — e.g. "only when THIS task's status changes".
  targetEntityId: z.string().uuid().nullable().optional(),
  triggerType: z.enum(AUTOMATION_TRIGGER_TYPES),
  // Hard caps per Phase 1 decision — mirrors ClickUp's own structural limits.
  conditions: z.array(conditionSchema).max(15).default([]),
  actions: z.array(actionSchema).min(1).max(6),
  isActive: z.boolean().default(true),
});

export const updateAutomationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  targetEntityId: z.string().uuid().nullable().optional(),
  conditions: z.array(conditionSchema).max(15).optional(),
  actions: z.array(actionSchema).min(1).max(6).optional(),
  isActive: z.boolean().optional(),
});

export type CreateAutomationInput = z.infer<typeof createAutomationSchema>;
export type UpdateAutomationInput = z.infer<typeof updateAutomationSchema>;
export type AutomationConditionInput = z.infer<typeof conditionSchema>;
export type AutomationActionInput = z.infer<typeof actionSchema>;

// Trigger and action display labels are NOT held here — they live in the
// message catalog (`automations.trigger.*` / `automations.action.*`) and are
// resolved through `automation.labels.ts#automationLabel`, which camelizes the
// dotted/snake_case code into a catalog leaf.

// ─── Guided-form metadata (client-safe — no server-only imports) ────────────
// Drives the action/condition editors so users pick from real project data
// (statuses, members, blockers) instead of typing raw JSON/field paths.

export type ActionFieldType =
  | "select-status"
  | "select-priority"
  | "select-member"
  | "select-blocker"
  | "text"
  | "textarea"
  | "number";

export type ActionFieldSpec = {
  key: string;
  /** Catalog leaf under `automations.field` — resolved at render time. */
  labelKey: string;
  type: ActionFieldType;
  required?: boolean;
};

export const ACTION_FIELD_SPECS: Record<string, ActionFieldSpec[]> = {
  update_status: [
    { key: "statusId", labelKey: "newStatus", type: "select-status", required: true },
  ],
  update_priority: [
    { key: "priority", labelKey: "priority", type: "select-priority", required: true },
  ],
  update_assignee: [
    { key: "memberId", labelKey: "assignTo", type: "select-member", required: true },
  ],
  create_risk: [
    { key: "title", labelKey: "riskTitle", type: "text", required: true },
    { key: "description", labelKey: "description", type: "textarea" },
    { key: "probability", labelKey: "probability", type: "number" },
    { key: "impact", labelKey: "impact", type: "number" },
  ],
  escalate_blocker: [
    { key: "blockerId", labelKey: "blocker", type: "select-blocker", required: true },
  ],
  notify_lead: [
    { key: "title", labelKey: "notificationTitle", type: "text", required: true },
    { key: "body", labelKey: "notificationBody", type: "textarea" },
  ],
  notify_member: [
    { key: "memberId", labelKey: "recipient", type: "select-member", required: true },
    { key: "title", labelKey: "notificationTitle", type: "text", required: true },
    { key: "body", labelKey: "notificationBody", type: "textarea" },
  ],
  trigger_replan: [{ key: "reason", labelKey: "replanReason", type: "textarea" }],
};

/** Action types that need one specific project's data (a statusId/blockerId
 * that only makes sense within one project) — hidden on the workspace-wide
 * automations page, which can fire on tasks from any project. */
export const PROJECT_ONLY_ACTION_TYPES: ReadonlySet<string> = new Set([
  "update_status",
  "escalate_blocker",
]);

export type ConditionValueKind = "status-type" | "priority" | "member" | "blocker-status";

export const TASK_STATUS_TYPES = [
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
] as const;

export const BLOCKER_STATUS_TYPES = ["open", "in_review", "resolved", "ignored"] as const;

/** Only the most common/useful triggers get a guided condition-field picker —
 * others fall back to the free-text field input (no regression, just not
 * upgraded yet). */
export const CONDITION_FIELDS_BY_TRIGGER: Record<
  string,
  { field: string; labelKey: string; valueKind: ConditionValueKind }[]
> = {
  "task.status_changed": [
    { field: "after.statusType", labelKey: "newStatus", valueKind: "status-type" },
    { field: "before.statusType", labelKey: "previousStatus", valueKind: "status-type" },
  ],
  "task.assigned": [
    { field: "after.assigneeMemberId", labelKey: "assignee", valueKind: "member" },
  ],
  "task.updated": [{ field: "after.priority", labelKey: "priority", valueKind: "priority" }],
  "blocker.updated": [
    { field: "after.status", labelKey: "blockerStatus", valueKind: "blocker-status" },
  ],
  "blocker.resolved": [
    { field: "after.status", labelKey: "blockerStatus", valueKind: "blocker-status" },
  ],
};
