import { notFound } from "next/navigation";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { getProject } from "@/modules/project/project.service";
import { listWorkspaceMembers } from "@/modules/workspace/workspace.service";
import { listTaskOptions } from "@/modules/task/task.service";
import { listStatuses } from "@/modules/task-status/task-status.service";
import { listBlockers } from "@/modules/blocker/blocker.service";
import { listRisks } from "@/modules/risk/risk.service";
import { listMilestones } from "@/modules/milestone/milestone.service";
import { listChatChannels } from "@/modules/channel/channel.service";
import { listAutomations, listAutomationRuns } from "@/modules/automation/automation.service";
import { NotFoundError } from "@/server/lib/errors";
import { AutomationsViewClient } from "./automations-view-client";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
  searchParams: Promise<{ taskId?: string }>;
}

export default async function ProjectAutomationsPage({ params, searchParams }: Props) {
  const { slug, projectId } = await params;
  const { taskId } = await searchParams;

  let workspace;
  try {
    workspace = await getWorkspace(slug);
    await getProject(workspace.id, projectId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const [automations, statuses, members, blockers, tasks, risks, milestones, channels] = await Promise.all([
    listAutomations(workspace.id, projectId),
    listStatuses(workspace.id, projectId),
    listWorkspaceMembers(workspace.id),
    listBlockers(workspace.id, projectId),
    listTaskOptions(workspace.id, projectId),
    listRisks(workspace.id, projectId),
    listMilestones(workspace.id, projectId),
    listChatChannels(workspace.id),
  ]);

  const withRuns = await Promise.all(
    automations.map(async (automation) => ({
      ...automation,
      recentRuns: await listAutomationRuns(workspace.id, projectId, automation.id),
    }))
  );

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6 shadow-soft">
        <AutomationsViewClient
          workspaceId={workspace.id}
          projectId={projectId}
          workspaceSlug={slug}
          initialAutomations={withRuns}
          statuses={statuses.map((s) => ({ id: s.id, name: s.name, type: s.type }))}
          members={members.map((m) => ({ id: m.id, fullName: m.fullName }))}
          blockers={blockers
            .filter((b) => b.status === "open" || b.status === "in_review")
            .map((b) => ({ id: b.id, title: b.title }))}
          tasks={tasks}
          risks={risks.map((r) => ({ id: r.id, title: r.title }))}
          milestones={milestones.map((m) => ({ id: m.id, title: m.title }))}
          channels={channels.map((c) => ({ id: c.id, name: c.name }))}
          initialTaskId={taskId}
        />
      </div>
    </div>
  );
}
