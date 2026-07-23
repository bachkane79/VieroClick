"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea } from "@vieroc/ui";
import { toast } from "sonner";
import { FileText, Plus, Trash2, BookOpen, AlertCircle, Sparkles } from "lucide-react";
import { createDocAction, deleteDocAction } from "@/modules/project-doc/project-doc.actions";
import { logDecisionAction, deleteDecisionAction } from "@/modules/decision-log/decision-log.actions";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

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
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"docs" | "decisions">("docs");
  const [deleteDocCandidateId, setDeleteDocCandidateId] = useState<string | null>(null);
  const [deleteDecisionCandidateId, setDeleteDecisionCandidateId] = useState<string | null>(null);

  // Form toggles
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [showAddDecision, setShowAddDecision] = useState(false);

  // Form states - Doc
  const [dTitle, setDTitle] = useState("");
  const [dType, setDType] = useState<"requirement" | "technical_note" | "decision" | "meeting_note" | "scope" | "other">("other");
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
    toast.success("Document created");

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
      toast.error(res.error);
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
    toast.success("Document deleted");

    setSubmitting(true);
    const res = await deleteDocAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      docId,
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
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
    toast.success("Decision logged");

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
      toast.error(res.error);
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
    toast.success("Decision deleted");

    setSubmitting(true);
    const res = await deleteDecisionAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      decisionId,
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
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
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all ${
            activeTab === "docs"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Wiki & Documents
        </button>
        <button
          onClick={() => setActiveTab("decisions")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all ${
            activeTab === "decisions"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          Decision Log
        </button>
      </div>

      {activeTab === "docs" ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Docs list */}
          <div className="xl:col-span-2 space-y-4">
            <div className="p-5 border border-border rounded-2xl bg-card shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-neutral-100 dark:border-neutral-800">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Project Wiki Docs
                </h3>
                {!showAddDoc && (
                  <Button size="sm" onClick={() => setShowAddDoc(true)} className="gap-1.5 text-xs">
                    <Plus className="w-3.5 h-3.5" /> Create Document
                  </Button>
                )}
              </div>

              {docs.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground border border-dashed rounded-xl">
                  <FileText className="w-8 h-8 mx-auto mb-3 opacity-40 text-primary" />
                  <p className="text-sm font-semibold">No documents posted yet</p>
                  <p className="text-xs mt-0.5">Write technical specs, requirements, or meeting notes.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {docs.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-4 border border-neutral-200/40 dark:border-neutral-800/40 rounded-xl bg-card flex flex-col gap-3 shadow-sm hover:border-neutral-300 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-foreground">{doc.title}</span>
                            <span className="px-2 py-0.5 rounded bg-muted text-[8px] font-bold text-muted-foreground uppercase border">
                              {doc.type.replace("_", " ")}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground block mt-0.5">
                            Created: {new Date(doc.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:bg-red-500/10 shrink-0"
                          disabled={submitting}
                          onClick={() => handleDeleteDoc(doc.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      <div className="p-3 rounded-2xl border border-border bg-surface-subtle text-xs leading-relaxed text-foreground whitespace-pre-wrap font-normal max-h-48 overflow-y-auto">
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
              <div className="p-5 border border-border rounded-2xl bg-card shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b pb-3 border-neutral-100 dark:border-neutral-800">
                  <h3 className="text-sm font-semibold text-foreground">Write Document</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddDoc(false)}>
                    Cancel
                  </Button>
                </div>

                <form onSubmit={handleAddDoc} className="space-y-4 text-xs font-semibold">
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">Title</label>
                    <Input
                      required
                      placeholder="e.g. Requirement Spec v1.0"
                      value={dTitle}
                      onChange={(e) => setDTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">Type</label>
                    <select
                      value={dType}
                      onChange={(e) => setDType(e.target.value as any)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="requirement">Requirement Note</option>
                      <option value="technical_note">Technical Note</option>
                      <option value="decision">Decision Documentation</option>
                      <option value="meeting_note">Meeting Note</option>
                      <option value="scope">Project Scope Doc</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">Content (Markdown / Text)</label>
                    <Textarea
                      required
                      placeholder="Type details..."
                      value={dContent}
                      onChange={(e) => setDContent(e.target.value)}
                      className="min-h-36"
                    />
                  </div>

                  <Button type="submit" disabled={submitting} className="w-full text-xs">
                    {submitting ? "Saving..." : "Save Document"}
                  </Button>
                </form>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Decisions List */}
          <div className="xl:col-span-2 space-y-4">
            <div className="p-5 border border-border rounded-2xl bg-card shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-neutral-100 dark:border-neutral-800">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Project Decision Log
                </h3>
                {!showAddDecision && (
                  <Button size="sm" onClick={() => setShowAddDecision(true)} className="gap-1.5 text-xs">
                    <Plus className="w-3.5 h-3.5" /> Log Decision
                  </Button>
                )}
              </div>

              {decisions.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground border border-dashed rounded-xl">
                  <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-40 text-primary" />
                  <p className="text-sm font-semibold">No decisions logged yet</p>
                  <p className="text-xs mt-0.5 font-normal">Log architectural or product scope decisions for team alignment.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {decisions.map((dec) => {
                    const decider = memberNameMap.get(dec.decidedByMemberId ?? "") ?? "Workspace member";
                    return (
                      <div
                        key={dec.id}
                        className="p-4 border border-neutral-200/40 dark:border-neutral-800/40 rounded-xl bg-card flex flex-col gap-3 shadow-sm hover:border-neutral-300 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-0.5">
                            <span className="font-bold text-xs text-foreground block">{dec.title}</span>
                            <span className="text-[10px] text-muted-foreground">
                              Decided by: <strong>{decider}</strong> · logged{" "}
                              {new Date(dec.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:bg-red-500/10 shrink-0"
                            disabled={submitting}
                            onClick={() => handleDeleteDecision(dec.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs leading-normal font-normal">
                          <div className="space-y-1">
                            <span className="font-bold text-[10px] text-muted-foreground block">
                              Decision Outcome:
                            </span>
                            <p className="text-foreground whitespace-pre-wrap">{dec.decision}</p>
                          </div>
                          {dec.reason && (
                            <div className="space-y-1">
                              <span className="font-bold text-[10px] text-muted-foreground block">
                                Decision Rationale:
                              </span>
                              <p className="text-foreground whitespace-pre-wrap">{dec.reason}</p>
                            </div>
                          )}
                        </div>

                        {dec.affectedTaskIds && dec.affectedTaskIds.length > 0 && (
                          <div className="border-t pt-2 border-neutral-100 dark:border-neutral-800 space-y-1">
                            <span className="font-bold text-[9px] text-muted-foreground block uppercase">
                              Affected Tasks:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {dec.affectedTaskIds.map((taskId) => {
                                const tTitle = taskTitleMap.get(taskId) ?? "Task";
                                return (
                                  <span
                                    key={taskId}
                                    className="px-2 py-0.5 bg-primary/5 text-primary text-[10px] font-bold rounded border border-primary/10"
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
              <div className="p-5 border border-border rounded-2xl bg-card shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b pb-3 border-neutral-100 dark:border-neutral-800">
                  <h3 className="text-sm font-semibold text-foreground">Log Project Decision</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddDecision(false)}>
                    Cancel
                  </Button>
                </div>

                <form onSubmit={handleAddDecision} className="space-y-4 text-xs font-semibold">
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">Decision Title</label>
                    <Input
                      required
                      placeholder="e.g. Switch to Neon Serverless Postgres"
                      value={decTitle}
                      onChange={(e) => setDecTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">Decision Outcome</label>
                    <Textarea
                      required
                      placeholder="Describe the final decision made..."
                      value={decDecision}
                      onChange={(e) => setDecDecision(e.target.value)}
                      className="min-h-20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">Rationale / Reason</label>
                    <Textarea
                      placeholder="Why was this decision taken?"
                      value={decReason}
                      onChange={(e) => setDecReason(e.target.value)}
                      className="min-h-16"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground">Decided By</label>
                    <select
                      value={decByMemberId}
                      onChange={(e) => setDecByMemberId(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">Select Member...</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.fullName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground block mb-1">Affected Project Tasks</label>
                    <div className="border rounded-lg max-h-36 overflow-y-auto p-2 bg-background space-y-1">
                      {tasks.map((task) => (
                        <label
                          key={task.id}
                          className="flex items-center gap-2 p-1.5 hover:bg-muted/40 rounded transition-colors cursor-pointer text-[10px]"
                        >
                          <input
                            type="checkbox"
                            checked={decAffectedTasks.includes(task.id)}
                            onChange={() => toggleTaskSelection(task.id)}
                            className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
                          />
                          <span className="truncate">{task.title}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <Button type="submit" disabled={submitting} className="w-full text-xs">
                    {submitting ? "Logging..." : "Log Project Decision"}
                  </Button>
                </form>
              </div>
            )}

            <div className="p-5 border border-border rounded-2xl bg-card shadow-sm text-xs space-y-3">
              <h4 className="font-semibold text-foreground flex items-center gap-1">
                <Sparkles className="w-4 h-4 text-primary" />
                Decision Logs Trigger
              </h4>
              <p className="text-muted-foreground leading-relaxed">
                Logging a project decision triggers automatic <code>decision.created</code> notifications to all project members, keeping everyone in sync.
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
        title="Delete Document"
        description="Are you sure you want to delete this document? This action cannot be undone."
        variant="destructive"
        confirmLabel="Delete"
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
        title="Delete Decision Log"
        description="Are you sure you want to delete this decision log? This action cannot be undone."
        variant="destructive"
        confirmLabel="Delete"
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
