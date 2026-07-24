import { notFound } from "next/navigation";
import { getWorkspace, listWorkspaceMembers } from "@/modules/workspace/workspace.service";
import { getProject } from "@/modules/project/project.service";
import { listTickets } from "@/modules/ticket/ticket.service";
import { requireActor } from "@/server/lib/context";
import { isProjectManager } from "@/server/lib/permissions";
import { NotFoundError } from "@/server/lib/errors";
import { TicketsViewClient } from "./tickets-view-client";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectTicketsPage({ params }: Props) {
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
  const canDecide = isProjectManager(ctx);

  const [tickets, workspaceMembers] = await Promise.all([
    listTickets(workspace.id, projectId),
    listWorkspaceMembers(workspace.id),
  ]);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6 shadow-soft">
        <TicketsViewClient
          workspaceId={workspace.id}
          projectId={projectId}
          workspaceSlug={slug}
          initialTickets={tickets}
          members={workspaceMembers.map((m) => ({ id: m.id, fullName: m.fullName, email: m.email }))}
          canDecide={canDecide}
        />
      </div>
    </div>
  );
}
