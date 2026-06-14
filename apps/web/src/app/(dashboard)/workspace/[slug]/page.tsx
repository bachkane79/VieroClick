import { notFound } from "next/navigation";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { listProjects } from "@/modules/project/project.service";
import { ProjectCard } from "@/modules/project/components/project-card";
import { NotFoundError } from "@/server/lib/errors";
import type { Project } from "@vieroc/types";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function WorkspacePage({ params }: Props) {
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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{workspace.name}</h1>
        <p className="text-muted-foreground text-sm mt-1">{workspace.slug}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project as unknown as Project}
            workspaceSlug={slug}
          />
        ))}
      </div>
    </div>
  );
}
