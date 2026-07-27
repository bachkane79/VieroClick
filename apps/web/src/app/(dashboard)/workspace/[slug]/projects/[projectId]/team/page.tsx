import { notFound } from "next/navigation";
import { getWorkspace, listWorkspaceMembers } from "@/modules/workspace/workspace.service";
import { getProject } from "@/modules/project/project.service";
import { computeTeamMetrics } from "@/modules/member-score/member-score.service";
import { listMembers as listProjectMembers } from "@/modules/project-member/project-member.service";
import { requireActor } from "@/server/lib/context";
import { isProjectManager } from "@/server/lib/permissions";
import { NotFoundError } from "@/server/lib/errors";
import { TeamViewClient } from "./team-view-client";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectTeamPage({ params }: Props) {
  const { slug, projectId } = await params;

  let workspace;
  try {
    workspace = await getWorkspace(slug);
    await getProject(workspace.id, projectId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const ctx = await requireActor(workspace.id, projectId);
  const canManage = isProjectManager(ctx);

  const [members, projectMembers, workspaceMembers] = await Promise.all([
    computeTeamMetrics(projectId),
    listProjectMembers(workspace.id, projectId),
    listWorkspaceMembers(workspace.id),
  ]);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6 shadow-soft">
        <TeamViewClient
          members={members}
          canManage={canManage}
          workspaceId={workspace.id}
          projectId={projectId}
          slug={slug}
          projectMembers={projectMembers.map((pm) => ({
            id: pm.id,
            workspaceMemberId: pm.workspaceMemberId,
          }))}
          workspaceMembers={workspaceMembers.map((m) => ({
            id: m.id,
            fullName: m.fullName,
            email: m.email,
          }))}
        />
      </div>
    </div>
  );
}
