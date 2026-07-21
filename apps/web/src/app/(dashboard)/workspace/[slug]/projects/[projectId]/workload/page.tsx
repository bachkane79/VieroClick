import Link from "next/link";
import { notFound } from "next/navigation";
import { cn } from "@vieroc/ui";
import { listMembers as listProjectMembers } from "@/modules/project-member/project-member.service";
import { loadProjectViewData } from "@/modules/task/task-page-data";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

// Nominal weekly capacity for a 100%-allocated member. Estimates are rough,
// so this is a planning heuristic, not a billing figure.
const WEEKLY_HOURS = 40;

export default async function ProjectWorkloadPage({ params }: Props) {
  const { slug, projectId } = await params;

  let data;
  let projectMembers;
  try {
    data = await loadProjectViewData(slug, projectId);
    projectMembers = await listProjectMembers(data.workspace.id, projectId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const statusType = new Map(data.statuses.map((s) => [s.id, s.type]));
  const isOpen = (statusId: string) => {
    const t = statusType.get(statusId);
    return t !== "done" && t !== "cancelled";
  };

  const allocationByMember = new Map(
    projectMembers.map((m) => [m.workspaceMemberId, m.allocationPercent])
  );

  // Per-member load = sum of estimate hours across open assigned tasks.
  const rows = data.members
    .map((member) => {
      const openTasks = data.tasks.filter(
        (t) => t.assigneeMemberId === member.id && isOpen(t.statusId)
      );
      const load = openTasks.reduce((sum, t) => sum + Number(t.estimateHours ?? 0), 0);
      const allocation = allocationByMember.get(member.id) ?? 100;
      const capacity = (WEEKLY_HOURS * allocation) / 100;
      return { member, openTasks, load, allocation, capacity };
    })
    .sort((a, b) => b.load - a.load);

  const unassigned = data.tasks.filter((t) => !t.assigneeMemberId && isOpen(t.statusId));

  return (
    <div className="px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{data.project.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Workload — estimated open hours vs weekly capacity
        </p>
      </div>

      <div className="space-y-3">
        {rows.map(({ member, openTasks, load, allocation, capacity }) => {
          const pct = capacity > 0 ? Math.round((load / capacity) * 100) : 0;
          const over = load > capacity;
          return (
            <div key={member.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {member.fullName
                      .split(/\s+/)
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{member.fullName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {openTasks.length} open task{openTasks.length === 1 ? "" : "s"} · {allocation}% allocated
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn("text-sm font-bold", over ? "text-red-500" : "text-foreground")}>
                    {load}h / {capacity}h
                  </p>
                  <p className="text-[11px] text-muted-foreground">{pct}% of capacity</p>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", over ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-primary")}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              {openTasks.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {openTasks.slice(0, 8).map((t) => (
                    <Link
                      key={t.id}
                      href={`/workspace/${slug}/projects/${projectId}/tasks?task=${t.id}`}
                      className="rounded border bg-background px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
                    >
                      {t.title}
                      {t.estimateHours ? ` · ${t.estimateHours}h` : ""}
                    </Link>
                  ))}
                  {openTasks.length > 8 && (
                    <span className="px-1 text-[11px] text-muted-foreground">
                      +{openTasks.length - 8} more
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {rows.length === 0 && (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            No project members to show workload for.
          </div>
        )}

        {unassigned.length > 0 && (
          <div className="rounded-lg border border-dashed bg-muted/20 p-4">
            <p className="mb-2 text-sm font-semibold text-muted-foreground">
              Unassigned ({unassigned.length}) ·{" "}
              {unassigned.reduce((s, t) => s + Number(t.estimateHours ?? 0), 0)}h
            </p>
            <div className="flex flex-wrap gap-1.5">
              {unassigned.slice(0, 10).map((t) => (
                <Link
                  key={t.id}
                  href={`/workspace/${slug}/projects/${projectId}/tasks?task=${t.id}`}
                  className="rounded border bg-background px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
                >
                  {t.title}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
