import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { getProject } from "@/modules/project/project.service";
import { NotFoundError } from "@/server/lib/errors";
import { ProjectNav } from "./project-nav";
import { AgentActivityTray } from "./agent-activity-tray";

interface Props {
  children: React.ReactNode;
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectLayout({ children, params }: Props) {
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

  return (
    <div className="flex flex-col h-full min-h-screen bg-background text-foreground">
      {/* Compact ClickUp-style breadcrumb row: Workspace / Projects / Name + status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/25 px-6 py-2.5">
        <nav className="flex min-w-0 items-center gap-1.5 text-[13px]">
          <Link
            href={`/workspace/${slug}/projects`}
            className="shrink-0 font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {workspace.name}
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <Link
            href={`/workspace/${slug}/projects`}
            className="shrink-0 font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Projects
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="truncate font-semibold text-foreground">{project.name}</span>
          <span className="ml-2 inline-flex shrink-0 items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold capitalize text-primary">
            {project.status}
          </span>
        </nav>
        {project.description && (
          <p className="hidden max-w-md truncate text-xs text-muted-foreground lg:block">
            {project.description}
          </p>
        )}
      </div>

      {/* View tabs */}
      <ProjectNav slug={slug} projectId={projectId} />

      {/* Content Area */}
      <div className="flex-1 min-h-0">{children}</div>
      <AgentActivityTray projectId={projectId} />
    </div>
  );
}
