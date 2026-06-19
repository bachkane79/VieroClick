"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea } from "@vieroc/ui";
import { toast } from "sonner";
import { AlertOctagon, Plus, CheckCircle, User, AlertTriangle, ArrowRight } from "lucide-react";
import { reportBlockerAction, updateBlockerAction } from "@/modules/blocker/blocker.actions";

interface BlockerRow {
  id: string;
  projectId: string;
  taskId: string | null;
  reportedByMemberId: string | null;
  title: string;
  description: string | null;
  status: "open" | "in_review" | "resolved" | "ignored";
  severity: "low" | "medium" | "high" | "urgent";
  ownerMemberId: string | null;
  resolvedByMemberId: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MemberRow {
  id: string;
  fullName: string;
  email: string;
}

interface TaskRow {
  id: string;
  title: string;
}

interface Props {
  workspaceId: string;
  projectId: string;
  workspaceSlug: string;
  initialBlockers: BlockerRow[];
  members: MemberRow[];
  tasks: TaskRow[];
}

export function BlockersViewClient({
  workspaceId,
  projectId,
  workspaceSlug,
  initialBlockers,
  members,
  tasks,
}: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskId, setTaskId] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [ownerMemberId, setOwnerMemberId] = useState("");

  const memberNameMap = new Map(members.map((m) => [m.id, m.fullName]));
  const taskTitleMap = new Map(tasks.map((t) => [t.id, t.title]));

  const [blockers, setBlockers] = useState<BlockerRow[]>(initialBlockers);

  useEffect(() => {
    setBlockers(initialBlockers);
  }, [initialBlockers]);

  const openBlockers = blockers.filter((b) => b.status !== "resolved");
  const resolvedBlockers = blockers.filter((b) => b.status === "resolved");

  async function handleReport(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    const titleVal = title.trim();
    const descVal = description.trim() || null;
    const taskVal = taskId || null;
    const sevVal = severity;
    const ownerVal = ownerMemberId || null;

    setIsAdding(false);
    setTitle("");
    setDescription("");
    setTaskId("");
    setOwnerMemberId("");

    // Optimistic add
    const tempId = `temp-${Date.now()}`;
    const newBlocker: BlockerRow = {
      id: tempId,
      projectId,
      taskId: taskVal,
      reportedByMemberId: "me",
      title: titleVal,
      description: descVal,
      status: "open",
      severity: sevVal,
      ownerMemberId: ownerVal,
      resolvedByMemberId: null,
      resolvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setBlockers((current) => [newBlocker, ...current]);
    toast.success("Blocker reported");

    setSubmitting(true);
    const res = await reportBlockerAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      data: {
        title: titleVal,
        description: descVal || undefined,
        taskId: taskVal || undefined,
        severity: sevVal,
        ownerMemberId: ownerVal || undefined,
      },
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      // rollback
      setBlockers((current) => current.filter((b) => b.id !== tempId));
    } else {
      router.refresh();
    }
  }

