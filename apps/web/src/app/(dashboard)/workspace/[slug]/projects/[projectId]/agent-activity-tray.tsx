"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@vieroc/ui";
import { useTranslations } from "next-intl";
import { Bot, CheckCircle2, ChevronDown, ChevronUp, Loader2, X, XCircle } from "lucide-react";

type StepStatus = "waiting" | "active" | "done" | "failed";

/**
 * One real `agent_jobs` row. `id` is the job UUID — the tray is a queue of
 * whatever is actually running, not a fixed two-step Planner/Assigner strip.
 */
type ActivityStep = {
  id: string;
  jobType: string;
  labelKey: string;
  status: StepStatus;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
};

type ActivityState = {
  active: boolean;
  completed: boolean;
  failed: boolean;
  visible: boolean;
  runningCount: number;
  queuedCount: number;
  summaryKey: "running" | "done" | "attention" | "idle";
  counts: { tasks: number; assignedTasks: number; wbs: number; milestones: number; risks: number };
  steps: ActivityStep[];
};

const emptyActivity: ActivityState = {
  active: false,
  completed: false,
  failed: false,
  visible: false,
  runningCount: 0,
  queuedCount: 0,
  summaryKey: "idle",
  counts: { tasks: 0, assignedTasks: 0, wbs: 0, milestones: 0, risks: 0 },
  steps: [],
};

/** Tray view state (collapsed + per-job dismissals), shared across tabs. */
type TrayPrefs = { collapsed: boolean; dismissedIds: string[] };

const emptyPrefs: TrayPrefs = { collapsed: false, dismissedIds: [] };

function storageKey(projectId: string) {
  return `vc-agent-tray:${projectId}`;
}

function readPrefs(projectId: string): TrayPrefs {
  if (typeof window === "undefined") return emptyPrefs;
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return emptyPrefs;
    const parsed = JSON.parse(raw) as Partial<TrayPrefs>;
    return {
      collapsed: Boolean(parsed.collapsed),
      dismissedIds: Array.isArray(parsed.dismissedIds) ? parsed.dismissedIds.slice(-50) : [],
    };
  } catch {
    return emptyPrefs;
  }
}

function statusLabelKey(status: StepStatus) {
  if (status === "active") return "project.tray.running";
  if (status === "done") return "project.tray.done";
  if (status === "failed") return "project.tray.failed";
  return "project.tray.waiting";
}

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "active") return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
  if (status === "done") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
  if (status === "failed") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  return <span className="h-2 w-2 rounded-full bg-muted-foreground/35" />;
}

