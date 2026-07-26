import { notFound } from "next/navigation";
import { getWorkspace, listWorkspaceMembers } from "@/modules/workspace/workspace.service";
import { listChatChannels } from "@/modules/channel/channel.service";
import {
  listWorkspaceAutomations,
  listWorkspaceAutomationRuns,
} from "@/modules/automation/automation.service";
import { NotFoundError } from "@/server/lib/errors";
import { AutomationsViewClient } from "../projects/[projectId]/automations/automations-view-client";

interface Props {
  params: Promise<{ slug: string }>;
}

/** Workspace-wide automations (projectId IS NULL) — parallel to
 * workspace/[slug]/settings/*, not nested under a project. Reuses the same
 * client component the project-scoped automations page uses (generalized to
 * accept projectId: string | null in Phase 2). */
export default async function WorkspaceAutomationsPage({ params }: Props) {
  const { slug } = await params;

  let workspace;
  try {
    workspace = await getWorkspace(slug);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const [automations, members, channels] = await Promise.all([
    listWorkspaceAutomations(workspace.id),
    listWorkspaceMembers(workspace.id),
    listChatChannels(workspace.id),
  ]);
  const withRuns = await Promise.all(
    automations.map(async (automation) => ({
      ...automation,
      recentRuns: await listWorkspaceAutomationRuns(workspace.id, automation.id),
    }))
  );

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6 shadow-soft">
        <AutomationsViewClient
          workspaceId={workspace.id}
          projectId={null}
          workspaceSlug={slug}
          initialAutomations={withRuns}
          members={members.map((m) => ({ id: m.id, fullName: m.fullName }))}
          channels={channels.map((c) => ({ id: c.id, name: c.name }))}
        />
      </div>
    </div>
  );
}
