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
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6 shadow-soft">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
            <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                <TrendingDown className="h-4 w-4 text-destructive" />
                Schedule Deviations
              </h3>

              {deviations.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/80 p-6 text-center text-muted-foreground">
                  <span className="mb-2 inline-block rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    Healthy
                  </span>
                  <p className="text-xs font-semibold">No deviations detected</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {deviations.map((dev, idx) => {
                    const Icon = dev.type === "milestone_at_risk" ? AlertOctagon : AlertTriangle;
                    return (
                      <div
                        key={idx}
                        className={
                          dev.type === "milestone_at_risk"
                            ? "flex gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive"
                            : "flex gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400"
                        }
                      >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="space-y-0.5">
                          <p className="font-bold capitalize leading-tight">
                            {dev.type.replace(/_/g, " ")}
                          </p>
                          <p className="text-[11px] leading-relaxed opacity-90">{dev.reason}</p>
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
    </div>
  );
}
