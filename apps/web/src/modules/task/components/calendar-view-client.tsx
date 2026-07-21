"use client";

import { useMemo, useState } from "react";
import { Button, cn } from "@vieroc/ui";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { filterTasks, type PhaseNode } from "../task-grouping";
import { PRIORITY_FLAG_COLORS, statusColor } from "../status-colors";
import { TaskDetailDrawer } from "./task-detail-drawer";
import { useOptimisticTasks } from "./use-optimistic-tasks";
import { useViewPrefs } from "./use-view-prefs";
import { ViewControls } from "./view-controls";
import type { MemberOptionView, TaskDependencyView, TaskStatusView, TaskView } from "../task.view";
import type { TaskAttachmentView } from "@/modules/file/file.view";

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  projectId: string;
  tasks: TaskView[];
  statuses: TaskStatusView[];
  members: MemberOptionView[];
  dependencies: TaskDependencyView[];
  attachments: TaskAttachmentView[];
  phases: PhaseNode[];
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function CalendarViewClient({
  workspaceId,
  workspaceSlug,
  projectId,
  tasks,
  statuses,
  members,
  dependencies,
  attachments,
  phases,
}: Props) {
  const { effectiveTasks } = useOptimisticTasks(tasks);
  const api = useViewPrefs(projectId, "none");
  const { prefs } = api;

  const [open, setOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskView | null>(null);
  // Month cursor as {year, month} — start on the current month.
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);

  const currentSelectedTask = useMemo(() => {
    if (!selectedTask) return null;
    return effectiveTasks.find((t) => t.id === selectedTask.id) ?? selectedTask;
  }, [effectiveTasks, selectedTask]);

  const tasksByDue = useMemo(() => {
    const filtered = filterTasks(effectiveTasks, prefs.filter);
    const map = new Map<string, TaskView[]>();
    for (const t of filtered) {
      if (!t.dueDate) continue;
      const list = map.get(t.dueDate) ?? [];
      list.push(t);
      map.set(t.dueDate, list);
    }
    return map;
  }, [effectiveTasks, prefs.filter]);

  const undated = useMemo(
    () => filterTasks(effectiveTasks, prefs.filter).filter((t) => !t.dueDate),
    [effectiveTasks, prefs.filter]
  );

  // Build a 6x7 grid starting on the Monday on/before the 1st of the month.
  const weeks = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const offset = (first.getDay() + 6) % 7; // days since Monday
    const start = new Date(cursor.year, cursor.month, 1 - offset);
    const grid: Date[][] = [];
    for (let w = 0; w < 6; w++) {
      const row: Date[] = [];
      for (let d = 0; d < 7; d++) {
        row.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d));
      }
      grid.push(row);
    }
    return grid;
  }, [cursor]);

  const monthLabel = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(
    new Date(cursor.year, cursor.month, 1)
  );
  const todayStr = ymd(now);

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const next = new Date(c.year, c.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  function openTask(task: TaskView) {
    setSelectedTask(task);
    setOpen(true);
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ViewControls api={api} statuses={statuses} members={members} showGroupBy={false} />
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[140px] text-center text-sm font-semibold">{monthLabel}</span>
            <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftMonth(1)} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setCursor({ year: now.getFullYear(), month: now.getMonth() })}
            >
              Today
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
          <div className="grid grid-cols-7 border-b bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-2 py-1.5 text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {weeks.flat().map((date, i) => {
              const key = ymd(date);
              const inMonth = date.getMonth() === cursor.month;
              const dayTasks = tasksByDue.get(key) ?? [];
              const isToday = key === todayStr;
              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-[104px] border-b border-r p-1.5",
                    i % 7 === 6 && "border-r-0",
                    !inMonth && "bg-muted/20"
                  )}
                >
                  <div className="mb-1 flex justify-end">
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                        isToday
                          ? "bg-primary font-semibold text-primary-foreground"
                          : inMonth
                            ? "text-foreground"
                            : "text-muted-foreground/50"
                      )}
                    >
                      {date.getDate()}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {dayTasks.slice(0, 4).map((task) => {
                      const color = statusColor(statusById.get(task.statusId)?.type);
                      return (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => openTask(task)}
                          className="flex w-full items-center gap-1 rounded border bg-background px-1.5 py-1 text-left text-[11px] transition-colors hover:border-primary/60"
                        >
                          <span className={cn("h-2 w-2 shrink-0 rounded-sm", color.dot)} />
                          <Flag
                            className={cn(
                              "h-2.5 w-2.5 shrink-0",
                              PRIORITY_FLAG_COLORS[task.priority] ?? "text-neutral-400"
                            )}
                          />
                          <span className="truncate">{task.title}</span>
                        </button>
                      );
                    })}
                    {dayTasks.length > 4 && (
                      <p className="px-1 text-[10px] text-muted-foreground">
                        +{dayTasks.length - 4} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {undated.length > 0 && (
          <div className="rounded-lg border bg-card p-3 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              No due date ({undated.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {undated.map((task) => {
                const color = statusColor(statusById.get(task.statusId)?.type);
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => openTask(task)}
                    className="flex items-center gap-1.5 rounded border bg-background px-2 py-1 text-xs transition-colors hover:border-primary/60"
                  >
                    <span className={cn("h-2 w-2 shrink-0 rounded-sm", color.dot)} />
                    <span className="max-w-[200px] truncate">{task.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <TaskDetailDrawer
        open={open}
        onOpenChange={setOpen}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        task={currentSelectedTask}
        tasks={effectiveTasks}
        statuses={statuses}
        members={members}
        dependencies={dependencies}
        attachments={attachments}
        onSelectTask={setSelectedTask}
      />
    </>
  );
}
