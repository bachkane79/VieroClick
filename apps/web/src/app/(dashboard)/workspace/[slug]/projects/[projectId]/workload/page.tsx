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
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6 shadow-soft space-y-4">

        <div className="space-y-3">
          {rows.map(({ member, openTasks, load, allocation, capacity }) => {
            const pct = capacity > 0 ? Math.round((load / capacity) * 100) : 0;
            const over = load > capacity;
            return (
              <div key={member.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">
                      {member.fullName
                        .split(/\s+/)
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </span>
                    <div>
                      <p className="text-xs font-semibold">{member.fullName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {openTasks.length} open task{openTasks.length === 1 ? "" : "s"} · {allocation}% allocated
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-xs font-bold", over ? "text-destructive" : "text-foreground")}>
                      {load}h / {capacity}h
                    </p>
                    <p className="text-[11px] text-muted-foreground">{pct}% of capacity</p>
                  </div>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn("h-full rounded-full", over ? "bg-destructive" : pct > 80 ? "bg-amber-500" : "bg-primary")}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                {openTasks.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {openTasks.slice(0, 8).map((t) => (
                      <Link
                        key={t.id}
                        href={`/workspace/${slug}/projects/${projectId}/tasks?task=${t.id}`}
                        className="rounded-lg border border-border/80 bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
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
            <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center text-xs text-muted-foreground">
              No project members to show workload for.
            </div>
          )}

          {unassigned.length > 0 && (
            <div className="rounded-2xl border border-dashed border-border/80 bg-surface-subtle p-4">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                Unassigned ({unassigned.length}) ·{" "}
                {unassigned.reduce((s, t) => s + Number(t.estimateHours ?? 0), 0)}h
              </p>
              <div className="flex flex-wrap gap-1.5">
                {unassigned.slice(0, 10).map((t) => (
                  <Link
                    key={t.id}
                    href={`/workspace/${slug}/projects/${projectId}/tasks?task=${t.id}`}
                    className="rounded-lg border border-border/80 bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
                  >
                    {t.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
