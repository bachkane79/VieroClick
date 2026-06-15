import { notFound } from "next/navigation";
import { getWorkspace, listWorkspaceMembers } from "@/modules/workspace/workspace.service";
import { NotFoundError } from "@/server/lib/errors";
import { WorkspaceSettingsForm } from "./settings-form";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function WorkspaceSettingsPage({ params }: Props) {
  const { slug } = await params;

  let workspace;
  let members;
  try {
    workspace = await getWorkspace(slug);
    members = await listWorkspaceMembers(workspace.id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Workspace Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage workspace details, invitations, and member access roles.
        </p>
      </div>

      <WorkspaceSettingsForm workspace={workspace} initialMembers={members} />
    </div>
  );
}
