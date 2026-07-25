"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useFormatter } from "next-intl";
import { Button, Input, Textarea } from "@vieroc/ui";
import { toast } from "sonner";
import { FileText, Plus, Trash2, BookOpen, AlertCircle, Sparkles } from "lucide-react";
import { createDocAction, deleteDocAction } from "@/modules/project-doc/project-doc.actions";
import {
  logDecisionAction,
  deleteDecisionAction,
} from "@/modules/decision-log/decision-log.actions";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useActionError } from "@/i18n/use-action-error";

interface DocRow {
  id: string;
  projectId: string;
  type: "requirement" | "technical_note" | "decision" | "meeting_note" | "scope" | "other";
  title: string;
  content: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DecisionRow {
  id: string;
  projectId: string;
  title: string;
  decision: string;
  reason: string | null;
  decidedByMemberId: string | null;
  affectedTaskIds: string[];
  createdAt: Date;
}

interface MemberRow {
  id: string;
  fullName: string;
}

interface TaskRow {
  id: string;
  title: string;
}

interface Props {
  workspaceId: string;
  projectId: string;
  workspaceSlug: string;
  initialDocs: DocRow[];
  initialDecisions: DecisionRow[];
  members: MemberRow[];
  tasks: TaskRow[];
}

export function DocsDecisionsClient({
  workspaceId,
  projectId,
  workspaceSlug,
  initialDocs,
  initialDecisions,
  members,
  tasks,
}: Props) {
  const router = useRouter();
  const t = useTranslations();
  const format = useFormatter();
  const actionError = useActionError();
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"docs" | "decisions">("docs");
  const [deleteDocCandidateId, setDeleteDocCandidateId] = useState<string | null>(null);
  const [deleteDecisionCandidateId, setDeleteDecisionCandidateId] = useState<string | null>(null);

  // Form toggles
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [showAddDecision, setShowAddDecision] = useState(false);

  // Form states - Doc
  const [dTitle, setDTitle] = useState("");
  const [dType, setDType] = useState<
    "requirement" | "technical_note" | "decision" | "meeting_note" | "scope" | "other"
  >("other");
  const [dContent, setDContent] = useState("");

  // Form states - Decision
  const [decTitle, setDecTitle] = useState("");
  const [decDecision, setDecDecision] = useState("");
  const [decReason, setDecReason] = useState("");
  const [decByMemberId, setDecByMemberId] = useState("");
  const [decAffectedTasks, setDecAffectedTasks] = useState<string[]>([]);

  const memberNameMap = new Map(members.map((m) => [m.id, m.fullName]));
  const taskTitleMap = new Map(tasks.map((t) => [t.id, t.title]));

  const [docs, setDocs] = useState<DocRow[]>(initialDocs);
  const [decisions, setDecisions] = useState<DecisionRow[]>(initialDecisions);

  useEffect(() => {
    setDocs(initialDocs);
  }, [initialDocs]);

  useEffect(() => {
    setDecisions(initialDecisions);
  }, [initialDecisions]);

  async function handleAddDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!dTitle.trim() || !dContent.trim()) return;

    const titleText = dTitle.trim();
    const typeVal = dType;
    const contentText = dContent.trim();

    setShowAddDoc(false);
    setDTitle("");
    setDContent("");

