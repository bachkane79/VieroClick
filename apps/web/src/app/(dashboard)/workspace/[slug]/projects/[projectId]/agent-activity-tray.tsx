"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@vieroc/ui";
import { Bot, CheckCircle2, ChevronDown, ChevronUp, Loader2, XCircle } from "lucide-react";

type StepStatus = "waiting" | "active" | "done" | "failed";

type ActivityStep = {
  id: "planning" | "assignment";
  label: string;
  status: StepStatus;
  detail: string;
};

type ActivityState = {
  active: boolean;
  completed: boolean;
  failed: boolean;
  visible: boolean;
  summary: string;
  counts: {
    tasks: number;
    assignedTasks: number;
    wbs: number;
    milestones: number;
    risks: number;
  };
  steps: ActivityStep[];
};

const emptyActivity: ActivityState = {
  active: false,
  completed: false,
  failed: false,
  visible: false,
  summary: "No active agent work",
  counts: { tasks: 0, assignedTasks: 0, wbs: 0, milestones: 0, risks: 0 },
  steps: [],
};

function statusLabel(status: StepStatus) {
  if (status === "active") return "Running";
  if (status === "done") return "Done";
  if (status === "failed") return "Failed";
  return "Waiting";
}

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "active") return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
  if (status === "done") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
  if (status === "failed") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  return <span className="h-2 w-2 rounded-full bg-muted-foreground/35" />;
}

export function AgentActivityTray({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [activity, setActivity] = useState<ActivityState>(emptyActivity);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    setActivity(emptyActivity);
    setDismissed(false);
    completedRef.current = false;
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

        if (next.completed && !completedRef.current) {
          completedRef.current = true;
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

  const shouldShow = useMemo(
    () => activity.visible && (!dismissed || activity.active),
    [activity.active, activity.visible, dismissed]
  );

  if (!shouldShow) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[min(calc(100vw-2rem),360px)] overflow-hidden rounded-lg border border-border bg-card shadow-elevated">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/35 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{activity.summary}</p>
            <p className="truncate text-xs text-muted-foreground">
              {activity.counts.tasks} tasks · {activity.counts.wbs} WBS · {activity.counts.risks} risks
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand agent activity" : "Collapse agent activity"}
          >
            {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {!activity.active && (
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss agent activity"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="divide-y">
          {activity.steps.map((step) => (
            <div
              key={step.id}
              className="grid grid-cols-[minmax(90px,0.8fr)_92px_minmax(0,1.2fr)] items-center gap-2 px-3 py-2.5 text-xs"
            >
              <div className="flex min-w-0 items-center gap-2">
                <StatusIcon status={step.status} />
                <span className="truncate font-medium">{step.label}</span>
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
                {statusLabel(step.status)}
              </span>
              <span className="truncate text-muted-foreground">{step.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
