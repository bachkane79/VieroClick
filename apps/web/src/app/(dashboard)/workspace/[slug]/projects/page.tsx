import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants, cn } from "@vieroc/ui";
import { Plus } from "lucide-react";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { listProjects } from "@/modules/project/project.service";
import { ProjectCard } from "@/modules/project/components/project-card";
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

  const projects = await listProjects(workspace.id);

  return (
    <div className="px-6 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">{workspace.name}</p>
        </div>
        <Link
          href={`/workspace/${slug}/projects/new`}
          className={cn(buttonVariants(), "gap-2")}
        >
          <Plus className="h-4 w-4" />
          New project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <h2 className="text-base font-semibold">No projects yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create the first project intake for this workspace.
          </p>
          <Link href={`/workspace/${slug}/projects/new`} className={cn(buttonVariants(), "mt-5")}>
            Create project
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project as unknown as Project}
              workspaceSlug={slug}
            />
          ))}
        </div>
      )}
    </div>
  );
}
