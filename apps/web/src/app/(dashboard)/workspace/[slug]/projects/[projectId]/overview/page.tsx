import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants, cn } from "@vieroc/ui";
import { Kanban, ListChecks } from "lucide-react";
import { getWorkspace, listWorkspaceMembers } from "@/modules/workspace/workspace.service";
import { getProject } from "@/modules/project/project.service";
import { listMembers as listProjectMembers } from "@/modules/project-member/project-member.service";
import { listBoard } from "@/modules/task/task.service";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectOverviewPage({ params }: Props) {
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

  const [{ tasks, statuses }, workspaceMembers, projectMembers] = await Promise.all([
    listBoard(workspace.id, projectId),
    listWorkspaceMembers(workspace.id),
    listProjectMembers(workspace.id, projectId),
  ]);

  const memberNameById = new Map(workspaceMembers.map((member) => [member.id, member.fullName]));
  const doneStatusIds = new Set(statuses.filter((status) => status.type === "done").map((s) => s.id));
  const blockedStatusIds = new Set(
    statuses.filter((status) => status.type === "blocked").map((s) => s.id)
  );

  return (
    <div className="px-6 py-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-muted-foreground">{workspace.name}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{project.name}</h1>
          {project.description && (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{project.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/workspace/${slug}/projects/${projectId}/tasks`}
            className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
          >
            <ListChecks className="h-4 w-4" />
            Tasks
          </Link>
          <Link
            href={`/workspace/${slug}/projects/${projectId}/board`}
            className={cn(buttonVariants(), "gap-2")}
          >
            <Kanban className="h-4 w-4" />
            Board
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Tasks" value={tasks.length} />
        <Metric label="Done" value={tasks.filter((task) => doneStatusIds.has(task.statusId)).length} />
        <Metric
          label="Blocked"
          value={tasks.filter((task) => blockedStatusIds.has(task.statusId)).length}
        />
        <Metric label="Members" value={projectMembers.length} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-lg border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold">Intake</h2>
          <div className="mt-4 grid gap-5">
            <OverviewBlock title="Scope" items={project.scope ? [project.scope] : []} prose />
            <OverviewBlock title="Goals" items={project.goals} />
            <OverviewBlock title="Constraints" items={project.constraints} />
            <OverviewBlock title="Expected deliverables" items={project.expectedDeliverables} />
            <OverviewBlock
              title="Initial context"
              items={project.initialContext ? [project.initialContext] : []}
              prose
            />
          </div>
        </section>

        <aside className="rounded-lg border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold">Project members</h2>
          <div className="mt-4 divide-y">
            {projectMembers.map((member) => (
              <div key={member.id} className="py-3 first:pt-0 last:pb-0">
                <p className="truncate text-sm font-medium">
                  {memberNameById.get(member.workspaceMemberId) ?? "Workspace member"}
                </p>
                <p className="mt-1 text-xs capitalize text-muted-foreground">
                  {member.role.replace("_", " ")} · {member.allocationPercent}%
                </p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-md border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium capitalize">{project.status}</span>
            </div>
            <div className="mt-2 flex justify-between">
              <span className="text-muted-foreground">Deadline</span>
              <span className="font-medium">{project.targetEndDate ?? "Not set"}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function OverviewBlock({
  title,
  items,
  prose,
}: {
  title: string;
  items: string[];
  prose?: boolean;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Not defined</p>
      ) : prose ? (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{items[0]}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li key={item} className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
