import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants, cn } from "@vieroc/ui";
import { Kanban } from "lucide-react";
import { getWorkspace, listWorkspaceMembers } from "@/modules/workspace/workspace.service";
import { getProject } from "@/modules/project/project.service";
import { listMembers as listProjectMembers } from "@/modules/project-member/project-member.service";
import { listBoard } from "@/modules/task/task.service";
import { TaskList } from "@/modules/task/components/task-list";
import { toDependencyView, toStatusView, toTaskView } from "@/modules/task/task.view";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectTasksPage({ params }: Props) {
  const { slug, projectId } = await params;

  let workspace;
  let project;
  try {
    workspace = await getWorkspace(slug);
    project = await getProject(workspace.id, projectId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const [{ tasks, statuses, dependencies }, workspaceMembers, projectMembers] = await Promise.all([
    listBoard(workspace.id, projectId),
    listWorkspaceMembers(workspace.id),
    listProjectMembers(workspace.id, projectId),
  ]);

  const projectMemberIds = new Set(projectMembers.map((member) => member.workspaceMemberId));
  const assignableMembers = workspaceMembers.filter((member) => projectMemberIds.has(member.id));

  return (
    <div className="px-6 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tasks</p>
        </div>
        <Link
          href={`/workspace/${slug}/projects/${projectId}/board`}
          className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
        >
          <Kanban className="h-4 w-4" />
          Board view
        </Link>
      </div>

      <TaskList
        workspaceId={workspace.id}
        workspaceSlug={slug}
        projectId={projectId}
        tasks={tasks.map(toTaskView)}
        statuses={statuses.map(toStatusView)}
        members={assignableMembers.map((member) => ({
          id: member.id,
          fullName: member.fullName,
          email: member.email,
        }))}
        dependencies={dependencies.map(toDependencyView)}
      />
    </div>
  );
}
