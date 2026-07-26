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

export type AutomationTriggerType = (typeof AUTOMATION_TRIGGER_TYPES)[number];

/** Group A = DB-only (run inside the actions transaction, rollback-safe).
 *  Group B = external I/O (run after Group A commits, idempotent + dead-letter). */
export const AUTOMATION_ACTION_TYPES = [
  "update_status",
  "update_priority",
  "update_assignee",
  "update_task_title",
  "update_start_date",
  "update_due_date",
  "create_task",
  "delete_task",
  "add_dependency",
  "remove_dependency",
  "add_comment",
  "create_risk",
  "escalate_blocker",
  "reassign_blocker_owner",
  "update_risk_status",
  "reassign_risk_owner",
  "update_milestone_status",
  "update_milestone_date",
  "notify_lead",
  "notify_member",
  "send_channel_message",
  "trigger_replan",
] as const;

export type AutomationActionType = (typeof AUTOMATION_ACTION_TYPES)[number];

export const GROUP_A_ACTION_TYPES: ReadonlySet<string> = new Set([
  "update_status",
  "update_priority",
  "update_assignee",
  "update_task_title",
  "update_start_date",
  "update_due_date",
  "create_task",
  "delete_task",
  "add_dependency",
  "remove_dependency",
  "add_comment",
  "create_risk",
  "escalate_blocker",
  "reassign_blocker_owner",
  "update_risk_status",
  "reassign_risk_owner",
  "update_milestone_status",
  "update_milestone_date",
]);

export const AUTOMATION_CONDITION_OPS = [
  "eq",
  "neq",
  "in",
  "gt",
  "lt",
  "contains",
  "before_date",
  "after_date",
  "within_days",
] as const;

const conditionSchema = z.object({
  field: z.string().min(1),
  op: z.enum(AUTOMATION_CONDITION_OPS),
  value: z.unknown(),
});

const actionSchema = z.object({
  type: z.enum(AUTOMATION_ACTION_TYPES),
  params: z.record(z.unknown()).default({}),
});

/** Server-side enforcement (UI dropdown filtering is UX only, not security):
 * every condition.field must be whitelisted for this triggerType, every
 * action.type must be whitelisted for this triggerType. Prevents e.g. a
 * `risk.created` condition field being submitted against a `task.created`
 * automation. Exported so automation.service.ts#updateAutomation can run it
 * against the automation's existing (immutable) triggerType — updates never
 * change the trigger, so it isn't part of updateAutomationSchema's shape. */
export function assertTriggerScoping(
  triggerType: string,
  conditions: { field: string }[],
  actions: { type: string }[]
): void {
  const allowedFields = new Set(
    (CONDITION_FIELDS_BY_TRIGGER[triggerType] ?? []).map((f) => f.field)
  );
  const badField = conditions.find((c) => !allowedFields.has(c.field));
  if (badField) {
    throw new Error(`Field "${badField.field}" không hợp lệ với trigger "${triggerType}"`);
  }

  const allowedActions = new Set<string>(ACTION_TYPES_BY_TRIGGER[triggerType] ?? []);
  const badAction = actions.find((a) => !allowedActions.has(a.type));
  if (badAction) {
    throw new Error(`Action "${badAction.type}" không hợp lệ với trigger "${triggerType}"`);
  }
}

