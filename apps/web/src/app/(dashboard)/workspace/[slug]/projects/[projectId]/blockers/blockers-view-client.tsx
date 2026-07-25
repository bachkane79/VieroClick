"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useFormatter } from "next-intl";
import { Button, Input, Textarea } from "@vieroc/ui";
import { toast } from "sonner";
import { AlertOctagon, Plus, CheckCircle, User, AlertTriangle } from "lucide-react";
import { reportBlockerAction, updateBlockerAction } from "@/modules/blocker/blocker.actions";
import { useActionError } from "@/i18n/use-action-error";

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
  const t = useTranslations();
  const format = useFormatter();
  const actionError = useActionError();
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
    toast.success(t("blockers.toast.reported"));

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
      toast.error(actionError(res));
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
    toast.success(t("blockers.toast.resolved"));

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
      toast.error(actionError(res));
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
    toast.success(t("blockers.toast.ownerUpdated"));

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
      toast.error(actionError(res));
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
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      {/* Blocker list/board */}
      <div className="space-y-6 xl:col-span-2">
        {/* Open Blockers */}
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
            <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-red-500">
              <AlertOctagon className="h-4 w-4" />
              {t("blockers.activeTitle")} ({openBlockers.length})
            </h3>
            {!isAdding && (
              <Button size="sm" onClick={() => setIsAdding(true)} className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> {t("blockers.fileBlocker")}
              </Button>
            )}
          </div>

          {openBlockers.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
              <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-500 opacity-80" />
              <p className="text-sm font-semibold">{t("blockers.empty.activeTitle")}</p>
              <p className="mt-0.5 text-xs">{t("blockers.empty.activeDescription")}</p>
            </div>
          ) : (
            <div className="max-h-[400px] space-y-3 overflow-y-auto pr-1">
              {openBlockers.map((b) => {
                const reporterName =
                  memberNameMap.get(b.reportedByMemberId ?? "") ?? t("blockers.workspaceMember");
                const linkedTaskTitle = b.taskId ? taskTitleMap.get(b.taskId) : null;

                return (
                  <div
                    key={b.id}
                    className="space-y-3 rounded-xl border border-neutral-200/40 bg-card p-4 shadow-sm transition-all hover:border-neutral-300 dark:border-neutral-800/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <span className="block text-xs font-bold text-foreground">{b.title}</span>
                        {b.description && (
                          <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                            {b.description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                          <span>
                            {t("blockers.reportedBy")}{" "}
                            <strong className="text-foreground">{reporterName}</strong>
                          </span>
                          <span>·</span>
                          <span>
                            {t("blockers.filed")} {format.dateTime(new Date(b.createdAt), "short")}
                          </span>
                          {linkedTaskTitle && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                {t("blockers.linkedTask")}{" "}
                                <strong className="cursor-pointer text-primary hover:underline">
                                  {linkedTaskTitle}
                                </strong>
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase ${getSeverityColor(
                            b.severity
                          )}`}
                        >
                          {t(`task.priority.${b.severity}`)}
                        </span>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 text-[10px] font-bold text-green-600 hover:bg-green-50 hover:text-green-700"
                          disabled={submitting}
                          onClick={() => handleResolve(b.id)}
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> {t("blockers.resolve")}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-neutral-100 pt-2.5 dark:border-neutral-800">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <User className="h-3.5 w-3.5" />
                        <span>{t("blockers.owner")}</span>
                        <select
                          value={b.ownerMemberId ?? ""}
                          onChange={(e) => handleReassign(b.id, e.target.value)}
                          disabled={submitting}
                          className="ml-1 rounded border border-neutral-200/40 bg-transparent px-1.5 py-0.5 font-bold text-foreground focus:outline-none dark:border-neutral-800/40"
                        >
                          <option value="">{t("blockers.assignOwnerPlaceholder")}</option>
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
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="border-b border-neutral-100 pb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground dark:border-neutral-800">
            {t("blockers.resolvedTitle")} ({resolvedBlockers.length})
          </h3>

          {resolvedBlockers.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">
              {t("blockers.empty.resolved")}
            </p>
          ) : (
            <div className="max-h-[300px] space-y-2 divide-y divide-neutral-200/20 overflow-y-auto pr-1">
              {resolvedBlockers.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-3 py-3 text-xs">
                  <div className="min-w-0">
                    <span className="block truncate font-semibold text-foreground line-through">
                      {b.title}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {t("blockers.resolvedBy")}{" "}
                      <strong>
                        {memberNameMap.get(b.resolvedByMemberId ?? "") ??
                          t("blockers.workspaceMember")}
                      </strong>{" "}
                      {t("blockers.on")}{" "}
                      {b.resolvedAt ? format.dateTime(new Date(b.resolvedAt), "short") : ""}
                    </span>
                  </div>
                  <span className="shrink-0 rounded border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[9px] font-bold text-green-500">
                    {t("blockers.statusResolved")}
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
          <div className="duration-250 space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm animate-in fade-in slide-in-from-right-3">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
              <h3 className="text-sm font-semibold text-foreground">{t("blockers.formTitle")}</h3>
              <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
                {t("common.cancel")}
              </Button>
            </div>

            <form onSubmit={handleReport} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1.5">
                <label className="text-muted-foreground">{t("blockers.form.title")}</label>
                <Input
                  required
                  placeholder={t("blockers.form.titlePlaceholder")}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground">{t("blockers.form.description")}</label>
                <Textarea
                  placeholder={t("blockers.form.descriptionPlaceholder")}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground">{t("blockers.form.linkTask")}</label>
                <select
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">{t("blockers.form.unlinked")}</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-muted-foreground">{t("blockers.form.severity")}</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as typeof severity)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="low">{t("task.priority.low")}</option>
                    <option value="medium">{t("task.priority.medium")}</option>
                    <option value="high">{t("task.priority.high")}</option>
                    <option value="urgent">{t("task.priority.urgent")}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground">{t("blockers.form.assignOwner")}</label>
                  <select
                    value={ownerMemberId}
                    onChange={(e) => setOwnerMemberId(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">{t("task.unassigned")}</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Button type="submit" disabled={submitting} className="w-full text-xs">
                {submitting ? t("blockers.submitting") : t("blockers.reportBlocker")}
              </Button>
            </form>
          </div>
        )}

        <div className="space-y-3 rounded-2xl border border-border bg-card p-5 text-xs shadow-sm">
          <h4 className="flex items-center gap-1 font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {t("blockers.escalations.title")}
          </h4>
          <p className="leading-relaxed text-muted-foreground">
            {t.rich("blockers.escalations.description", {
              b: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
