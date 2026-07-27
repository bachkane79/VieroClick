import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { buttonVariants, cn } from "@vieroc/ui";
import { CheckCircle2, Kanban, ListChecks, Sparkles } from "lucide-react";
import { getWorkspace, listWorkspaceMembers } from "@/modules/workspace/workspace.service";
import { getProject } from "@/modules/project/project.service";
import { computeProjectDashboard } from "@/modules/project/project.dashboard";
import { requireActor } from "@/server/lib/context";
import {
  AiLeaderBanner,
  AiLeaderSettingsMenu,
} from "@/modules/project/components/ai-leader-controls";
import { DeleteProjectButton } from "@/modules/project/components/delete-project-button";
import { NotFoundError } from "@/server/lib/errors";
import { ShareDialog } from "@/modules/permission/components/share-dialog";
import { DashboardToolbar } from "../dashboard/dashboard-toolbar";
import { ProjectDashboardPanels } from "./dashboard-panels";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export const dynamic = "force-dynamic";

/**
 * Merged Overview (redesign v2) — the former "Tổng quan" and "Trang tổng quan"
 * are now one tab. The live dashboard (AI executive summary + 2×2 quadrants) is
 * the core; the intake/scope block and the signature Health & Velocity radial
 * are kept. Duplicated overview widgets (stat strip, phase/goal progress, member
 * list) were dropped — those metrics live in the dashboard panels, and
 * goals/milestones live under the "Rủi ro & Cột mốc" tab.
 */
