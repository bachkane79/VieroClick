import { notFound } from "next/navigation";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { getProject } from "@/modules/project/project.service";
import { computeTeamMetrics } from "@/modules/member-score/member-score.service";
import { requireActor } from "@/server/lib/context";
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

  await requireActor(workspace.id, projectId);
  const members = await computeTeamMetrics(projectId);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6 shadow-soft">
        <TeamViewClient members={members} />
      </div>
    </div>
  );
}
