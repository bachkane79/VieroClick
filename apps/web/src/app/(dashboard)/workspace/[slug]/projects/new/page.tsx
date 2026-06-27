import { notFound } from "next/navigation";
import { getWorkspace, listWorkspaceMembers } from "@/modules/workspace/workspace.service";
import { ProjectIntakeForm } from "@/modules/project/components/project-intake-form";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function NewProjectPage({ params }: Props) {
  const { slug } = await params;

  let workspace;
  try {
    workspace = await getWorkspace(slug);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const members = (await listWorkspaceMembers(workspace.id)).map((member) => ({
    id: member.id,
    role: member.role,
    email: member.email,
    fullName: member.fullName,
    title: member.title,
    department: member.department,
  }));

  return (
    <div>
      <div className="border-b px-6 py-4">
        <h1 className="text-xl font-bold tracking-tight">New project intake</h1>
        <p className="mt-1 text-sm text-muted-foreground">{workspace.name}</p>
      </div>
      <ProjectIntakeForm workspaceId={workspace.id} workspaceSlug={slug} members={members} />
    </div>
  );
}
