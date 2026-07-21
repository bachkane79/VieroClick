import "server-only";
import { db, tasks, taskDependencies, taskStatuses } from "@vieroc/db";
import { eq } from "drizzle-orm";

export type Deviation = {
  type: "dependency_conflict" | "milestone_at_risk" | "task_delayed";
  taskId: string;
  severity: "low" | "medium" | "high" | "urgent";
  reason: string;
};

/**
 * Deterministic plan-deviation checks (overdue, milestone-blocking, dependency
 * conflicts) with no actor requirement — shared by the session-authed
 * `detectPlanDeviations` flow, the `run-deviation-check` agent route, and the
 * cron-triggered observer dispatch.
 */
export async function detectDeviations(projectId: string): Promise<Deviation[]> {
  const [allTasks, dependencies] = await Promise.all([
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueDate: tasks.dueDate,
        startDate: tasks.startDate,
        isMilestone: tasks.isMilestone,
        priority: tasks.priority,
        statusType: taskStatuses.type,
      })
      .from(tasks)
      .innerJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
      .where(eq(tasks.projectId, projectId)),
    db
      .select({
        blockerTaskId: taskDependencies.blockerTaskId,
        blockedTaskId: taskDependencies.blockedTaskId,
      })
      .from(taskDependencies)
      .where(eq(taskDependencies.projectId, projectId)),
  ]);

  const todayStr = new Date().toISOString().split("T")[0];
  const today = todayStr ? new Date(todayStr) : new Date();
  const deviations: Deviation[] = [];

  const overdueTasks = allTasks.filter((t) => {
    if (t.statusType === "done" || t.statusType === "cancelled") return false;
    if (!t.dueDate) return false;
    return new Date(t.dueDate) < today;
  });

  const blockerMap = new Map<string, string[]>();
  for (const dep of dependencies) {
    const list = blockerMap.get(dep.blockerTaskId) ?? [];
    list.push(dep.blockedTaskId);
    blockerMap.set(dep.blockerTaskId, list);
  }

  const blocksTask = (startId: string, targetId: string): boolean => {
    const visited = new Set<string>();
    const queue = [startId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === targetId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      queue.push(...(blockerMap.get(current) ?? []));
    }
    return false;
  };

  const milestoneTasks = allTasks.filter((t) => t.isMilestone);

  for (const ot of overdueTasks) {
    let blocksMilestone = false;
    let milestoneTitle = "";
    for (const mt of milestoneTasks) {
      if (blocksTask(ot.id, mt.id)) {
        blocksMilestone = true;
        milestoneTitle = mt.title;
        break;
      }
    }
    if (blocksMilestone) {
      deviations.push({
        type: "milestone_at_risk",
        taskId: ot.id,
        severity: "high",
        reason: `Overdue task "${ot.title}" blocks milestone "${milestoneTitle}"`,
      });
    } else {
      const sev =
        ot.priority === "urgent"
          ? "urgent"
          : ot.priority === "high"
            ? "high"
            : ot.priority === "low"
              ? "low"
              : "medium";
      deviations.push({
        type: "task_delayed",
        taskId: ot.id,
        severity: sev,
        reason: `Task "${ot.title}" is overdue (due ${ot.dueDate})`,
      });
    }
  }

  for (const dep of dependencies) {
    const blocker = allTasks.find((t) => t.id === dep.blockerTaskId);
    const blocked = allTasks.find((t) => t.id === dep.blockedTaskId);
    if (blocker && blocked && blocker.dueDate && blocked.startDate) {
      if (new Date(blocker.dueDate) > new Date(blocked.startDate)) {
        deviations.push({
          type: "dependency_conflict",
          taskId: blocked.id,
          severity: "medium",
          reason: `Blocker "${blocker.title}" due (${blocker.dueDate}) is after blocked task "${blocked.title}" start (${blocked.startDate})`,
        });
      }
    }
  }

  return deviations;
}
