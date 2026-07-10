"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GroupBy, SortDir, SortField, TaskFilter } from "../task-grouping";

export interface ViewPrefs {
  groupBy: GroupBy;
  sortField: SortField;
  sortDir: SortDir;
  filter: TaskFilter;
}

export interface SavedView {
  name: string;
  prefs: ViewPrefs;
}

export const DEFAULT_PREFS: ViewPrefs = {
  groupBy: "status",
  sortField: "manual",
  sortDir: "asc",
  filter: { search: "", statusIds: [], assigneeIds: [], priorities: [] },
};

function prefsKey(projectId: string) {
  return `vieroc:viewprefs:${projectId}`;
}
function savedKey(projectId: string) {
  return `vieroc:savedviews:${projectId}`;
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    return fallback;
  }
}

/**
 * View preferences (group/sort/filter) persisted to localStorage per project,
 * shared across List/Table/Calendar. Also manages named saved views. Kept
 * client-only + localStorage on purpose — no DB migration for this pass.
 *
 * `defaultGroupBy` lets a view seed a sensible default (e.g. List defaults to
 * grouping by status) the first time, before the user has saved anything.
 */
export function useViewPrefs(projectId: string, defaultGroupBy: GroupBy = "status") {
  const seeded = useMemo<ViewPrefs>(
    () => ({ ...DEFAULT_PREFS, groupBy: defaultGroupBy }),
    [defaultGroupBy]
  );

  const [prefs, setPrefs] = useState<ViewPrefs>(seeded);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted state after mount to avoid SSR/client mismatch.
  useEffect(() => {
    setPrefs(readJSON<ViewPrefs>(prefsKey(projectId), seeded));
    setSavedViews(readJSON<SavedView[]>(savedKey(projectId), []) as SavedView[]);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(prefsKey(projectId), JSON.stringify(prefs));
    } catch {
      /* storage may be unavailable (private mode) — non-fatal */
    }
  }, [prefs, projectId, hydrated]);

  const persistSaved = useCallback(
    (next: SavedView[]) => {
      setSavedViews(next);
      try {
        window.localStorage.setItem(savedKey(projectId), JSON.stringify(next));
      } catch {
        /* non-fatal */
      }
    },
    [projectId]
  );

  const setGroupBy = useCallback((groupBy: GroupBy) => setPrefs((p) => ({ ...p, groupBy })), []);
  const setSort = useCallback(
    (sortField: SortField, sortDir: SortDir) => setPrefs((p) => ({ ...p, sortField, sortDir })),
    []
  );
  const setFilter = useCallback(
    (updater: (f: TaskFilter) => TaskFilter) =>
      setPrefs((p) => ({ ...p, filter: updater(p.filter) })),
    []
  );
  const resetPrefs = useCallback(() => setPrefs(seeded), [seeded]);

  const saveView = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const next = savedViews.filter((v) => v.name !== trimmed);
      next.push({ name: trimmed, prefs });
      persistSaved(next);
    },
    [prefs, savedViews, persistSaved]
  );
  const applyView = useCallback((view: SavedView) => setPrefs(view.prefs), []);
  const deleteView = useCallback(
    (name: string) => persistSaved(savedViews.filter((v) => v.name !== name)),
    [savedViews, persistSaved]
  );

  return {
    prefs,
    hydrated,
    savedViews,
    setGroupBy,
    setSort,
    setFilter,
    resetPrefs,
    saveView,
    applyView,
    deleteView,
  };
}