export default async function ProjectOverviewPage({ params }: Props) {
  const { slug, projectId } = await params;
  const t = await getTranslations();

  let workspace;
  let project;
  try {
    workspace = await getWorkspace(slug);
    project = await getProject(workspace.id, projectId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  await requireActor(workspace.id, projectId);

  const [workspaceMembers, data] = await Promise.all([
    listWorkspaceMembers(workspace.id),
    computeProjectDashboard(projectId),
  ]);

  const base = `/workspace/${slug}/projects/${projectId}`;
  const completionPct = Math.round((data.health.completionPct || 0) * 100);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="rounded-3xl border border-border bg-surface p-6 shadow-soft lg:p-8">
        <AiLeaderBanner
          workspaceId={workspace.id}
          projectId={projectId}
          slug={slug}
          aiEnabled={project.aiEnabled}
        />
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {workspace.name}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              {project.name}
            </h1>
            {project.description && (
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {project.description}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ShareDialog
              workspaceId={workspace.id}
              resourceType="project"
              resourceId={projectId}
              resourceName={project.name}
              members={workspaceMembers.map((m) => ({
                id: m.id,
                fullName: m.fullName,
                email: m.email,
              }))}
            />
            <AiLeaderSettingsMenu
              workspaceId={workspace.id}
              projectId={projectId}
              slug={slug}
              aiEnabled={project.aiEnabled}
            />
            <DeleteProjectButton
              workspaceId={workspace.id}
              projectId={projectId}
              slug={slug}
              projectName={project.name}
            />
            <Link
              href={`${base}/tasks`}
              className={cn(buttonVariants({ variant: "outline" }), "gap-1.5 text-xs")}
            >
              <ListChecks className="h-3.5 w-3.5" />
              {t("project.overview.navTasks")}
            </Link>
            <Link
              href={`${base}/board`}
              className={cn(buttonVariants({ variant: "dark" }), "gap-1.5 px-4 text-xs")}
            >
              <Kanban className="h-3.5 w-3.5" />
              {t("project.overview.navBoard")}
            </Link>
          </div>
        </div>

        <DashboardToolbar askAiHref={`${base}/ai`} />

        {/* Balanced 2-column grid: live dashboard + intake on the left, the
            signature Health & Velocity radial on the right. */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Main Left Column */}
          <div className="min-w-0 space-y-6">
            <ProjectDashboardPanels data={data} base={base} />

            <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-soft">
              <h2 className="text-sm font-semibold text-foreground">
                {t("project.overview.intakeTitle")}
              </h2>
              <div className="mt-3.5 grid gap-4">
                <OverviewBlock
                  title={t("project.overview.intake.scope")}
                  items={project.scope ? [project.scope] : []}
                  prose
                />
                <OverviewBlock title={t("project.overview.intake.goals")} items={project.goals} />
                <OverviewBlock
                  title={t("project.overview.intake.constraints")}
                  items={project.constraints}
                />
                <OverviewBlock
                  title={t("project.overview.intake.deliverables")}
                  items={project.expectedDeliverables}
                />
                <OverviewBlock
                  title={t("project.overview.intake.context")}
                  items={project.initialContext ? [project.initialContext] : []}
                  prose
                />
              </div>
            </section>
          </div>

          {/* Right Sidebar Column (360px) */}
          <div className="space-y-6">
            {/* Trend & Health Radial Glow Petal Widget (signature UI — keep). */}
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-soft">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {t("project.overview.healthVelocityTitle")}
                </h2>
                <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                  {t("project.overview.liveSync")}
                </span>
              </div>

              <div className="relative flex items-center justify-center py-4">
                <div className="relative flex h-36 w-36 items-center justify-center">
                  <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-tr from-orange-400/20 via-amber-300/30 to-emerald-400/20 opacity-70 blur-xl" />

                  <div className="absolute top-1 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/30 text-[10px] font-bold text-emerald-800 blur-md dark:text-emerald-200">
                    <span className="translate-y-1">{completionPct}%</span>
                  </div>
                  <div className="absolute right-1 flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/30 text-[10px] font-bold text-amber-800 blur-md dark:text-amber-200">
                    <span className="-translate-x-1">94%</span>
                  </div>
                  <div className="absolute bottom-1 flex h-14 w-14 items-center justify-center rounded-full bg-orange-400/30 text-[10px] font-bold text-orange-800 blur-md dark:text-orange-200">
                    <span className="-translate-y-1">88%</span>
                  </div>
                  <div className="absolute left-1 flex h-14 w-14 items-center justify-center rounded-full bg-purple-400/30 text-[10px] font-bold text-purple-800 blur-md dark:text-purple-200">
                    <span className="translate-x-1">91%</span>
                  </div>

                  <div className="relative z-10 grid h-10 w-10 place-items-center rounded-full border border-border/80 bg-card shadow-md">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-1 text-center">
                <div className="rounded-xl bg-surface-subtle p-2">
                  <p className="text-[10px] font-medium text-muted-foreground">
                    {t("project.overview.velocityLabel")}
                  </p>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {t("project.overview.velocityStable")}
                  </p>
                </div>
                <div className="rounded-xl bg-surface-subtle p-2">
                  <p className="text-[10px] font-medium text-muted-foreground">
                    {t("project.overview.focusLabel")}
                  </p>
                  <p className="text-xs font-bold text-primary">{t("project.overview.focusValue")}</p>
                </div>
              </div>
            </div>

            {/* Status / deadline box */}
            <aside className="rounded-2xl border border-border/80 bg-card p-4 shadow-soft">
              <div className="rounded-xl border border-border bg-surface-subtle p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("project.statusLabel")}</span>
                  <span className="font-semibold text-primary">
                    {(t as unknown as (k: string) => string)(`project.status.${project.status}`)}
                  </span>
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="text-muted-foreground">{t("project.deadlineLabel")}</span>
                  <span className="font-medium">
                    {project.targetEndDate ?? t("project.overview.notSet")}
                  </span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewBlock({
  title,
  items,
  prose,
}: {
  title: string;
  items: string[];
  prose?: boolean;
}) {
  const t = useTranslations();
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t("project.overview.notDefined")}</p>
      ) : prose ? (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
          {items[0]}
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li
              key={item}
              className="rounded-xl border border-border bg-surface-subtle px-3 py-2 text-sm"
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
