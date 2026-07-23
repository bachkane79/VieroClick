import { notFound } from "next/navigation";
import { getWorkspace, listWorkspaceMembers } from "@/modules/workspace/workspace.service";
import { getProject, detectPlanDeviations } from "@/modules/project/project.service";
import { listReports } from "@/modules/report/report.service";
import { ReportsViewClient } from "./reports-view-client";
import { requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectReportsPage({ params }: Props) {
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
  const isManager =
    ctx.workspaceRole === "owner" ||
    ctx.workspaceRole === "admin" ||
    ctx.workspaceRole === "leader" ||
    ctx.projectRole === "project_lead" ||
    ctx.projectRole === "tech_lead";

  const [reports, workspaceMembers, deviations] = await Promise.all([
    listReports(workspace.id, projectId),
    listWorkspaceMembers(workspace.id),
    detectPlanDeviations(workspace.id, projectId),
  ]);

  // Adapt database rows to component props types
  const adaptedReports = reports.map((r) => ({
    ...r,
    approvedAt: r.approvedAt ? new Date(r.approvedAt) : null,
    createdAt: new Date(r.createdAt),
  }));

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6 shadow-soft">
        <ReportsViewClient
          workspaceId={workspace.id}
          projectId={projectId}
          workspaceSlug={slug}
          initialReports={adaptedReports}
          members={workspaceMembers.map((m) => ({
            id: m.id,
            fullName: m.fullName,
          }))}
          isManager={isManager}
          currentDeviations={deviations}
        />
      </div>
    </div>
  );
}
