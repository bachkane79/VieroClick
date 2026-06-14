import { notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { getWorkspaceBySlug } from "@/modules/workspace/queries";
import { getProjectsByWorkspace } from "@/modules/project/queries";
import { ProjectCard } from "@/modules/project/components/project-card";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function WorkspacePage({ params }: Props) {
  const { slug } = await params;
  const session = await auth();

  const workspace = await getWorkspaceBySlug(slug, session!.user.id);
  if (!workspace) notFound();

  const projects = await getProjectsByWorkspace(workspace.id);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{workspace.name}</h1>
        <p className="text-muted-foreground text-sm mt-1">{workspace.slug}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} workspaceSlug={slug} />
        ))}
      </div>
    </div>
  );
}
