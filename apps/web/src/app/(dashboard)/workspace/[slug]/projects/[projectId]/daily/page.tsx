import { notFound } from "next/navigation";
import { getWorkspace, listWorkspaceMembers } from "@/modules/workspace/workspace.service";
import { getProject } from "@/modules/project/project.service";
import { listProjectUpdates } from "@/modules/daily-update/daily-update.service";
import { listMembers as listProjectMembers } from "@/modules/project-member/project-member.service";
import { DailyViewClient } from "./daily-view-client";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectDailyPage({ params }: Props) {
  const { slug, projectId } = await params;

  let workspace;
  try {
    workspace = await getWorkspace(slug);
    await getProject(workspace.id, projectId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const [updates, workspaceMembers, projectMembers] = await Promise.all([
    listProjectUpdates(workspace.id, projectId),
    listWorkspaceMembers(workspace.id),
    listProjectMembers(workspace.id, projectId),
  ]);

  // Adapt database timestamps/strings to type requirements
  const adaptedUpdates = updates.map((u) => ({
    ...u,
    submittedAt: new Date(u.submittedAt),
  }));

  return (
    <div className="px-6 py-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Daily Standup Updates</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Log standup status and keep team members updated on progress
        </p>
      </div>

      <DailyViewClient
        workspaceId={workspace.id}
        projectId={projectId}
        workspaceSlug={slug}
        initialUpdates={adaptedUpdates}
        members={workspaceMembers.map((m) => ({
          id: m.id,
          fullName: m.fullName,
          email: m.email,
        }))}
        projectMembers={projectMembers.map((pm) => ({
          workspaceMemberId: pm.workspaceMemberId,
        }))}
      />
    </div>
  );
}
