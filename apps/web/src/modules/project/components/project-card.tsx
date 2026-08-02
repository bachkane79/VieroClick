import type { Project } from "@vieroc/types";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowUpRight, CalendarClock } from "lucide-react";

interface Props {
  project: Project;
  workspaceSlug: string;
  /** Real task counts for this project (from `getWorkspaceProjectStats`). The
   *  bar used to be a hardcoded 65%, which read as progress but was decoration. */
  stats?: { total: number; done: number };
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-secondary text-secondary-foreground",
  active: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  paused: "bg-amber-500/12 text-amber-700 dark:text-amber-400",
  completed: "bg-primary/12 text-primary",
  archived: "bg-muted text-muted-foreground",
};

/** Server Component: its only consumer (`workspace/[slug]/projects/page.tsx`)
 *  is one too, so the status label resolves from the catalog here rather than
 *  rendering the raw DB enum. */
export async function ProjectCard({ project, workspaceSlug, stats }: Props) {
  const t = await getTranslations();
  const total = stats?.total ?? 0;
  const done = stats?.done ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <Link
      href={`/workspace/${workspaceSlug}/projects/${project.id}/overview`}
      className="group flex flex-col rounded-2xl border border-border bg-card p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight leading-snug text-foreground transition-colors group-hover:text-primary">
          {project.name}
        </h3>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
      </div>

      {project.description && (
        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
          {project.description}
        </p>
      )}

      {/* Task completion */}
      <div className="mt-3.5 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary/80">
          <div className="h-full rounded-full bg-tone-progress" style={{ width: `${pct}%` }} />
        </div>
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
          {total > 0 ? `${done}/${total}` : t("projectsPage.noTasks")}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            STATUS_COLORS[project.status] ?? "bg-secondary text-secondary-foreground"
          }`}
        >
          {(t as unknown as (k: string) => string)(`project.status.${project.status}`)}
        </span>
        {project.targetEndDate && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <CalendarClock className="h-3 w-3 text-primary/70" />
            {project.targetEndDate}
          </span>
        )}
      </div>
    </Link>
  );
}
