import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants, cn } from "@vieroc/ui";
import { Activity, CheckCircle2, FolderKanban, Layers, Plus } from "lucide-react";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { getWorkspaceProjectStats, listProjects } from "@/modules/project/project.service";
import { ProjectCard } from "@/modules/project/components/project-card";
import { getTranslations } from "next-intl/server";
import { NotFoundError } from "@/server/lib/errors";
import type { Project } from "@vieroc/types";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProjectsPage({ params }: Props) {
  const { slug } = await params;

  let workspace;
  try {
    workspace = await getWorkspace(slug);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const [projects, stats] = await Promise.all([
    listProjects(workspace.id),
    getWorkspaceProjectStats(workspace.id),
  ]);
  const t = await getTranslations();

  const activeCount = projects.filter((p) => p.status === "active").length;
  const completedCount = projects.filter((p) => p.status === "completed").length;
  const draftCount = projects.filter((p) => p.status === "draft").length;

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="rounded-3xl border border-border bg-surface p-6 shadow-soft lg:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {workspace.name}
            </p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">
              {t("projectsPage.title")}
            </h1>
          </div>
          <Link
            href={`/workspace/${slug}/projects/new`}
            className={cn(buttonVariants({ variant: "dark" }), "gap-1.5 px-4 text-xs")}
          >
            <Plus className="h-4 w-4" />
            {t("projectsPage.newProject")}
          </Link>
        </div>

        {/* Tinted Stat Tiles */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat
            label={t("projectsPage.stat.total")}
            value={projects.length}
            accent="primary"
            trend={t("projectsPage.trend.all")}
            icon="projects"
          />
          <Stat
            label={t("projectsPage.stat.active")}
            value={activeCount}
            accent="success"
            trend={t("projectsPage.trend.active")}
            icon="active"
          />
          <Stat
            label={t("projectsPage.stat.completed")}
            value={completedCount}
            accent="mint"
            trend={t("projectsPage.trend.done")}
            icon="completed"
          />
          <Stat
            label={t("projectsPage.stat.draft")}
            value={draftCount}
            accent="peach"
            trend={t("projectsPage.trend.drafts")}
            icon="drafts"
          />
        </div>

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-card p-10 text-center">
            <h2 className="text-sm font-semibold">{t("projectsPage.empty.title")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t("projectsPage.empty.sub")}</p>
            <Link
              href={`/workspace/${slug}/projects/new`}
              className={cn(buttonVariants({ variant: "dark" }), "mt-4")}
            >
              {t("projectsPage.createProject")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project as unknown as Project}
                workspaceSlug={slug}
                stats={stats.get(project.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const DEFAULT_STYLE = {
  text: "text-foreground",
  bg: "bg-card border-border/80",
  badge: "bg-secondary text-muted-foreground",
};

const ACCENT: Record<string, { text: string; bg: string; badge: string }> = {
  primary: {
    text: "text-primary",
    bg: "bg-primary/5 border-primary/15",
    badge: "bg-primary/10 text-primary",
  },
  success: {
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/5 border-emerald-500/15",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  mint: {
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/5 border-emerald-500/15",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  peach: {
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/5 border-amber-500/15",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
};

const STAT_ICONS: Record<
  string,
  { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }
> = {
  projects: { bg: "bg-primary/10", text: "text-primary", icon: FolderKanban },
  active: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    icon: Activity,
  },
  completed: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    icon: CheckCircle2,
  },
  drafts: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", icon: Layers },
};

function Stat({
  label,
  value,
  accent,
  trend,
  icon,
}: {
  label: string;
  value: number;
  accent: string;
  trend?: string;
  icon?: "projects" | "active" | "completed" | "drafts";
}) {
  const style = ACCENT[accent] ?? DEFAULT_STYLE;
  const iconMeta = icon ? STAT_ICONS[icon] : undefined;
  const IconComp = iconMeta?.icon;

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        style.bg
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {IconComp && (
            <span
              className={cn(
                "grid h-6 w-6 place-items-center rounded-full text-xs",
                iconMeta.bg,
                iconMeta.text
              )}
            >
              <IconComp className="h-3.5 w-3.5" />
            </span>
          )}
          <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        </div>
        {trend && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
              style.badge
            )}
          >
            {trend}
          </span>
        )}
      </div>
      <p className={cn("mt-2 text-2xl font-bold tabular-nums tracking-tight", style.text)}>
        {value}
      </p>
    </div>
  );
}