    // Optimistic add
    const tempId = `temp-${Date.now()}`;
    const newDoc: DocRow = {
      id: tempId,
      projectId,
      title: titleText,
      type: typeVal,
      content: contentText,
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setDocs((current) => [newDoc, ...current]);
    toast.success(t("docs.toast.docCreated"));

    setSubmitting(true);
    const res = await createDocAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      data: {
        title: titleText,
        type: typeVal,
        content: contentText,
      },
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(actionError(res));
      // rollback
      setDocs((current) => current.filter((doc) => doc.id !== tempId));
    } else {
      router.refresh();
    }
  }

  function handleDeleteDoc(docId: string) {
    setDeleteDocCandidateId(docId);
  }

  async function executeDeleteDoc(docId: string) {
    const previousDocs = [...docs];
    setDocs((current) => current.filter((d) => d.id !== docId));
    toast.success(t("docs.toast.docDeleted"));

    setSubmitting(true);
    const res = await deleteDocAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      docId,
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(actionError(res));
      // rollback
      setDocs(previousDocs);
    } else {
      router.refresh();
    }
  }

  async function handleAddDecision(e: React.FormEvent) {
    e.preventDefault();
    if (!decTitle.trim() || !decDecision.trim()) return;

    const titleText = decTitle.trim();
    const decisionText = decDecision.trim();
    const reasonText = decReason.trim();
    const decByVal = decByMemberId;
    const affectedVal = decAffectedTasks;

    setShowAddDecision(false);
    setDecTitle("");
    setDecDecision("");
    setDecReason("");
    setDecByMemberId("");
    setDecAffectedTasks([]);

    // Optimistic add
    const tempId = `temp-${Date.now()}`;
    const newDecision: DecisionRow = {
      id: tempId,
      projectId,
      title: titleText,
      decision: decisionText,
      reason: reasonText || null,
      decidedByMemberId: decByVal || null,
      affectedTaskIds: affectedVal,
      createdAt: new Date(),
    };
    setDecisions((current) => [newDecision, ...current]);
    toast.success(t("docs.toast.decisionLogged"));

    setSubmitting(true);
    const res = await logDecisionAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      data: {
        title: titleText,
        decision: decisionText,
        reason: reasonText || undefined,
        decidedByMemberId: decByVal || undefined,
        affectedTaskIds: affectedVal,
      },
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(actionError(res));
      // rollback
      setDecisions((current) => current.filter((d) => d.id !== tempId));
    } else {
      router.refresh();
    }
  }

  function handleDeleteDecision(decisionId: string) {
    setDeleteDecisionCandidateId(decisionId);
  }

  async function executeDeleteDecision(decisionId: string) {
    const previousDecisions = [...decisions];
    setDecisions((current) => current.filter((d) => d.id !== decisionId));
    toast.success(t("docs.toast.decisionDeleted"));

    setSubmitting(true);
    const res = await deleteDecisionAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      decisionId,
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(actionError(res));
      // rollback
      setDecisions(previousDecisions);
    } else {
      router.refresh();
    }
  }

  const toggleTaskSelection = (taskId: string) => {
    setDecAffectedTasks((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("docs")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition-all ${
            activeTab === "docs"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          {t("docs.tabDocs")}
        </button>
        <button
          onClick={() => setActiveTab("decisions")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition-all ${
            activeTab === "decisions"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <AlertCircle className="h-4 w-4" />
          {t("docs.tabDecisions")}
        </button>
      </div>

      {activeTab === "docs" ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Docs list */}
          <div className="space-y-4 xl:col-span-2">
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  {t("docs.wikiDocsHeading")}
                </h3>
                {!showAddDoc && (
                  <Button size="sm" onClick={() => setShowAddDoc(true)} className="gap-1.5 text-xs">
                    <Plus className="h-3.5 w-3.5" /> {t("docs.createDocument")}
                  </Button>
                )}
              </div>

              {docs.length === 0 ? (
                <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-3 h-8 w-8 text-primary opacity-40" />
                  <p className="text-sm font-semibold">{t("docs.emptyDocsTitle")}</p>
                  <p className="mt-0.5 text-xs">{t("docs.emptyDocsHint")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {docs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex flex-col gap-3 rounded-xl border border-neutral-200/40 bg-card p-4 shadow-sm transition-all hover:border-neutral-300 dark:border-neutral-800/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground">{doc.title}</span>
                            <span className="rounded border bg-muted px-2 py-0.5 text-[8px] font-bold uppercase text-muted-foreground">
                              {t(`docs.docType.${doc.type}`)}
                            </span>
                          </div>
                          <span className="mt-0.5 block text-[10px] text-muted-foreground">
                            {t("docs.createdOn", {
                              date: format.dateTime(new Date(doc.createdAt), "short"),
                            })}
                          </span>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-red-500 hover:bg-red-500/10"
                          disabled={submitting}
                          onClick={() => handleDeleteDoc(doc.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-border bg-surface-subtle p-3 text-xs font-normal leading-relaxed text-foreground">
                        {doc.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Add Doc Form */}
          <div className="space-y-4">
            {showAddDoc && (
              <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
                  <h3 className="text-sm font-semibold text-foreground">
                    {t("docs.writeDocument")}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddDoc(false)}>
                    {t("common.cancel")}
                  </Button>
                </div>

                <form onSubmit={handleAddDoc} className="space-y-4 text-xs font-semibold">
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">{t("docs.titleLabel")}</label>
                    <Input
                      required
                      placeholder={t("docs.titlePlaceholder")}
                      value={dTitle}
                      onChange={(e) => setDTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">{t("docs.typeLabel")}</label>
                    <select
                      value={dType}
                      onChange={(e) => setDType(e.target.value as any)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="requirement">{t("docs.typeOption.requirement")}</option>
                      <option value="technical_note">{t("docs.typeOption.technical_note")}</option>
                      <option value="decision">{t("docs.typeOption.decision")}</option>
                      <option value="meeting_note">{t("docs.typeOption.meeting_note")}</option>
                      <option value="scope">{t("docs.typeOption.scope")}</option>
                      <option value="other">{t("docs.typeOption.other")}</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">{t("docs.contentLabel")}</label>
                    <Textarea
                      required
                      placeholder={t("docs.contentPlaceholder")}
                      value={dContent}
                      onChange={(e) => setDContent(e.target.value)}
                      className="min-h-36"
                    />
                  </div>

                  <Button type="submit" disabled={submitting} className="w-full text-xs">
                    {submitting ? t("docs.saving") : t("docs.saveDocument")}
                  </Button>
                </form>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Decisions List */}
          <div className="space-y-4 xl:col-span-2">
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  {t("docs.decisionLogHeading")}
                </h3>
                {!showAddDecision && (
                  <Button
                    size="sm"
                    onClick={() => setShowAddDecision(true)}
                    className="gap-1.5 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" /> {t("docs.logDecision")}
                  </Button>
                )}
              </div>

              {decisions.length === 0 ? (
                <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
                  <AlertCircle className="mx-auto mb-3 h-8 w-8 text-primary opacity-40" />
                  <p className="text-sm font-semibold">{t("docs.emptyDecisionsTitle")}</p>
                  <p className="mt-0.5 text-xs font-normal">{t("docs.emptyDecisionsHint")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {decisions.map((dec) => {
                    const decider =
                      memberNameMap.get(dec.decidedByMemberId ?? "") ?? t("docs.unknownDecider");
                    return (
                      <div
                        key={dec.id}
                        className="flex flex-col gap-3 rounded-xl border border-neutral-200/40 bg-card p-4 shadow-sm transition-all hover:border-neutral-300 dark:border-neutral-800/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-0.5">
                            <span className="block text-xs font-bold text-foreground">
                              {dec.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {t.rich("docs.decidedByLogged", {
                                strong: (c) => <strong>{c}</strong>,
                                decider,
                                date: format.dateTime(new Date(dec.createdAt), "short"),
                              })}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-red-500 hover:bg-red-500/10"
                            disabled={submitting}
                            onClick={() => handleDeleteDecision(dec.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 gap-3 text-xs font-normal leading-normal md:grid-cols-2">
                          <div className="space-y-1">
                            <span className="block text-[10px] font-bold text-muted-foreground">
                              {t("docs.decisionOutcomeHeading")}
                            </span>
                            <p className="whitespace-pre-wrap text-foreground">{dec.decision}</p>
                          </div>
                          {dec.reason && (
                            <div className="space-y-1">
                              <span className="block text-[10px] font-bold text-muted-foreground">
                                {t("docs.decisionRationaleHeading")}
                              </span>
                              <p className="whitespace-pre-wrap text-foreground">{dec.reason}</p>
                            </div>
                          )}
                        </div>

                        {dec.affectedTaskIds && dec.affectedTaskIds.length > 0 && (
                          <div className="space-y-1 border-t border-neutral-100 pt-2 dark:border-neutral-800">
                            <span className="block text-[9px] font-bold uppercase text-muted-foreground">
                              {t("docs.affectedTasksHeading")}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {dec.affectedTaskIds.map((taskId) => {
                                const tTitle = taskTitleMap.get(taskId) ?? t("docs.unknownTask");
                                return (
                                  <span
                                    key={taskId}
                                    className="rounded border border-primary/10 bg-primary/5 px-2 py-0.5 text-[10px] font-bold text-primary"
                                  >
                                    {tTitle}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Add Decision Form */}
          <div className="space-y-4">
            {showAddDecision && (
              <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
                  <h3 className="text-sm font-semibold text-foreground">
                    {t("docs.logProjectDecision")}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddDecision(false)}>
                    {t("common.cancel")}
                  </Button>
                </div>

                <form onSubmit={handleAddDecision} className="space-y-4 text-xs font-semibold">
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">{t("docs.decisionTitleLabel")}</label>
                    <Input
                      required
                      placeholder={t("docs.decisionTitlePlaceholder")}
                      value={decTitle}
                      onChange={(e) => setDecTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">
                      {t("docs.decisionOutcomeLabel")}
                    </label>
                    <Textarea
                      required
                      placeholder={t("docs.decisionOutcomePlaceholder")}
                      value={decDecision}
                      onChange={(e) => setDecDecision(e.target.value)}
                      className="min-h-20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">{t("docs.rationaleLabel")}</label>
                    <Textarea
                      placeholder={t("docs.rationalePlaceholder")}
                      value={decReason}
                      onChange={(e) => setDecReason(e.target.value)}
                      className="min-h-16"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">{t("docs.decidedByLabel")}</label>
                    <select
                      value={decByMemberId}
                      onChange={(e) => setDecByMemberId(e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">{t("docs.selectMember")}</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.fullName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="mb-1 block text-muted-foreground">
                      {t("docs.affectedTasksLabel")}
                    </label>
                    <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border bg-background p-2">
                      {tasks.map((task) => (
                        <label
                          key={task.id}
                          className="flex cursor-pointer items-center gap-2 rounded p-1.5 text-[10px] transition-colors hover:bg-muted/40"
                        >
                          <input
                            type="checkbox"
                            checked={decAffectedTasks.includes(task.id)}
                            onChange={() => toggleTaskSelection(task.id)}
                            className="h-3.5 w-3.5 rounded border-input text-primary focus:ring-primary"
                          />
                          <span className="truncate">{task.title}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <Button type="submit" disabled={submitting} className="w-full text-xs">
                    {submitting ? t("docs.logging") : t("docs.logProjectDecision")}
                  </Button>
                </form>
              </div>
            )}

            <div className="space-y-3 rounded-2xl border border-border bg-card p-5 text-xs shadow-sm">
              <h4 className="flex items-center gap-1 font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                {t("docs.decisionTriggerHeading")}
              </h4>
              <p className="leading-relaxed text-muted-foreground">
                {t.rich("docs.decisionTriggerBody", { code: (c) => <code>{c}</code> })}
              </p>
            </div>
          </div>
        </div>
      )}

      <ConfirmationDialog
        isOpen={deleteDocCandidateId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteDocCandidateId(null);
        }}
        title={t("docs.deleteDocTitle")}
        description={t("docs.deleteDocDescription")}
        variant="destructive"
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (deleteDocCandidateId) {
            await executeDeleteDoc(deleteDocCandidateId);
            setDeleteDocCandidateId(null);
          }
        }}
      />

      <ConfirmationDialog
        isOpen={deleteDecisionCandidateId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteDecisionCandidateId(null);
        }}
        title={t("docs.deleteDecisionTitle")}
        description={t("docs.deleteDecisionDescription")}
        variant="destructive"
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (deleteDecisionCandidateId) {
            await executeDeleteDecision(deleteDecisionCandidateId);
            setDeleteDecisionCandidateId(null);
          }
        }}
      />
    </div>
  );
}