function formatElapsed(fromIso: string, toIso: string | null) {
  const from = new Date(fromIso).getTime();
  const to = toIso ? new Date(toIso).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((to - from) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export function AgentActivityTray({ projectId }: { projectId: string }) {
  const router = useRouter();
  const t = useTranslations();
  const [activity, setActivity] = useState<ActivityState>(emptyActivity);
  const [prefs, setPrefs] = useState<TrayPrefs>(emptyPrefs);
  const [hydrated, setHydrated] = useState(false);
  /** Ticks while work is in flight so the elapsed counter moves between polls. */
  const [, setTick] = useState(0);
  const seenCompletedRef = useRef<Set<string>>(new Set());

  // Load view prefs, and keep them in sync when another tab changes them.
  useEffect(() => {
    setPrefs(readPrefs(projectId));
    setHydrated(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey(projectId)) setPrefs(readPrefs(projectId));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [projectId]);

  const savePrefs = useCallback(
    (next: TrayPrefs) => {
      setPrefs(next);
      try {
        window.localStorage.setItem(storageKey(projectId), JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [projectId]
  );

  useEffect(() => {
    setActivity(emptyActivity);
    seenCompletedRef.current = new Set();
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      try {
        const response = await fetch(`/api/projects/${projectId}/agent-activity`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const next = (await response.json()) as ActivityState;
        if (cancelled) return;

        setActivity(next);

        // Refresh server data once per job that just reached a terminal state,
        // so applied plans/assignments show up without a manual reload.
        const newlyDone = next.steps.filter(
          (s) => s.status === "done" && !seenCompletedRef.current.has(s.id)
        );
        if (newlyDone.length > 0) {
          newlyDone.forEach((s) => seenCompletedRef.current.add(s.id));
          router.refresh();
        }

        const delay = next.active ? 2000 : next.visible ? 5000 : 8000;
        timer = setTimeout(load, delay);
      } catch {
        if (!cancelled) timer = setTimeout(load, 8000);
      }
    }

    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [projectId, router]);

  // Smooth elapsed counter only while something is running.
  useEffect(() => {
    if (!activity.active) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [activity.active]);

  const visibleSteps = useMemo(
    () => activity.steps.filter((step) => !prefs.dismissedIds.includes(step.id)),
    [activity.steps, prefs.dismissedIds]
  );

  const agentLabel = (step: ActivityStep) => {
    const key = `project.tray.agent.${step.labelKey}`;
    return t.has(key as Parameters<typeof t.has>[0])
      ? t(key as Parameters<typeof t>[0])
      : step.jobType;
  };

  if (!hydrated || !activity.visible || visibleSteps.length === 0) return null;

  const runningCount = visibleSteps.filter((s) => s.status === "active").length;
  const queuedCount = visibleSteps.filter((s) => s.status === "waiting").length;
  const anyLive = runningCount + queuedCount > 0;
  const summaryKey = anyLive
    ? "running"
    : visibleSteps.some((s) => s.status === "failed")
      ? "attention"
      : "done";

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[min(calc(100vw-2rem),380px)] overflow-hidden rounded-lg border border-border bg-card shadow-elevated">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/35 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
            {anyLive && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-primary" />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {t(`project.tray.summary.${summaryKey}` as Parameters<typeof t>[0], {
                count: runningCount + queuedCount,
              })}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {t("project.tray.countsSummary", {
                tasks: activity.counts.tasks,
                wbs: activity.counts.wbs,
                risks: activity.counts.risks,
              })}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={() => savePrefs({ ...prefs, collapsed: !prefs.collapsed })}
            aria-label={prefs.collapsed ? t("project.tray.expand") : t("project.tray.collapse")}
          >
            {prefs.collapsed ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {!anyLive && (
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={() =>
                savePrefs({
                  ...prefs,
                  dismissedIds: [
                    ...prefs.dismissedIds,
                    ...visibleSteps.map((s) => s.id),
                  ].slice(-50),
                })
              }
              aria-label={t("project.tray.dismiss")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {!prefs.collapsed && (
        <ul className="max-h-64 divide-y overflow-y-auto">
          {visibleSteps.map((step) => (
            <li
              key={step.id}
              className="grid grid-cols-[minmax(0,1fr)_84px_58px] items-center gap-2 px-3 py-2.5 text-xs"
            >
              <div className="flex min-w-0 items-center gap-2">
                <StatusIcon status={step.status} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{agentLabel(step)}</span>
                  {step.error && (
                    <span className="block truncate text-[11px] text-destructive">
                      {step.error}
                    </span>
                  )}
                </span>
              </div>
              <span
                className={cn(
                  "rounded px-2 py-1 text-center font-semibold",
                  step.status === "active" && "bg-primary/10 text-primary",
                  step.status === "done" && "bg-emerald-500/10 text-emerald-700",
                  step.status === "failed" && "bg-destructive/10 text-destructive",
                  step.status === "waiting" && "bg-muted text-muted-foreground"
                )}
              >
                {t(statusLabelKey(step.status) as Parameters<typeof t>[0])}
              </span>
              <span className="text-right tabular-nums text-muted-foreground">
                {step.status === "waiting" ? "—" : formatElapsed(step.startedAt, step.finishedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
