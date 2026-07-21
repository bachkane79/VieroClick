export interface AcceptanceCriterionView {
  id?: string;
  text: string;
  required: boolean;
  checked: boolean;
}

export interface TaskView {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  statusId: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  /** Primary/lead assignee (backward compatible). */
  assigneeMemberId: string | null;
  /** Full assignee set (multi-assignee). Includes the primary as the first entry. */
  assigneeMemberIds: string[];
  reporterMemberId: string | null;
  startDate: string | null;
  dueDate: string | null;
  estimateHours: string | null;
  actualHours: string | null;
  acceptanceCriteria: AcceptanceCriterionView[];
  labels: string[];
  position: number;
  isMilestone: boolean;
}

export interface TaskStatusView {
  id: string;
  projectId: string;
  name: string;
  type: "todo" | "in_progress" | "in_review" | "blocked" | "done" | "cancelled";
  position: number;
  isDefault: boolean;
}

export interface TaskDependencyView {
  id: string;
  projectId: string;
  blockerTaskId: string;
  blockedTaskId: string;
  dependencyType: string;
}

export interface MemberOptionView {
  id: string;
  fullName: string;
  email: string;
}

export interface MyTaskView extends TaskView {
  projectName: string;
  projectStatus: string;
  statusName: string;
  statusType: TaskStatusView["type"];
}

export function normalizeCriteria(value: unknown): AcceptanceCriterionView[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") {
        return { text: item, required: true, checked: false };
      }

      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const text = typeof record.text === "string" ? record.text : "";
        if (!text.trim()) return null;
        return {
          id: typeof record.id === "string" ? record.id : undefined,
          text,
          required: record.required !== false,
          checked: record.checked === true,
        };
      }

      return null;
    })
    .filter((item): item is AcceptanceCriterionView => Boolean(item));
}

export function toTaskView(task: {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  statusId: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  assigneeMemberId: string | null;
  assigneeMemberIds?: string[];
  reporterMemberId: string | null;
  startDate: string | null;
  dueDate: string | null;
  estimateHours: unknown;
  actualHours: unknown;
  acceptanceCriteria: unknown;
  labels: string[];
  position: number;
  isMilestone: boolean;
}): TaskView {
  // Prefer the explicit multi-assignee set; fall back to the primary column so
  // rows loaded without the join still render an assignee.
  const assigneeMemberIds =
    task.assigneeMemberIds && task.assigneeMemberIds.length > 0
      ? task.assigneeMemberIds
      : task.assigneeMemberId
        ? [task.assigneeMemberId]
        : [];
  return {
    id: task.id,
    projectId: task.projectId,
    parentTaskId: task.parentTaskId,
    statusId: task.statusId,
    title: task.title,
    description: task.description,
    priority: task.priority,
    assigneeMemberId: task.assigneeMemberId,
    assigneeMemberIds,
    reporterMemberId: task.reporterMemberId,
    startDate: task.startDate,
    dueDate: task.dueDate,
    estimateHours: task.estimateHours == null ? null : String(task.estimateHours),
    actualHours: task.actualHours == null ? null : String(task.actualHours),
    acceptanceCriteria: normalizeCriteria(task.acceptanceCriteria),
    labels: task.labels,
    position: task.position,
    isMilestone: task.isMilestone,
  };
}

export function toStatusView(status: TaskStatusView): TaskStatusView {
  return {
    id: status.id,
    projectId: status.projectId,
    name: status.name,
    type: status.type,
    position: status.position,
    isDefault: status.isDefault,
  };
}

export function toDependencyView(dependency: TaskDependencyView): TaskDependencyView {
  return {
    id: dependency.id,
    projectId: dependency.projectId,
    blockerTaskId: dependency.blockerTaskId,
    blockedTaskId: dependency.blockedTaskId,
    dependencyType: dependency.dependencyType,
  };
}

export function toMyTaskView(
  task: Parameters<typeof toTaskView>[0] & {
    projectName: string;
    projectStatus: string;
    statusName: string;
    statusType: TaskStatusView["type"];
  }
): MyTaskView {
  return {
    ...toTaskView(task),
    projectName: task.projectName,
    projectStatus: task.projectStatus,
    statusName: task.statusName,
    statusType: task.statusType,
  };
}