  async function handleResolve(blockerId: string) {
    const previousBlockers = [...blockers];
    setBlockers((current) =>
      current.map((b) =>
        b.id === blockerId
          ? {
              ...b,
              status: "resolved",
              resolvedByMemberId: "me",
              resolvedAt: new Date(),
            }
          : b
      )
    );
    toast.success("Blocker resolved");

    setSubmitting(true);
    const res = await updateBlockerAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      blockerId,
      data: {
        status: "resolved",
      },
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      // rollback
      setBlockers(previousBlockers);
    } else {
      router.refresh();
    }
  }

  async function handleReassign(blockerId: string, newOwnerId: string) {
    const previousBlockers = [...blockers];
    setBlockers((current) =>
      current.map((b) => (b.id === blockerId ? { ...b, ownerMemberId: newOwnerId || null } : b))
    );
    toast.success("Blocker owner updated");

    setSubmitting(true);
    const res = await updateBlockerAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      blockerId,
      data: {
        ownerMemberId: newOwnerId || null,
      },
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      // rollback
      setBlockers(previousBlockers);
    } else {
      router.refresh();
    }
  }

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case "urgent":
        return "bg-red-500/10 text-red-500 border border-red-500/20";
      case "high":
        return "bg-orange-500/10 text-orange-500 border border-orange-500/20";
      case "medium":
        return "bg-amber-500/10 text-amber-500 border border-amber-500/20";
      default:
        return "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300";
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Blocker list/board */}
      <div className="xl:col-span-2 space-y-6">
        {/* Open Blockers */}
        <div className="p-5 border border-neutral-200/50 dark:border-neutral-800/50 rounded-2xl bg-card shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-neutral-100 dark:border-neutral-800">
            <h3 className="text-sm font-bold uppercase tracking-wider text-red-500 flex items-center gap-1.5">
              <AlertOctagon className="w-4 h-4" />
              Active Project Blockers ({openBlockers.length})
            </h3>
            {!isAdding && (
              <Button size="sm" onClick={() => setIsAdding(true)} className="gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> File Blocker
              </Button>
            )}
          </div>

          {openBlockers.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground border border-dashed rounded-xl">
              <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold">No active blockers</p>
              <p className="text-xs mt-0.5">The project is running smoothly with no blocked tasks.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {openBlockers.map((b) => {
                const reporterName = memberNameMap.get(b.reportedByMemberId ?? "") ?? "Workspace member";
                const linkedTaskTitle = b.taskId ? taskTitleMap.get(b.taskId) : null;

                return (
                  <div
                    key={b.id}
                    className="p-4 border border-neutral-200/40 dark:border-neutral-800/40 rounded-xl bg-card space-y-3 hover:border-neutral-300 transition-all shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <span className="font-bold text-xs text-foreground block">{b.title}</span>
                        {b.description && (
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                            {b.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground mt-2">
                          <span>Reported by: <strong className="text-foreground">{reporterName}</strong></span>
                          <span>·</span>
                          <span>Filed: {new Date(b.createdAt).toLocaleDateString()}</span>
                          {linkedTaskTitle && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                Linked Task:{" "}
                                <strong className="text-primary hover:underline cursor-pointer">
                                  {linkedTaskTitle}
                                </strong>
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${getSeverityColor(
                            b.severity
                          )}`}
                        >
                          {b.severity}
                        </span>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 text-[10px] font-bold text-green-600 hover:text-green-700 hover:bg-green-50"
                          disabled={submitting}
                          onClick={() => handleResolve(b.id)}
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Resolve
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-neutral-100 dark:border-neutral-800">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <User className="w-3.5 h-3.5" />
                        <span>Owner:</span>
                        <select
                          value={b.ownerMemberId ?? ""}
                          onChange={(e) => handleReassign(b.id, e.target.value)}
                          disabled={submitting}
                          className="bg-transparent font-bold focus:outline-none text-foreground border border-neutral-200/40 dark:border-neutral-800/40 rounded px-1.5 py-0.5 ml-1"
                        >
                          <option value="">Assign Owner...</option>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.fullName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Resolved Blockers */}
        <div className="p-5 border border-neutral-200/50 dark:border-neutral-800/50 rounded-2xl bg-card shadow-sm space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-3 border-neutral-100 dark:border-neutral-800">
            Resolved Blockers ({resolvedBlockers.length})
          </h3>

          {resolvedBlockers.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4 text-center">No resolved blockers listed.</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 divide-y divide-neutral-200/20">
              {resolvedBlockers.map((b) => (
                <div key={b.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <span className="font-semibold text-foreground truncate block line-through">
                      {b.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      Resolved by:{" "}
                      <strong>
                        {memberNameMap.get(b.resolvedByMemberId ?? "") ?? "Workspace member"}
                      </strong>{" "}
                      on {b.resolvedAt ? new Date(b.resolvedAt).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 bg-green-500/10 text-green-500 rounded text-[9px] font-bold border border-green-500/20">
                    Resolved
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Side Form */}
      <div className="space-y-4">
        {isAdding && (
          <div className="p-5 border border-neutral-200/50 dark:border-neutral-800/50 rounded-2xl bg-card shadow-sm space-y-4 animate-in fade-in slide-in-from-right-3 duration-250">
            <div className="flex items-center justify-between border-b pb-3 border-neutral-100 dark:border-neutral-800">
              <h3 className="text-sm font-bold text-foreground">File Blocker Report</h3>
              <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
            </div>

            <form onSubmit={handleReport} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1.5">
                <label className="text-muted-foreground">Blocker Title</label>
                <Input
                  required
                  placeholder="e.g. API Gateway response timing out"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground">Description</label>
                <Textarea
                  placeholder="Provide logs or details regarding what is blocking development..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground">Link Blocker to Project Task</label>
                <select
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Unlinked</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-muted-foreground">Severity</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as typeof severity)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground">Assign Owner</label>
                  <select
                    value={ownerMemberId}
                    onChange={(e) => setOwnerMemberId(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Button type="submit" disabled={submitting} className="w-full text-xs">
                {submitting ? "Submitting..." : "Report Blocker"}
              </Button>
            </form>
          </div>
        )}

        <div className="p-5 border border-neutral-200/50 dark:border-neutral-800/50 rounded-2xl bg-card shadow-sm text-xs space-y-3">
          <h4 className="font-bold text-foreground flex items-center gap-1">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Blocker Escalations
          </h4>
          <p className="text-muted-foreground leading-relaxed">
            Reported blockers automatically update linked task statuses to <strong>Blocked</strong>, alerting project leads and preventing dependent tasks from being started.
          </p>
        </div>
      </div>
    </div>
  );
}
