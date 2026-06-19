import { notFound } from "next/navigation";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { getProject } from "@/modules/project/project.service";
import { NotFoundError } from "@/server/lib/errors";
import { ProjectNav } from "./project-nav";

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
      {/* Project Header Banner */}
      <div className="px-6 py-5 border-b border-border bg-card/25">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <span>{workspace.name}</span>
              <span>/</span>
              <span>Projects</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground truncate mt-1">
              {project.name}
            </h1>
            {project.description && (
              <p className="text-sm text-muted-foreground truncate mt-1 max-w-2xl">
                {project.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Status:</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 capitalize">
              {project.status}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <ProjectNav slug={slug} projectId={projectId} />

      {/* Content Area */}
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
