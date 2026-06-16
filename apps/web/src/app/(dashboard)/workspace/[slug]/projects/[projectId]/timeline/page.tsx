import { notFound } from "next/navigation";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { getProject, detectPlanDeviations } from "@/modules/project/project.service";
import { listBoard } from "@/modules/task/task.service";
import { toTaskView } from "@/modules/task/task.view";
import { NotFoundError } from "@/server/lib/errors";
import {
  AlertTriangle,
  AlertOctagon,
  Calendar,
  Clock,
  ArrowRight,
  TrendingDown,
} from "lucide-react";
import { buttonVariants } from "@vieroc/ui";
import Link from "next/link";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectTimelinePage({ params }: Props) {
  const { slug, projectId } = await params;

  let workspace;
  let project;
  try {
    workspace = await getWorkspace(slug);
    project = await getProject(workspace.id, projectId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const [{ tasks, dependencies }, deviations] = await Promise.all([
    listBoard(workspace.id, projectId),
    detectPlanDeviations(workspace.id, projectId),
  ]);

  const taskList = tasks.map(toTaskView);

  // Filter tasks that have at least one date defined for timeline display
  const timelineTasks = taskList.filter((t) => t.startDate || t.dueDate);

  // Find min and max dates across all tasks to bound the timeline
  let minDate = project.startDate ? new Date(project.startDate) : new Date();
  let maxDate = project.targetEndDate ? new Date(project.targetEndDate) : new Date();

  // Buffer by a few days
  minDate.setDate(minDate.getDate() - 2);
  maxDate.setDate(maxDate.getDate() + 7);

  const timelineStart = minDate.getTime();
  const timelineEnd = maxDate.getTime();
  const totalDays = Math.ceil((timelineEnd - timelineStart) / (1000 * 60 * 60 * 24)) || 30;

  // Generate array of days/dates to render headers
  const daysArray = Array.from({ length: totalDays }, (_, i) => {
    const d = new Date(timelineStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="px-6 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Timeline & Gantt Chart</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Visualize project schedule dependencies and deviations
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gantt View Chart */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-neutral-200/50 dark:border-neutral-800/50 bg-card overflow-hidden shadow-sm">
            <div className="p-4 border-b border-neutral-200/50 dark:border-neutral-800/50 bg-muted/10 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Interactive Gantt Scheduler
              </span>
              <span className="text-[10px] text-muted-foreground">
                Showing {totalDays} days
              </span>
            </div>

            {timelineTasks.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-3 opacity-40 text-primary" />
                <p className="text-sm font-semibold">No scheduled tasks yet</p>
                <p className="text-xs mt-1 max-w-sm mx-auto">
                  Add start and due dates to your tasks inside the Kanban board to plot them on the Gantt chart.
                </p>
                <Link
                  href={`/workspace/${slug}/projects/${projectId}/board`}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary font-bold hover:underline"
                >
                  Go to Kanban Board <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[800px] divide-y divide-neutral-200/40 dark:divide-neutral-800/40">
                  {/* Timeline header */}
                  <div className="flex bg-muted/5">
                    <div className="w-1/3 shrink-0 p-3 text-xs font-bold text-muted-foreground border-r border-neutral-200/50 dark:border-neutral-800/50">
                      Task Title
                    </div>
                    <div className="flex-1 flex overflow-hidden">
                      {daysArray.map((day, idx) => {
                        const isToday =
                          new Date().toDateString() === day.toDateString();
                        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                        return (
                          <div
                            key={idx}
                            style={{ width: `${100 / totalDays}%` }}
                            className={`shrink-0 text-[8px] font-semibold text-center py-2 flex flex-col items-center justify-center border-r border-neutral-200/20 dark:border-neutral-800/20 ${
                              isToday
                                ? "bg-primary/10 text-primary font-extrabold"
                                : isWeekend
                                  ? "bg-neutral-100/30 dark:bg-neutral-900/30 text-muted-foreground"
                                  : "text-muted-foreground"
                            }`}
                          >
                            <span>{day.getDate()}</span>
                            <span>{day.toLocaleDateString("en", { weekday: "narrow" })}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tasks Rows */}
                  {timelineTasks.map((t) => {
                    const tStart = t.startDate ? new Date(t.startDate).getTime() : timelineStart;
                    const tEnd = t.dueDate ? new Date(t.dueDate).getTime() : timelineEnd;

                    // Calculate percentages
                    const leftPct = Math.max(
                      0,
                      Math.min(
                        100,
                        ((tStart - timelineStart) / (timelineEnd - timelineStart)) * 100
                      )
                    );
                    const widthPct = Math.max(
                      2,
                      Math.min(
                        100 - leftPct,
                        ((tEnd - tStart) / (timelineEnd - timelineStart)) * 100
                      )
                    );

                    // Check if this task has a deviation
                    const hasConflict = deviations.some((d) => d.taskId === t.id);
                    const isMilestone = t.isMilestone;

                    return (
                      <div key={t.id} className="flex hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50 group">
                        <div className="w-1/3 shrink-0 p-3 text-xs font-semibold truncate border-r border-neutral-200/50 dark:border-neutral-800/50 flex items-center justify-between">
                          <span className="truncate">{t.title}</span>
                          {isMilestone && (
                            <span className="shrink-0 ml-1.5 px-1.5 py-0.5 text-[8px] font-bold bg-amber-500/10 text-amber-500 rounded border border-amber-500/20">
                              M
                            </span>
                          )}
                        </div>
                        <div className="flex-1 relative py-3 overflow-hidden flex items-center">
                          {/* Grid background column highlights for weekend/today */}
                          <div className="absolute inset-0 flex pointer-events-none">
                            {daysArray.map((day, idx) => {
                              const isToday =
                                new Date().toDateString() === day.toDateString();
                              return (
                                <div
                                  key={idx}
                                  style={{ width: `${100 / totalDays}%` }}
                                  className={`h-full border-r border-neutral-200/10 dark:border-neutral-800/10 ${
                                    isToday ? "bg-primary/5 border-primary/20" : ""
                                  }`}
                                />
                              );
                            })}
                          </div>

                          {/* Task Bar */}
                          <div
                            style={{
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                            }}
                            className={`relative h-6 rounded-md shadow-sm border flex items-center px-2 text-[10px] font-bold text-white transition-all cursor-pointer hover:scale-[1.02] ${
                              hasConflict
                                ? "bg-red-500 hover:bg-red-600 border-red-600"
                                : isMilestone
                                  ? "bg-amber-500 hover:bg-amber-600 border-amber-600"
                                  : "bg-primary hover:bg-primary-hover border-primary/80"
                            }`}
                          >
                            <span className="truncate">{t.title}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Plan Deviations Panel */}
        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-200/50 dark:border-neutral-800/50 bg-card p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-red-500" />
              Schedule Deviations
            </h3>

            {deviations.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                <span className="inline-block px-2.5 py-1 text-xs font-bold bg-green-500/10 text-green-500 rounded-full mb-2 border border-green-500/20">
                  Healthy
                </span>
                <p className="text-xs font-semibold">No deviations detected</p>
                <p className="text-[10px] mt-0.5">
                  Timeline milestones and dependencies are executing as planned.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {deviations.map((dev, idx) => {
                  const Icon = dev.type === "milestone_at_risk" ? AlertOctagon : AlertTriangle;
                  return (
                    <div
                      key={idx}
                      className={`rounded-xl border p-4 text-xs flex gap-3 ${
                        dev.type === "milestone_at_risk"
                          ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30 text-red-950 dark:text-red-300"
                          : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30 text-amber-950 dark:text-amber-300"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0 mt-0.5 text-current" />
                      <div className="space-y-1">
                        <p className="font-bold capitalize leading-tight">
                          {dev.type.replace("_", " ")}
                        </p>
                        <p className="text-[11px] leading-normal opacity-90">{dev.reason}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
