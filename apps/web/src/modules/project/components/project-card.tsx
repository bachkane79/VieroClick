import type { Project } from "@vieroc/types";
import Link from "next/link";

interface Props {
  project: Project;
  workspaceSlug: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-blue-100 text-blue-700",
  archived: "bg-red-100 text-red-700",
};

export function ProjectCard({ project, workspaceSlug }: Props) {
  return (
    <Link
      href={`/workspace/${workspaceSlug}/projects/${project.id}/overview`}
      className="block rounded-lg border bg-card p-4 hover:border-primary transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-sm leading-tight">{project.name}</h3>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[project.status] ?? ""}`}
        >
          {project.status}
        </span>
      </div>
      {project.description && (
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{project.description}</p>
      )}
      {project.targetEndDate && (
        <p className="text-xs text-muted-foreground mt-3">Due: {project.targetEndDate}</p>
      )}
    </Link>
  );
}
