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

export const AUTOMATION_TRIGGER_LABELS: Record<string, string> = {
  "task.created": "Task được tạo",
  "task.updated": "Task được cập nhật",
  "task.status_changed": "Trạng thái task đổi",
  "task.assigned": "Task được giao",
  "task.deleted": "Task bị xoá",
  "task.restored": "Task được khôi phục",
  "task.submitted_for_review": "Task gửi duyệt",
  "task.approved": "Task được duyệt",
  "task.rework_requested": "Task bị yêu cầu sửa lại",
  "task.comment_added": "Có bình luận mới trên task",
  "task.dependency_added": "Thêm phụ thuộc task",
  "task.dependency_removed": "Gỡ phụ thuộc task",
  "blocker.created": "Blocker được tạo",
  "blocker.updated": "Blocker được cập nhật",
  "blocker.resolved": "Blocker được giải quyết",
  "risk.created": "Rủi ro được tạo",
  "risk.updated": "Rủi ro được cập nhật",
  "milestone.created": "Milestone được tạo",
  "milestone.updated": "Milestone được cập nhật",
  "daily_update.submitted": "Daily update được gửi",
};

export const AUTOMATION_ACTION_LABELS: Record<string, string> = {
  update_status: "Đổi trạng thái",
  update_priority: "Đổi mức ưu tiên",
  update_assignee: "Đổi người phụ trách",
  update_task_title: "Đổi tên task",
  update_start_date: "Đổi ngày bắt đầu",
  update_due_date: "Đổi hạn chót",
  create_task: "Tạo task mới",
  delete_task: "Xoá task",
  add_dependency: "Thêm phụ thuộc",
  remove_dependency: "Gỡ phụ thuộc",
  add_comment: "Thêm bình luận",
  create_risk: "Tạo rủi ro mới",
  escalate_blocker: "Nâng cấp độ blocker",
  reassign_blocker_owner: "Đổi người phụ trách blocker",
  update_risk_status: "Đổi trạng thái rủi ro",
  reassign_risk_owner: "Đổi người phụ trách rủi ro",
  update_milestone_status: "Đổi trạng thái milestone",
  update_milestone_date: "Đổi ngày mục tiêu milestone",
  notify_lead: "Thông báo cho lead",
  notify_member: "Thông báo cho thành viên",
  send_channel_message: "Gửi tin nhắn vào channel",
  trigger_replan: "Yêu cầu AI lập lại kế hoạch",
};

// ─── Guided-form metadata (client-safe — no server-only imports) ────────────
// Drives the action/condition editors so users pick from real project data
// (statuses, members, blockers, tasks) instead of typing raw JSON/field paths.

export type ActionFieldType =
  | "select-status"
  | "select-priority"
  | "select-member"
  | "select-blocker"
  | "select-task"
  | "date"
  | "text"
  | "textarea"
  | "number";

export type ActionFieldSpec = {
  key: string;
  label: string;
  type: ActionFieldType;
  required?: boolean;
};

