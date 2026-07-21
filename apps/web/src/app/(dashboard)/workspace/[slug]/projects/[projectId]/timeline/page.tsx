import { notFound } from "next/navigation";
import { AlertOctagon, AlertTriangle, TrendingDown } from "lucide-react";
import { detectPlanDeviations } from "@/modules/project/project.service";
import { GanttClient } from "@/modules/task/components/gantt-client";
import { loadProjectViewData } from "@/modules/task/task-page-data";
import { NotFoundError } from "@/server/lib/errors";
import { ProjectWorkHeader } from "@/modules/task/components/project-work-header";
import { getLocale } from "@/lib/i18n/server";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectTimelinePage({ params }: Props) {
  const { slug, projectId } = await params;

  let data;
  let deviations;
  try {
    data = await loadProjectViewData(slug, projectId);
    deviations = await detectPlanDeviations(data.workspace.id, projectId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const locale = await getLocale();

  return (
    <div className="min-w-0">
      <ProjectWorkHeader
        view="gantt"
        projectName={data.project.name}
        taskCount={data.tasks.length}
        locale={locale}
      />
      <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <GanttClient
            workspaceId={data.workspace.id}
            workspaceSlug={slug}
            projectId={projectId}
            tasks={data.tasks}
            deviations={deviations}
            projectStart={data.project.startDate}
            projectEnd={data.project.targetEndDate}
          />
        </div>

        <div className="space-y-4">
          <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Schedule Deviations
            </h3>

            {deviations.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                <span className="mb-2 inline-block rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-1 text-xs font-bold text-green-500">
                  Healthy
                </span>
                <p className="text-xs font-semibold">No deviations detected</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deviations.map((dev, idx) => {
                  const Icon = dev.type === "milestone_at_risk" ? AlertOctagon : AlertTriangle;
                  return (
                    <div
                      key={idx}
                      className={
                        dev.type === "milestone_at_risk"
                          ? "flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-950 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-300"
                          : "flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300"
                      }
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-current" />
                      <div className="space-y-1">
                        <p className="font-bold capitalize leading-tight">
                          {dev.type.replace(/_/g, " ")}
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
