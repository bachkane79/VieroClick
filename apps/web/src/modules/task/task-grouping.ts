import type { MemberOptionView, TaskStatusView, TaskView } from "./task.view";

/**
 * Lean WBS node shape passed from server pages to client views. The full row
 * carries Date fields that don't serialize cleanly across the boundary, so
 * pages map to this before handing it to a client component.
 */
export interface PhaseNode {
  id: string;
  parentId: string | null;
  title: string;
  nodeType: string;
  linkedTaskId: string | null;
  position: number;
}

export const UNGROUPED_KEY = "__ungrouped__";

/** Phase nodes (WBS top-level "phase" entries), ordered by position. */
export function listPhases(nodes: PhaseNode[]): PhaseNode[] {
  return nodes
    .filter((n) => n.nodeType === "phase")
    .slice()
    .sort((a, b) => a.position - b.position);
}

/**
 * Map each task id to the WBS phase it lives under. The plan applier creates a
 * `node_type: "task"` node per task with `linkedTaskId` set and `parentId`
 * pointing at the phase; we resolve to the nearest "phase" ancestor to be
 * robust to intermediate grouping nodes.
 */
export function taskPhaseMap(nodes: PhaseNode[]): Map<string, string> {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  function phaseAncestor(start: PhaseNode | null): PhaseNode | null {
    let cur = start;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      if (cur.nodeType === "phase") return cur;
      cur = cur.parentId ? (byId.get(cur.parentId) ?? null) : null;
    }
    return null;
  }

  const map = new Map<string, string>();
  for (const node of nodes) {
    if (!node.linkedTaskId) continue;
    // The linked node is the task-level node; its phase is an ancestor of it
    // (or of itself, if the task was linked directly to a phase).
    const phase = phaseAncestor(node);
    if (phase) map.set(node.linkedTaskId, phase.id);
  }
  return map;
}

export type GroupBy = "none" | "status" | "phase" | "assignee";

export interface TaskGroup {
  key: string;
  label: string;
  /** Present for status groups — drives the ClickUp-style colored pill. */
  statusType?: TaskStatusView["type"];
  tasks: TaskView[];
}

interface GroupingContext {
  statuses: TaskStatusView[];
  members: MemberOptionView[];
  phases: PhaseNode[];
  taskPhase: Map<string, string>;
}

/**
 * Group tasks for the List/Table views. Groups come back in a stable order
 * (status → status position, phase → phase position, assignee → name) with an
 * "Ungrouped" bucket last when anything falls outside the known keys.
 */
export function groupTasks(tasks: TaskView[], groupBy: GroupBy, ctx: GroupingContext): TaskGroup[] {
  if (groupBy === "none") {
    return [{ key: "all", label: "All tasks", tasks }];
  }

  if (groupBy === "status") {
    const byStatus = new Map<string, TaskView[]>();
    for (const t of tasks) {
      const list = byStatus.get(t.statusId) ?? [];
      list.push(t);
      byStatus.set(t.statusId, list);
    }
    return ctx.statuses.map((s) => ({
      key: s.id,
      label: s.name,
      statusType: s.type,
      tasks: byStatus.get(s.id) ?? [],
    }));
  }

  if (groupBy === "phase") {
    const phases = listPhases(ctx.phases);
    const byPhase = new Map<string, TaskView[]>();
    for (const t of tasks) {
      const key = ctx.taskPhase.get(t.id) ?? UNGROUPED_KEY;
      const list = byPhase.get(key) ?? [];
      list.push(t);
      byPhase.set(key, list);
    }
    const groups: TaskGroup[] = phases.map((p) => ({
      key: p.id,
      label: p.title,
      tasks: byPhase.get(p.id) ?? [],
    }));
    const ungrouped = byPhase.get(UNGROUPED_KEY);
    if (ungrouped && ungrouped.length > 0) {
      groups.push({ key: UNGROUPED_KEY, label: "No phase", tasks: ungrouped });
    }
    return groups;
  }

  // assignee
  const byAssignee = new Map<string, TaskView[]>();
  for (const t of tasks) {
    const key = t.assigneeMemberId ?? UNGROUPED_KEY;
    const list = byAssignee.get(key) ?? [];
    list.push(t);
    byAssignee.set(key, list);
  }
  const nameById = new Map(ctx.members.map((m) => [m.id, m.fullName]));
  const groups: TaskGroup[] = ctx.members
    .filter((m) => byAssignee.has(m.id))
    .map((m) => ({ key: m.id, label: nameById.get(m.id) ?? "Member", tasks: byAssignee.get(m.id)! }));
  const unassigned = byAssignee.get(UNGROUPED_KEY);
  if (unassigned && unassigned.length > 0) {
    groups.push({ key: UNGROUPED_KEY, label: "Unassigned", tasks: unassigned });
  }
  return groups;
}

export type SortField = "manual" | "title" | "dueDate" | "priority" | "status";
export type SortDir = "asc" | "desc";

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export interface TaskFilter {
  search: string;
  statusIds: string[];
  assigneeIds: string[];
  priorities: string[];
}

export function filterTasks(tasks: TaskView[], filter: TaskFilter): TaskView[] {
  const q = filter.search.trim().toLowerCase();
  return tasks.filter((t) => {
    if (q && !t.title.toLowerCase().includes(q) && !(t.description ?? "").toLowerCase().includes(q)) {
      return false;
    }
    if (filter.statusIds.length && !filter.statusIds.includes(t.statusId)) return false;
    if (filter.priorities.length && !filter.priorities.includes(t.priority)) return false;
    if (filter.assigneeIds.length) {
      const key = t.assigneeMemberId ?? UNGROUPED_KEY;
      if (!filter.assigneeIds.includes(key)) return false;
    }
    return true;
  });
}

export function sortTasks(
  tasks: TaskView[],
  field: SortField,
  dir: SortDir,
  statuses: TaskStatusView[]
): TaskView[] {
  if (field === "manual") return tasks;
  const statusPos = new Map(statuses.map((s) => [s.id, s.position]));
  const mul = dir === "asc" ? 1 : -1;
  return tasks.slice().sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case "title":
        cmp = a.title.localeCompare(b.title);
        break;
      case "dueDate":
        // Nulls always sort last regardless of direction.
        if (!a.dueDate && !b.dueDate) cmp = 0;
        else if (!a.dueDate) return 1;
        else if (!b.dueDate) return -1;
        else cmp = a.dueDate.localeCompare(b.dueDate);
        break;
      case "priority":
        cmp = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
        break;
      case "status":
        cmp = (statusPos.get(a.statusId) ?? 99) - (statusPos.get(b.statusId) ?? 99);
        break;
    }
    return cmp * mul;
  });
}