export const ACTION_FIELD_SPECS: Record<string, ActionFieldSpec[]> = {
  update_status: [{ key: "statusId", label: "Trạng thái mới", type: "select-status", required: true }],
  update_priority: [{ key: "priority", label: "Mức ưu tiên", type: "select-priority", required: true }],
  update_assignee: [{ key: "memberId", label: "Giao cho", type: "select-member", required: true }],
  update_task_title: [{ key: "title", label: "Tên task mới", type: "text", required: true }],
  update_start_date: [{ key: "startDate", label: "Ngày bắt đầu mới", type: "date", required: true }],
  update_due_date: [{ key: "dueDate", label: "Hạn chót mới", type: "date", required: true }],
  create_task: [
    { key: "title", label: "Tiêu đề task mới", type: "text", required: true },
    { key: "priority", label: "Mức ưu tiên", type: "select-priority" },
    { key: "assigneeMemberId", label: "Giao cho", type: "select-member" },
    { key: "dueDate", label: "Hạn chót", type: "date" },
  ],
  delete_task: [{ key: "taskId", label: "Task cần xoá (để trống = task hiện tại)", type: "select-task" }],
  add_dependency: [
    { key: "blockerTaskId", label: "Task chặn (blocker)", type: "select-task", required: true },
    { key: "dependencyType", label: "Loại phụ thuộc", type: "text" },
  ],
  remove_dependency: [
    { key: "dependencyId", label: "ID phụ thuộc cần gỡ", type: "text", required: true },
  ],
  add_comment: [{ key: "body", label: "Nội dung bình luận", type: "textarea", required: true }],
  create_risk: [
    { key: "title", label: "Tiêu đề rủi ro", type: "text", required: true },
    { key: "description", label: "Mô tả", type: "textarea" },
    { key: "probability", label: "Xác suất (1-5)", type: "number" },
    { key: "impact", label: "Mức ảnh hưởng (1-5)", type: "number" },
  ],
  escalate_blocker: [{ key: "blockerId", label: "Blocker", type: "select-blocker", required: true }],
  reassign_blocker_owner: [
    { key: "blockerId", label: "Blocker", type: "select-blocker", required: true },
    { key: "memberId", label: "Người phụ trách mới", type: "select-member", required: true },
  ],
  update_risk_status: [
    { key: "riskId", label: "ID rủi ro", type: "text", required: true },
    { key: "status", label: "Trạng thái mới", type: "text", required: true },
  ],
  reassign_risk_owner: [
    { key: "riskId", label: "ID rủi ro", type: "text", required: true },
    { key: "memberId", label: "Người phụ trách mới", type: "select-member", required: true },
  ],
  update_milestone_status: [
    { key: "milestoneId", label: "ID milestone", type: "text", required: true },
    { key: "status", label: "Trạng thái mới", type: "text", required: true },
  ],
  update_milestone_date: [
    { key: "milestoneId", label: "ID milestone", type: "text", required: true },
    { key: "targetDate", label: "Ngày mục tiêu mới", type: "date", required: true },
  ],
  notify_lead: [
    { key: "title", label: "Tiêu đề thông báo", type: "text", required: true },
    { key: "body", label: "Nội dung", type: "textarea" },
  ],
  notify_member: [
    { key: "memberId", label: "Người nhận", type: "select-member", required: true },
    { key: "title", label: "Tiêu đề thông báo", type: "text", required: true },
    { key: "body", label: "Nội dung", type: "textarea" },
  ],
  send_channel_message: [
    { key: "title", label: "Tiêu đề", type: "text", required: true },
    { key: "body", label: "Nội dung", type: "textarea" },
  ],
  trigger_replan: [{ key: "reason", label: "Lý do (tuỳ chọn)", type: "textarea" }],
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
  label: string;
  /** Omitted = free-text value input (no guided picker yet — still whitelisted
   * for this trigger, just not upgraded to a picker). */
  valueKind?: ConditionValueKind;
};

/** Whitelist of condition fields per trigger — doubles as the UI dropdown
 * source AND the server-side enforcement list (see checkTriggerScoping
 * above). Every trigger below now has an entry; see
 * docs_local/automation-trigger-condition-action-catalog.md for the source
 * catalog this was built from. */
