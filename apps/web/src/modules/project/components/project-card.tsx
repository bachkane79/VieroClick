import type { Project } from "@vieroc/types";
import Link from "next/link";
import { ArrowUpRight, CalendarClock } from "lucide-react";

interface Props {
  project: Project;
  workspaceSlug: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-secondary text-secondary-foreground",
  active: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  paused: "bg-amber-500/12 text-amber-700 dark:text-amber-400",
  completed: "bg-primary/12 text-primary",
  archived: "bg-muted text-muted-foreground",
};

export function ProjectCard({ project, workspaceSlug }: Props) {
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

      {/* Progress bar accent */}
      <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary/80">
        <div
          className="h-full rounded-full bg-tone-progress"
          style={{ width: project.status === "completed" ? "100%" : "65%" }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
            STATUS_COLORS[project.status] ?? "bg-secondary text-secondary-foreground"
          }`}
        >
          {project.status}
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
