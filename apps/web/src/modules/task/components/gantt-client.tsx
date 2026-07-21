"use client";

import { useMemo, useRef, useState } from "react";
import { cn } from "@vieroc/ui";
import { Calendar, Clock } from "lucide-react";
import { toast } from "sonner";
import { updateTaskAction } from "../task.actions";
import { useOptimisticTasks } from "./use-optimistic-tasks";
import type { TaskView } from "../task.view";
import type { Deviation } from "@/server/lib/deviations";

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  projectId: string;
  tasks: TaskView[];
  deviations: Pick<Deviation, "taskId" | "type" | "reason">[];
  projectStart: string | null;
  projectEnd: string | null;
}

const DAY_MS = 1000 * 60 * 60 * 24;

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/**
 * Draggable Gantt: drag a bar horizontally to shift its start/due dates
 * (snaps to whole days), applied optimistically via updateTaskAction. Deviation
 * bars are flagged red. Bars without dates are hidden (nothing to place).
 */
export function GanttClient({
  workspaceId,
  workspaceSlug,
  projectId,
  tasks,
  deviations,
  projectStart,
  projectEnd,
}: Props) {
  const { effectiveTasks, applyOptimistic } = useOptimisticTasks(tasks);
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ taskId: string; deltaDays: number } | null>(null);

  const { timelineStart, timelineEnd, totalDays, daysArray } = useMemo(() => {
    const min = projectStart ? new Date(projectStart + "T00:00:00") : new Date();
    const max = projectEnd ? new Date(projectEnd + "T00:00:00") : new Date();
    min.setDate(min.getDate() - 2);
    max.setDate(max.getDate() + 7);
    const start = min.getTime();
    const end = max.getTime();
    const days = Math.max(1, Math.ceil((end - start) / DAY_MS));
    const arr = Array.from({ length: days }, (_, i) => new Date(start + i * DAY_MS));
    return { timelineStart: start, timelineEnd: end, totalDays: days, daysArray: arr };
  }, [projectStart, projectEnd]);

  const timelineTasks = effectiveTasks.filter((t) => t.startDate || t.dueDate);
  const deviationIds = useMemo(() => new Set(deviations.map((d) => d.taskId)), [deviations]);
  const todayStr = ymd(new Date());

  function dayWidthPx(): number {
    const w = trackRef.current?.clientWidth ?? 0;
    return w / totalDays;
  }

  function onPointerDown(e: React.PointerEvent, task: TaskView) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const dw = dayWidthPx();

    function onMove(ev: PointerEvent) {
      const deltaDays = dw > 0 ? Math.round((ev.clientX - startX) / dw) : 0;
      setDrag({ taskId: task.id, deltaDays });
    }
    async function onUp(ev: PointerEvent) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const deltaDays = dw > 0 ? Math.round((ev.clientX - startX) / dw) : 0;
      setDrag(null);
      if (deltaDays === 0) return;

      const patch: { startDate?: string; dueDate?: string } = {};
      if (task.startDate) patch.startDate = addDays(task.startDate, deltaDays);
      if (task.dueDate) patch.dueDate = addDays(task.dueDate, deltaDays);

      applyOptimistic(task.id, patch as Partial<TaskView>);
      const result = await updateTaskAction({
        workspaceId,
        projectId,
        slug: workspaceSlug,
        taskId: task.id,
        data: patch,
      });
      if (!result.ok) {
        applyOptimistic(task.id, null);
        toast.error(result.error);
      } else {
        toast.success("Dates updated");
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-muted/10 p-4">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          Interactive Gantt — drag a bar to reschedule
        </span>
        <span className="text-[10px] text-muted-foreground">Showing {totalDays} days</span>
      </div>

      {timelineTasks.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground">
          <Clock className="mx-auto mb-3 h-8 w-8 text-primary opacity-40" />
          <p className="text-sm font-semibold">No scheduled tasks yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs">
            Add start and due dates to tasks to plot them on the Gantt chart.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Header */}
            <div className="flex bg-muted/5">
              <div className="w-1/3 shrink-0 border-r border-border p-3 text-xs font-bold text-muted-foreground">
                Task Title
              </div>
              <div className="flex flex-1">
                {daysArray.map((day, idx) => {
                  const isToday = ymd(day) === todayStr;
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  return (
                    <div
                      key={idx}
                      style={{ width: `${100 / totalDays}%` }}
                      className={cn(
                        "flex shrink-0 flex-col items-center justify-center border-r border-neutral-200/20 py-2 text-center text-[8px] font-semibold dark:border-neutral-800/20",
                        isToday
                          ? "bg-primary/10 font-extrabold text-primary"
                          : isWeekend
                            ? "bg-neutral-100/30 text-muted-foreground dark:bg-neutral-900/30"
                            : "text-muted-foreground"
                      )}
                    >
                      <span>{day.getDate()}</span>
                      <span>{day.toLocaleDateString("en", { weekday: "narrow" })}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-neutral-200/40 dark:divide-neutral-800/40">
              {timelineTasks.map((t) => {
                const tStart = t.startDate ? new Date(t.startDate + "T00:00:00").getTime() : timelineStart;
                const tEnd = t.dueDate ? new Date(t.dueDate + "T00:00:00").getTime() : timelineEnd;
                const leftPct = Math.max(
                  0,
                  Math.min(100, ((tStart - timelineStart) / (timelineEnd - timelineStart)) * 100)
                );
                const widthPct = Math.max(
                  2,
                  Math.min(100 - leftPct, ((tEnd - tStart) / (timelineEnd - timelineStart)) * 100)
                );
                const hasConflict = deviationIds.has(t.id);
                const dragOffsetPct =
                  drag?.taskId === t.id ? (drag.deltaDays / totalDays) * 100 : 0;

                return (
                  <div key={t.id} className="group flex hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50">
                    <div className="flex w-1/3 shrink-0 items-center justify-between border-r border-border p-3 text-xs font-semibold">
                      <span className="truncate">{t.title}</span>
                      {t.isMilestone && (
                        <span className="ml-1.5 shrink-0 rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-bold text-amber-500">
                          M
                        </span>
                      )}
                    </div>
                    <div ref={trackRef} className="relative flex flex-1 items-center overflow-hidden py-3">
                      <div className="pointer-events-none absolute inset-0 flex">
                        {daysArray.map((day, idx) => (
                          <div
                            key={idx}
                            style={{ width: `${100 / totalDays}%` }}
                            className={cn(
                              "h-full border-r border-neutral-200/10 dark:border-neutral-800/10",
                              ymd(day) === todayStr && "border-primary/20 bg-primary/5"
                            )}
                          />
                        ))}
                      </div>
                      <div
                        onPointerDown={(e) => onPointerDown(e, t)}
                        style={{
                          left: `${leftPct + dragOffsetPct}%`,
                          width: `${widthPct}%`,
                        }}
                        className={cn(
                          "relative flex h-6 cursor-grab touch-none items-center rounded-md border px-2 text-[10px] font-bold text-white shadow-sm transition-colors active:cursor-grabbing",
                          hasConflict
                            ? "border-red-600 bg-red-500 hover:bg-red-600"
                            : t.isMilestone
                              ? "border-amber-600 bg-amber-500 hover:bg-amber-600"
                              : "border-primary/80 bg-primary hover:bg-primary/90"
                        )}
                      >
                        <span className="truncate">
                          {drag?.taskId === t.id && drag.deltaDays !== 0
                            ? `${drag.deltaDays > 0 ? "+" : ""}${drag.deltaDays}d`
                            : t.title}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
