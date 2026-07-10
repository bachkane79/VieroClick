"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TaskView } from "../task.view";

/**
 * Local optimistic overlay on top of server-provided tasks. Quick actions and
 * board DnD patch immediately; the patch is dropped once the server props catch
 * up (revalidatePath) or explicitly rolled back with a `null` patch on failure.
 */
export function useOptimisticTasks(tasks: TaskView[]) {
  const [overrides, setOverrides] = useState<Record<string, Partial<TaskView>>>({});

  // Drop overrides the server data already reflects, so later external updates
  // to the same field are not masked by a stale patch.
  useEffect(() => {
    setOverrides((current) => {
      const entries = Object.entries(current);
      if (entries.length === 0) return current;
      const byId = new Map(tasks.map((t) => [t.id, t]));
      const next: Record<string, Partial<TaskView>> = {};
      let changed = false;
      for (const [taskId, patch] of entries) {
        const serverTask = byId.get(taskId);
        const settled =
          !serverTask ||
          Object.entries(patch).every(
            ([key, value]) => serverTask[key as keyof TaskView] === value
          );
        if (settled) changed = true;
        else next[taskId] = patch;
      }
      return changed ? next : current;
    });
  }, [tasks]);

  const effectiveTasks = useMemo(
    () => tasks.map((task) => (overrides[task.id] ? { ...task, ...overrides[task.id] } : task)),
    [tasks, overrides]
  );

  const applyOptimistic = useCallback((taskId: string, patch: Partial<TaskView> | null) => {
    setOverrides((current) => {
      if (patch === null) {
        if (!(taskId in current)) return current;
        const next = { ...current };
        delete next[taskId];
        return next;
      }
      return { ...current, [taskId]: { ...current[taskId], ...patch } };
    });
  }, []);

  return { effectiveTasks, applyOptimistic };
}
