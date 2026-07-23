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
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="rounded-3xl border border-border bg-surface p-6 lg:p-8 shadow-soft space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{workspace.name}</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">New project intake</h1>
        </div>
        <ProjectIntakeForm workspaceId={workspace.id} workspaceSlug={slug} members={members} />
      </div>
    </div>
  );
}
