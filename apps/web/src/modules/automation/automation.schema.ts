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
  create_risk: "Tạo rủi ro mới",
  escalate_blocker: "Nâng cấp độ blocker",
  notify_lead: "Thông báo cho lead",
  notify_member: "Thông báo cho thành viên",
  trigger_replan: "Yêu cầu AI lập lại kế hoạch",
};

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
  label: string;
  type: ActionFieldType;
  required?: boolean;
};

export const ACTION_FIELD_SPECS: Record<string, ActionFieldSpec[]> = {
  update_status: [{ key: "statusId", label: "Trạng thái mới", type: "select-status", required: true }],
  update_priority: [{ key: "priority", label: "Mức ưu tiên", type: "select-priority", required: true }],
  update_assignee: [{ key: "memberId", label: "Giao cho", type: "select-member", required: true }],
  create_risk: [
    { key: "title", label: "Tiêu đề rủi ro", type: "text", required: true },
    { key: "description", label: "Mô tả", type: "textarea" },
    { key: "probability", label: "Xác suất (1-5)", type: "number" },
    { key: "impact", label: "Mức ảnh hưởng (1-5)", type: "number" },
  ],
  escalate_blocker: [{ key: "blockerId", label: "Blocker", type: "select-blocker", required: true }],
  notify_lead: [
    { key: "title", label: "Tiêu đề thông báo", type: "text", required: true },
    { key: "body", label: "Nội dung", type: "textarea" },
  ],
  notify_member: [
    { key: "memberId", label: "Người nhận", type: "select-member", required: true },
    { key: "title", label: "Tiêu đề thông báo", type: "text", required: true },
    { key: "body", label: "Nội dung", type: "textarea" },
  ],
  trigger_replan: [{ key: "reason", label: "Lý do (tuỳ chọn)", type: "textarea" }],
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
  { field: string; label: string; valueKind: ConditionValueKind }[]
> = {
  "task.status_changed": [
    { field: "after.statusType", label: "Trạng thái mới", valueKind: "status-type" },
    { field: "before.statusType", label: "Trạng thái trước đó", valueKind: "status-type" },
  ],
  "task.assigned": [{ field: "after.assigneeMemberId", label: "Người được giao", valueKind: "member" }],
  "task.updated": [{ field: "after.priority", label: "Mức ưu tiên", valueKind: "priority" }],
  "blocker.updated": [{ field: "after.status", label: "Trạng thái blocker", valueKind: "blocker-status" }],
  "blocker.resolved": [{ field: "after.status", label: "Trạng thái blocker", valueKind: "blocker-status" }],
};
