import "server-only";
import { getWorkspace, listWorkspaceMembers } from "@/modules/workspace/workspace.service";
import { getProject } from "@/modules/project/project.service";
import { listMembers as listProjectMembers } from "@/modules/project-member/project-member.service";
import { listBoard } from "@/modules/task/task.service";
import { listWbsNodes } from "@/modules/wbs/wbs.service";
import { listProjectAttachments } from "@/modules/file/file.service";
import { toDependencyView, toStatusView, toTaskView } from "@/modules/task/task.view";
import { toTaskAttachmentView } from "@/modules/file/file.view";
import type { PhaseNode } from "@/modules/task/task-grouping";

/**
 * Shared loader for the task view surfaces (List/Board/Calendar/Table). Keeps
 * the four pages thin and their data identical. Throws NotFoundError so the
 * caller can `notFound()`.
 */
export async function loadProjectViewData(slug: string, projectId: string) {
  const workspace = await getWorkspace(slug);
  const project = await getProject(workspace.id, projectId);

  const [{ tasks, statuses, dependencies }, workspaceMembers, projectMembers, attachments, wbsNodes] =
    await Promise.all([
      listBoard(workspace.id, projectId),
      listWorkspaceMembers(workspace.id),
      listProjectMembers(workspace.id, projectId),
      listProjectAttachments(workspace.id, projectId),
      listWbsNodes(workspace.id, projectId),
    ]);

  const projectMemberIds = new Set(projectMembers.map((m) => m.workspaceMemberId));
  const members = workspaceMembers
    .filter((m) => projectMemberIds.has(m.id))
    .map((m) => ({ id: m.id, fullName: m.fullName, email: m.email }));

  const phases: PhaseNode[] = wbsNodes.map((n) => ({
    id: n.id,
    parentId: n.parentId,
    title: n.title,
    nodeType: n.nodeType,
    linkedTaskId: n.linkedTaskId,
    position: n.position,
  }));

  return {
    workspace,
    project,
    tasks: tasks.map(toTaskView),
    statuses: statuses.map(toStatusView),
    dependencies: dependencies.map(toDependencyView),
    members,
    attachments: attachments.map(toTaskAttachmentView),
    phases,
  };
}