export const createAutomationSchema = z
  .object({
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
  })
  .superRefine((data, ctx) => {
    try {
      assertTriggerScoping(data.triggerType, data.conditions, data.actions);
    } catch (e) {
      ctx.addIssue({ code: "custom", message: e instanceof Error ? e.message : String(e) });
    }
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
// (statuses, members, blockers, tasks) instead of typing raw JSON/field paths.

export type ActionFieldType =
  | "select-status"
  | "select-priority"
  | "select-member"
  | "select-blocker"
  | "select-task"
  | "select-risk"
  | "select-milestone"
  | "select-chat-target"
  | "date"
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
  update_status: [{ key: "statusId", labelKey: "newStatus", type: "select-status", required: true }],
  update_priority: [{ key: "priority", labelKey: "priority", type: "select-priority", required: true }],
  update_assignee: [{ key: "memberId", labelKey: "assignTo", type: "select-member", required: true }],
  update_task_title: [{ key: "title", labelKey: "newTaskTitle", type: "text", required: true }],
  update_start_date: [{ key: "startDate", labelKey: "startDate", type: "date", required: true }],
  update_due_date: [{ key: "dueDate", labelKey: "dueDate", type: "date", required: true }],
  create_task: [
    { key: "title", labelKey: "newTaskTitle", type: "text", required: true },
    { key: "priority", labelKey: "priority", type: "select-priority" },
    { key: "assigneeMemberId", labelKey: "assignTo", type: "select-member" },
    { key: "dueDate", labelKey: "dueDate", type: "date" },
  ],
  delete_task: [{ key: "taskId", labelKey: "taskToDelete", type: "select-task" }],
  add_dependency: [
    { key: "blockerTaskId", labelKey: "blockerTask", type: "select-task", required: true },
    { key: "dependencyType", labelKey: "dependencyType", type: "text" },
  ],
  remove_dependency: [{ key: "dependencyId", labelKey: "dependencyId", type: "text", required: true }],
  add_comment: [{ key: "body", labelKey: "commentText", type: "textarea", required: true }],
  create_risk: [
    { key: "title", labelKey: "riskTitle", type: "text", required: true },
    { key: "description", labelKey: "description", type: "textarea" },
    { key: "probability", labelKey: "probability", type: "number" },
    { key: "impact", labelKey: "impact", type: "number" },
  ],
  escalate_blocker: [{ key: "blockerId", labelKey: "blocker", type: "select-blocker", required: true }],
  reassign_blocker_owner: [
    { key: "blockerId", labelKey: "blocker", type: "select-blocker", required: true },
    { key: "memberId", labelKey: "newOwner", type: "select-member", required: true },
  ],
  update_risk_status: [
    { key: "riskId", labelKey: "riskId", type: "select-risk", required: true },
    { key: "status", labelKey: "newRiskStatus", type: "text", required: true },
  ],
  reassign_risk_owner: [
    { key: "riskId", labelKey: "riskId", type: "select-risk", required: true },
    { key: "memberId", labelKey: "newOwner", type: "select-member", required: true },
  ],
  update_milestone_status: [
    { key: "milestoneId", labelKey: "milestoneId", type: "select-milestone", required: true },
    { key: "status", labelKey: "newMilestoneStatus", type: "text", required: true },
  ],
  update_milestone_date: [
    { key: "milestoneId", labelKey: "milestoneId", type: "select-milestone", required: true },
    { key: "targetDate", labelKey: "newTargetDate", type: "date", required: true },
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
  send_channel_message: [
    { key: "target", labelKey: "chatTarget", type: "select-chat-target", required: true },
    { key: "title", labelKey: "notificationTitle", type: "text", required: true },
    { key: "body", labelKey: "notificationBody", type: "textarea" },
  ],
  trigger_replan: [{ key: "reason", labelKey: "replanReason", type: "textarea" }],
};

/** Action types that need one specific project's data (a statusId/blockerId/
 * taskId/riskId/milestoneId that only makes sense within one project) —
 * hidden on the workspace-wide automations page, which can fire on entities
 * from any project. */
export const PROJECT_ONLY_ACTION_TYPES: ReadonlySet<string> = new Set([
  "update_status",
  "escalate_blocker",
  "delete_task",
  "add_dependency",
  "remove_dependency",
  "reassign_blocker_owner",
  "update_risk_status",
  "reassign_risk_owner",
  "update_milestone_status",
  "update_milestone_date",
]);

export type ConditionValueKind =
  | "status-type"
  | "priority"
  | "member"
  | "blocker-status"
  | "project-role"
  | "date"
  | "number"
  | "boolean";

export const TASK_STATUS_TYPES = [
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
] as const;

export const BLOCKER_STATUS_TYPES = ["open", "in_review", "resolved", "ignored"] as const;

export const PROJECT_ROLE_TYPES = [
  "project_lead",
  "tech_lead",
  "member",
  "reviewer",
  "stakeholder",
] as const;

export type ConditionFieldSpec = {
  field: string;
  /** Catalog leaf under `automations.field` — resolved at render time. */
  labelKey: string;
  /** Omitted = free-text value input (no guided picker yet — still whitelisted
   * for this trigger, just not upgraded to a picker). */
  valueKind?: ConditionValueKind;
};

/** Whitelist of condition fields per trigger — doubles as the UI dropdown
 * source AND the server-side enforcement list (see assertTriggerScoping
 * above). Every trigger below now has an entry; see
 * docs_local/automation-trigger-condition-action-catalog.md for the source
 * catalog this was built from. */
export const CONDITION_FIELDS_BY_TRIGGER: Record<string, ConditionFieldSpec[]> = {
  "task.created": [
    { field: "after.priority", labelKey: "priority", valueKind: "priority" },
    { field: "after.assigneeMemberId", labelKey: "assignee", valueKind: "member" },
    { field: "after.reporterMemberId", labelKey: "reporter", valueKind: "member" },
    { field: "after.dueDate", labelKey: "dueDate", valueKind: "date" },
    { field: "after.startDate", labelKey: "startDate", valueKind: "date" },
    { field: "after.isMilestone", labelKey: "isMilestone", valueKind: "boolean" },
    { field: "after.milestoneId", labelKey: "milestoneId" },
    { field: "after.labels", labelKey: "taskLabels" },
  ],
  "task.updated": [
    { field: "after.assigneeMemberId", labelKey: "assignee", valueKind: "member" },
    { field: "after.reporterMemberId", labelKey: "reporter", valueKind: "member" },
    { field: "after.priority", labelKey: "priority", valueKind: "priority" },
    { field: "after.dueDate", labelKey: "dueDate", valueKind: "date" },
    { field: "after.startDate", labelKey: "startDate", valueKind: "date" },
    { field: "after.labels", labelKey: "taskLabels" },
    { field: "after.milestoneId", labelKey: "milestoneId" },
  ],
  "task.status_changed": [
    { field: "after.statusType", labelKey: "newStatus", valueKind: "status-type" },
    { field: "before.statusType", labelKey: "previousStatus", valueKind: "status-type" },
    { field: "after.assigneeMemberId", labelKey: "assignee", valueKind: "member" },
    { field: "after.priority", labelKey: "priority", valueKind: "priority" },
    { field: "after.dueDate", labelKey: "dueDate", valueKind: "date" },
  ],
  "task.assigned": [
    { field: "after.assigneeMemberId", labelKey: "assignee", valueKind: "member" },
    { field: "before.assigneeMemberId", labelKey: "previousAssignee", valueKind: "member" },
    { field: "after.priority", labelKey: "priority", valueKind: "priority" },
    { field: "after.dueDate", labelKey: "dueDate", valueKind: "date" },
    { field: "after.assigneeProjectRole", labelKey: "assigneeRole", valueKind: "project-role" },
  ],
  "task.deleted": [
    { field: "before.priority", labelKey: "priority", valueKind: "priority" },
    { field: "before.assigneeMemberId", labelKey: "assignee", valueKind: "member" },
    { field: "before.isMilestone", labelKey: "isMilestone", valueKind: "boolean" },
  ],
  "task.restored": [
    { field: "after.priority", labelKey: "priority", valueKind: "priority" },
    { field: "after.assigneeMemberId", labelKey: "assignee", valueKind: "member" },
  ],
  "task.submitted_for_review": [
    { field: "after.assigneeMemberId", labelKey: "assignee", valueKind: "member" },
    { field: "after.priority", labelKey: "priority", valueKind: "priority" },
    { field: "after.reworkCount", labelKey: "reworkCount", valueKind: "number" },
  ],
  "task.approved": [
    { field: "after.assigneeMemberId", labelKey: "assignee", valueKind: "member" },
    { field: "after.priority", labelKey: "priority", valueKind: "priority" },
    { field: "after.milestoneId", labelKey: "milestoneId" },
  ],
  "task.rework_requested": [
    { field: "after.assigneeMemberId", labelKey: "assignee", valueKind: "member" },
    { field: "after.reworkCount", labelKey: "reworkCount", valueKind: "number" },
    { field: "after.priority", labelKey: "priority", valueKind: "priority" },
  ],
  "task.comment_added": [
    { field: "after.body", labelKey: "commentBody" },
    { field: "after.authorMemberId", labelKey: "commentAuthor", valueKind: "member" },
  ],
  "task.dependency_added": [
    { field: "after.dependencyType", labelKey: "dependencyType" },
    { field: "after.blockerStatusType", labelKey: "blockerTaskStatus", valueKind: "status-type" },
  ],
  "task.dependency_removed": [
    { field: "after.dependencyType", labelKey: "dependencyType" },
    { field: "after.blockerStatusType", labelKey: "blockerTaskStatus", valueKind: "status-type" },
  ],
  "blocker.created": [
    { field: "after.severity", labelKey: "severity", valueKind: "priority" },
    { field: "after.ownerMemberId", labelKey: "owner", valueKind: "member" },
  ],
  "blocker.updated": [
    { field: "after.status", labelKey: "blockerStatus", valueKind: "blocker-status" },
    { field: "after.severity", labelKey: "severity", valueKind: "priority" },
    { field: "after.ownerMemberId", labelKey: "owner", valueKind: "member" },
  ],
  "blocker.resolved": [
    { field: "after.status", labelKey: "blockerStatus", valueKind: "blocker-status" },
    { field: "after.resolvedByMemberId", labelKey: "resolvedBy", valueKind: "member" },
  ],
  "risk.created": [
    { field: "after.probability", labelKey: "probability", valueKind: "number" },
    { field: "after.impact", labelKey: "impact", valueKind: "number" },
    { field: "after.ownerMemberId", labelKey: "owner", valueKind: "member" },
  ],
  "risk.updated": [
    { field: "after.status", labelKey: "riskStatus" },
    { field: "after.probability", labelKey: "probability", valueKind: "number" },
    { field: "after.impact", labelKey: "impact", valueKind: "number" },
  ],
  "milestone.created": [
    { field: "after.targetDate", labelKey: "targetDate", valueKind: "date" },
    { field: "after.status", labelKey: "milestoneStatus" },
  ],
  "milestone.updated": [
    { field: "after.targetDate", labelKey: "targetDate", valueKind: "date" },
    { field: "before.status", labelKey: "milestoneStatus" },
    { field: "after.status", labelKey: "milestoneStatus" },
  ],
  "daily_update.submitted": [
    { field: "after.confidenceLevel", labelKey: "confidenceLevel", valueKind: "number" },
    { field: "after.completedText", labelKey: "completedText" },
    { field: "after.blockersText", labelKey: "dailyUpdateBlockers" },
    { field: "after.memberId", labelKey: "member", valueKind: "member" },
  ],
};

/** Whitelist of action types per trigger — same dual purpose as
 * CONDITION_FIELDS_BY_TRIGGER (UI dropdown + server enforcement). */
export const ACTION_TYPES_BY_TRIGGER: Record<string, AutomationActionType[]> = {
  "task.created": [
    "update_assignee",
    "update_priority",
    "update_status",
    "update_task_title",
    "update_start_date",
    "update_due_date",
    "add_dependency",
    "remove_dependency",
    "add_comment",
    "create_risk",
    "create_task",
    "delete_task",
    "notify_lead",
    "notify_member",
    "send_channel_message",
    "trigger_replan",
  ],
  "task.updated": [
    "update_assignee",
    "update_priority",
    "update_status",
    "update_task_title",
    "update_start_date",
    "update_due_date",
    "add_dependency",
    "remove_dependency",
    "add_comment",
    "create_risk",
    "create_task",
    "delete_task",
    "notify_lead",
    "notify_member",
    "send_channel_message",
    "trigger_replan",
  ],
  "task.status_changed": [
    "update_assignee",
    "update_priority",
    "create_risk",
    "escalate_blocker",
    "update_task_title",
    "update_start_date",
    "update_due_date",
    "add_dependency",
    "remove_dependency",
    "add_comment",
    "notify_lead",
    "notify_member",
    "send_channel_message",
    "trigger_replan",
  ],
  "task.assigned": [
    "notify_member",
    "notify_lead",
    "send_channel_message",
    "update_priority",
    "update_status",
    "add_comment",
  ],
  "task.deleted": ["notify_lead", "send_channel_message", "add_dependency", "remove_dependency", "create_risk"],
  "task.restored": ["notify_lead", "notify_member", "update_status", "update_assignee"],
  "task.submitted_for_review": ["notify_lead", "send_channel_message", "update_status"],
  "task.approved": ["update_status", "notify_member", "notify_lead", "send_channel_message", "trigger_replan"],
  "task.rework_requested": ["notify_lead", "notify_member", "send_channel_message", "create_risk", "update_priority"],
  "task.comment_added": ["notify_lead", "notify_member", "send_channel_message", "update_status"],
  "task.dependency_added": ["update_status", "notify_lead", "notify_member", "send_channel_message", "create_risk"],
  "task.dependency_removed": ["update_status", "notify_lead", "notify_member", "send_channel_message"],
  "blocker.created": ["notify_lead", "notify_member", "send_channel_message", "escalate_blocker", "create_risk"],
  "blocker.updated": [
    "escalate_blocker",
    "reassign_blocker_owner",
    "notify_lead",
    "notify_member",
    "send_channel_message",
  ],
  "blocker.resolved": ["notify_lead", "send_channel_message", "update_status"],
  "risk.created": ["notify_lead", "notify_member", "send_channel_message", "update_risk_status", "reassign_risk_owner"],
  "risk.updated": [
    "update_risk_status",
    "reassign_risk_owner",
    "notify_lead",
    "notify_member",
    "send_channel_message",
  ],
  "milestone.created": ["notify_lead", "send_channel_message", "create_task"],
  "milestone.updated": [
    "update_milestone_status",
    "update_milestone_date",
    "notify_lead",
    "send_channel_message",
    "trigger_replan",
  ],
  "daily_update.submitted": ["notify_lead", "send_channel_message", "create_risk"],
};
