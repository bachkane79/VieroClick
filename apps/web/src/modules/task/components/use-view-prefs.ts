"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UNGROUPED_KEY } from "../task-grouping";
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
    const parsed = JSON.parse(raw) as T;
    // Arrays must never be object-spread: `{ ...[a, b] }` yields `{0:a, 1:b}`,
    // which has no `.length` and no `.map` — the saved-views dropdown then threw
    // "t.map is not a function" for anyone who had ever saved a view.
    // The merge exists only to back-fill pref keys added after a write, so it
    // applies to object shapes and object shapes alone.
    if (Array.isArray(fallback)) return Array.isArray(parsed) ? parsed : fallback;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return fallback;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

/** Ids the current project actually has, used to vet a filter read off disk. */
export interface KnownIds {
  statusIds: string[];
  memberIds: string[];
}

/**
 * Make a filter read out of localStorage trustworthy before it is applied.
 *
 * Two things go wrong with a persisted filter, and both look identical to the
 * user — the list renders empty while the header tiles still count every task,
 * and no filter checkbox appears ticked, so nothing on screen says what is
 * hiding the rows:
 *
 *  - it holds an id the project no longer has (a deleted status, a member who
 *    left, or — before the write-back below was keyed to the project — an id
 *    that bled in from a different project). Such an id matches no task, so the
 *    filter drops all of them.
 *  - it predates a key being added to `TaskFilter`. `readJSON`'s merge is
 *    shallow, so `filter` is taken wholesale from disk and a missing
 *    `statusIds`/`priorities` array made `filterTasks` throw on `.length`.
 */
function normalizePrefs(prefs: ViewPrefs, known: KnownIds | undefined): ViewPrefs {
  const raw: Partial<TaskFilter> = prefs.filter ?? {};
  const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);

  const statuses = known ? new Set(known.statusIds) : null;
  const members = known ? new Set(known.memberIds) : null;

  return {
    ...prefs,
    filter: {
      search: typeof raw.search === "string" ? raw.search : "",
      priorities: arr(raw.priorities),
      statusIds: statuses ? arr(raw.statusIds).filter((id) => statuses.has(id)) : arr(raw.statusIds),
      // UNGROUPED_KEY is the "unassigned" bucket, not a member id — never drop it.
      assigneeIds: members
        ? arr(raw.assigneeIds).filter((id) => id === UNGROUPED_KEY || members.has(id))
        : arr(raw.assigneeIds),
    },
  };
}

/**
 * View preferences (group/sort/filter) persisted to localStorage per project,
 * shared across List/Table/Calendar. Also manages named saved views. Kept
 * client-only + localStorage on purpose — no DB migration for this pass.
 *
 * `defaultGroupBy` lets a view seed a sensible default (e.g. List defaults to
 * grouping by status) the first time, before the user has saved anything.
 */
export function useViewPrefs(
  projectId: string,
  defaultGroupBy: GroupBy = "status",
  known?: KnownIds
) {
  const seeded = useMemo<ViewPrefs>(
    () => ({ ...DEFAULT_PREFS, groupBy: defaultGroupBy }),
    [defaultGroupBy]
  );

  const [prefs, setPrefs] = useState<ViewPrefs>(seeded);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  // Which project `prefs` currently holds — deliberately the id, not a boolean
  // "hydrated" flag. Switching projects client-side reuses this component, so
  // `projectId` changes one render before the load effect swaps `prefs`. With a
  // boolean the write-back effect below still passed its guard on that render
  // and stamped the *previous* project's filter onto the new project's key,
  // where its foreign status/assignee ids matched nothing and emptied the list.
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  // `known` is a fresh object every render, so it can't be an effect dep; a ref
  // keeps the current value readable from the projectId-keyed effect below.
  const knownRef = useRef(known);
  knownRef.current = known;

  // Load persisted state after mount to avoid SSR/client mismatch.
  useEffect(() => {
    setPrefs(normalizePrefs(readJSON<ViewPrefs>(prefsKey(projectId), seeded), knownRef.current));
    setSavedViews(readJSON<SavedView[]>(savedKey(projectId), []));
    setHydratedFor(projectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    // Never write until `prefs` is known to belong to `projectId`.
    if (hydratedFor !== projectId) return;
    try {
      window.localStorage.setItem(prefsKey(projectId), JSON.stringify(prefs));
    } catch {
      /* storage may be unavailable (private mode) — non-fatal */
    }
  }, [prefs, projectId, hydratedFor]);

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
    hydrated: hydratedFor === projectId,
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