export const CONDITION_FIELDS_BY_TRIGGER: Record<string, ConditionFieldSpec[]> = {
  "task.created": [
    { field: "after.priority", label: "Mức ưu tiên", valueKind: "priority" },
    { field: "after.assigneeMemberId", label: "Người được giao", valueKind: "member" },
    { field: "after.reporterMemberId", label: "Người báo cáo", valueKind: "member" },
    { field: "after.dueDate", label: "Hạn chót", valueKind: "date" },
    { field: "after.startDate", label: "Ngày bắt đầu", valueKind: "date" },
    { field: "after.isMilestone", label: "Là milestone?", valueKind: "boolean" },
    { field: "after.milestoneId", label: "Thuộc milestone (ID)" },
    { field: "after.labels", label: "Nhãn (labels)" },
  ],
  "task.updated": [
    { field: "after.assigneeMemberId", label: "Người được giao", valueKind: "member" },
    { field: "after.reporterMemberId", label: "Người báo cáo", valueKind: "member" },
    { field: "after.priority", label: "Mức ưu tiên", valueKind: "priority" },
    { field: "after.dueDate", label: "Hạn chót", valueKind: "date" },
    { field: "after.startDate", label: "Ngày bắt đầu", valueKind: "date" },
    { field: "after.labels", label: "Nhãn (labels)" },
    { field: "after.milestoneId", label: "Thuộc milestone (ID)" },
  ],
  "task.status_changed": [
    { field: "after.statusType", label: "Trạng thái mới", valueKind: "status-type" },
    { field: "before.statusType", label: "Trạng thái trước đó", valueKind: "status-type" },
    { field: "after.assigneeMemberId", label: "Người được giao", valueKind: "member" },
    { field: "after.priority", label: "Mức ưu tiên", valueKind: "priority" },
    { field: "after.dueDate", label: "Hạn chót", valueKind: "date" },
  ],
  "task.assigned": [
    { field: "after.assigneeMemberId", label: "Người được giao", valueKind: "member" },
    { field: "before.assigneeMemberId", label: "Người được giao trước đó", valueKind: "member" },
    { field: "after.priority", label: "Mức ưu tiên", valueKind: "priority" },
    { field: "after.dueDate", label: "Hạn chót", valueKind: "date" },
    { field: "after.assigneeProjectRole", label: "Vai trò của người được giao", valueKind: "project-role" },
  ],
  "task.deleted": [
    { field: "before.priority", label: "Mức ưu tiên", valueKind: "priority" },
    { field: "before.assigneeMemberId", label: "Người được giao", valueKind: "member" },
    { field: "before.isMilestone", label: "Là milestone?", valueKind: "boolean" },
  ],
  "task.restored": [
    { field: "after.priority", label: "Mức ưu tiên", valueKind: "priority" },
    { field: "after.assigneeMemberId", label: "Người được giao", valueKind: "member" },
  ],
  "task.submitted_for_review": [
    { field: "after.assigneeMemberId", label: "Người được giao", valueKind: "member" },
    { field: "after.priority", label: "Mức ưu tiên", valueKind: "priority" },
    { field: "after.reworkCount", label: "Số lần rework", valueKind: "number" },
  ],
  "task.approved": [
    { field: "after.assigneeMemberId", label: "Người được giao", valueKind: "member" },
    { field: "after.priority", label: "Mức ưu tiên", valueKind: "priority" },
    { field: "after.milestoneId", label: "Thuộc milestone (ID)" },
  ],
  "task.rework_requested": [
    { field: "after.assigneeMemberId", label: "Người được giao", valueKind: "member" },
    { field: "after.reworkCount", label: "Số lần rework", valueKind: "number" },
    { field: "after.priority", label: "Mức ưu tiên", valueKind: "priority" },
  ],
  "task.comment_added": [
    { field: "after.body", label: "Nội dung bình luận (chứa từ khoá)" },
    { field: "after.authorMemberId", label: "Người bình luận", valueKind: "member" },
  ],
  "task.dependency_added": [
    { field: "after.dependencyType", label: "Loại phụ thuộc" },
    { field: "after.blockerStatusType", label: "Trạng thái task chặn", valueKind: "status-type" },
  ],
  "task.dependency_removed": [
    { field: "after.dependencyType", label: "Loại phụ thuộc" },
    { field: "after.blockerStatusType", label: "Trạng thái task chặn", valueKind: "status-type" },
  ],
  "blocker.created": [
    { field: "after.severity", label: "Mức độ nghiêm trọng", valueKind: "priority" },
    { field: "after.ownerMemberId", label: "Người phụ trách", valueKind: "member" },
  ],
  "blocker.updated": [
    { field: "after.status", label: "Trạng thái blocker", valueKind: "blocker-status" },
    { field: "after.severity", label: "Mức độ nghiêm trọng", valueKind: "priority" },
    { field: "after.ownerMemberId", label: "Người phụ trách", valueKind: "member" },
  ],
  "blocker.resolved": [
    { field: "after.status", label: "Trạng thái blocker", valueKind: "blocker-status" },
    { field: "after.resolvedByMemberId", label: "Người giải quyết", valueKind: "member" },
  ],
  "risk.created": [
    { field: "after.probability", label: "Xác suất (1-5)", valueKind: "number" },
    { field: "after.impact", label: "Mức ảnh hưởng (1-5)", valueKind: "number" },
    { field: "after.ownerMemberId", label: "Người phụ trách", valueKind: "member" },
  ],
  "risk.updated": [
    { field: "after.status", label: "Trạng thái rủi ro" },
    { field: "after.probability", label: "Xác suất (1-5)", valueKind: "number" },
    { field: "after.impact", label: "Mức ảnh hưởng (1-5)", valueKind: "number" },
  ],
  "milestone.created": [
    { field: "after.targetDate", label: "Ngày mục tiêu", valueKind: "date" },
    { field: "after.status", label: "Trạng thái milestone" },
  ],
  "milestone.updated": [
    { field: "after.targetDate", label: "Ngày mục tiêu", valueKind: "date" },
    { field: "before.status", label: "Trạng thái trước đó" },
    { field: "after.status", label: "Trạng thái mới" },
  ],
  "daily_update.submitted": [
    { field: "after.confidenceLevel", label: "Mức độ tự tin (1-5)", valueKind: "number" },
    { field: "after.completedText", label: "Nội dung đã làm (chứa từ khoá)" },
    { field: "after.blockersText", label: "Nội dung vướng mắc (chứa từ khoá)" },
    { field: "after.memberId", label: "Thành viên", valueKind: "member" },
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
