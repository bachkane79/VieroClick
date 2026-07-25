import { notFound } from "next/navigation";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { computeWorkspaceTeam } from "@/modules/member-score/member-score.service";
import { requireActor } from "@/server/lib/context";
import { isWorkspaceAdmin } from "@/server/lib/permissions";
import { NotFoundError } from "@/server/lib/errors";
import { WorkspaceTeamClient } from "./team-view-client";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function WorkspaceTeamPage({ params }: Props) {
  const { slug } = await params;

  let workspace;
  try {
    workspace = await getWorkspace(slug);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const ctx = await requireActor(workspace.id);
  const canViewAll = isWorkspaceAdmin(ctx);
  const members = await computeWorkspaceTeam(workspace.id, {
    viewerMemberId: ctx.workspaceMemberId,
    canViewAll,
  });

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6 shadow-soft">
        <WorkspaceTeamClient
          members={members}
          workspaceId={workspace.id}
          slug={slug}
          canEdit={canViewAll}
        />
      </div>
    </div>
  );
}
