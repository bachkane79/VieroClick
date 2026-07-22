import { notFound } from "next/navigation";
import { getWorkspace, listWorkspaceMembers } from "@/modules/workspace/workspace.service";
import { NotFoundError } from "@/server/lib/errors";
import { TeamsManager } from "../teams-manager";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function WorkspaceTeamsSettingsPage({ params }: Props) {
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

  const teamMembers = members.map((m) => ({ id: m.id, fullName: m.fullName, email: m.email }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nhóm thành viên để chia sẻ quyền theo nhóm thay vì từng người.
        </p>
      </header>
      <TeamsManager workspaceId={workspace.id} slug={slug} members={teamMembers} />
    </div>
  );
}
