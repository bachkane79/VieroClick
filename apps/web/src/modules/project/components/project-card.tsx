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
      className="group flex flex-col rounded-xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold tracking-tight leading-tight group-hover:text-primary transition-colors">
          {project.name}
        </h3>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
      </div>

      {project.description && (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {project.description}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t border-border">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
            STATUS_COLORS[project.status] ?? "bg-secondary text-secondary-foreground"
          }`}
        >
          {project.status}
        </span>
        {project.targetEndDate && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            {project.targetEndDate}
          </span>
        )}
      </div>
    </Link>
  );
}
