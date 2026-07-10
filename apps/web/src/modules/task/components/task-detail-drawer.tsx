"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Button, cn, Input, Textarea } from "@vieroc/ui";
import { Check, ChevronDown, Download, FileUp, Paperclip, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { uploadTaskAttachmentAction } from "@/modules/file/file.actions";
import type { TaskAttachmentView } from "@/modules/file/file.view";
import {
  addTaskDependencyFromTaskAction,
  createTaskAction,
  deleteTaskAction,
  removeTaskDependencyFromTaskAction,
  reviewTaskAction,
  setTaskAssigneesAction,
  updateTaskAction,
} from "../task.actions";
import { memberInitials } from "../status-colors";
import { TaskComments } from "./task-comments";

import type {
  AcceptanceCriterionView,
  MemberOptionView,
  TaskDependencyView,
  TaskStatusView,
  TaskView,
} from "../task.view";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceSlug: string;
  projectId: string;
  task: TaskView | null;
  initialStatusId?: string;
  tasks: TaskView[];
  statuses: TaskStatusView[];
  members: MemberOptionView[];
  dependencies: TaskDependencyView[];
  attachments: TaskAttachmentView[];
  onSelectTask: (task: TaskView) => void;
}

function newCriterion(): AcceptanceCriterionView {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
    text: "",
    required: true,
    checked: false,
  };
}

function splitLabels(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatFileSize(sizeBytes: number | null) {
  if (sizeBytes == null) return "";
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
}

export function TaskDetailDrawer({
  open,
  onOpenChange,
  workspaceId,
  workspaceSlug,
  projectId,
  task,
  initialStatusId,
  tasks,
  statuses,
  members,
  dependencies,
  attachments,
}: Props) {
  const router = useRouter();
  const defaultStatusId = initialStatusId ?? statuses[0]?.id ?? "";
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [statusId, setStatusId] = useState(defaultStatusId);
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [assigneeMemberIds, setAssigneeMemberIds] = useState<string[]>([]);
  const [parentTaskId, setParentTaskId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimateHours, setEstimateHours] = useState("");
  const [actualHours, setActualHours] = useState("");
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [labels, setLabels] = useState("");
  const [isMilestone, setIsMilestone] = useState(false);
  const [criteria, setCriteria] = useState<AcceptanceCriterionView[]>([]);
  const [blockerReason, setBlockerReason] = useState("");
  const [allowBlockedOverride, setAllowBlockedOverride] = useState(false);
  const [dependencyCandidate, setDependencyCandidate] = useState("");
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setStatusId(task?.statusId ?? initialStatusId ?? statuses[0]?.id ?? "");
    setPriority(task?.priority ?? "medium");
    setAssigneeMemberIds(task?.assigneeMemberIds ?? []);
    setParentTaskId(task?.parentTaskId ?? "");
    setStartDate(task?.startDate ?? "");
    setDueDate(task?.dueDate ?? "");
    setEstimateHours(task?.estimateHours ?? "");
    setActualHours(task?.actualHours ?? "");
    setReviewFeedback("");
    setLabels(task?.labels.join(", ") ?? "");
    setIsMilestone(task?.isMilestone ?? false);
    setCriteria(task?.acceptanceCriteria.length ? task.acceptanceCriteria : []);
    setBlockerReason("");
    setAllowBlockedOverride(false);
    setDependencyCandidate("");
    setSelectedFile(null);
  }, [initialStatusId, open, statuses, task]);

  const selectedStatus = statuses.find((status) => status.id === statusId);
  const taskById = useMemo(() => new Map(tasks.map((item) => [item.id, item])), [tasks]);
  const blockerDependencies = task
    ? dependencies.filter((dependency) => dependency.blockedTaskId === task.id)
    : [];
  const availableBlockers = tasks.filter((item) => item.id !== task?.id);
  const taskAttachments = task
    ? attachments.filter((attachment) => attachment.taskId === task.id)
    : [];

  async function handleReview(decision: "approve" | "rework") {
    if (!task) return;
    if (decision === "rework" && !reviewFeedback.trim()) {
      toast.error("Add feedback so the assignee knows what to change.");
      return;
    }
    setReviewSubmitting(true);
    const actual = actualHours.trim() ? Number(actualHours) : undefined;
    const result = await reviewTaskAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      taskId: task.id,
      data: {
        decision,
        feedback: reviewFeedback.trim() || undefined,
        actualHours: actual !== undefined && Number.isFinite(actual) ? actual : undefined,
      },
    });
    setReviewSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(decision === "approve" ? "Task approved and closed" : "Sent back for rework");
    onOpenChange(false);
    router.refresh();
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!statusId || !title.trim()) return;

    setSubmitting(true);
    const estimate = estimateHours ? Number(estimateHours) : undefined;
    const actual = actualHours.trim() ? Number(actualHours) : undefined;
    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      statusId,
      priority,
      assigneeMemberId: assigneeMemberIds[0] ?? null,
      parentTaskId: parentTaskId || null,
      startDate: startDate || undefined,
      dueDate: dueDate || undefined,
      estimateHours: Number.isFinite(estimate) ? estimate : undefined,
      actualHours: actual !== undefined && Number.isFinite(actual) ? actual : undefined,
      labels: splitLabels(labels),
      isMilestone,
      acceptanceCriteria: criteria
        .map((item) => ({ ...item, text: item.text.trim() }))
        .filter((item) => item.text),
      blockerReason: blockerReason.trim() || undefined,
      allowBlockedOverride,
    };

    const result = task
      ? await updateTaskAction({
          workspaceId,
          projectId,
          slug: workspaceSlug,
          taskId: task.id,
          data: payload,
        })
      : await createTaskAction({
          workspaceId,
          projectId,
          slug: workspaceSlug,
          data: payload,
        });

    if (!result.ok) {
      setSubmitting(false);
      toast.error(result.error);
      return;
    }

    // Sync the full multi-assignee set (the base payload only carried the
    // primary). Only when 2+ assignees, since a single primary is already set.
    const savedId = task ? task.id : result.data.id;
    if (savedId && assigneeMemberIds.length > 1) {
      await setTaskAssigneesAction({
        workspaceId,
        projectId,
        slug: workspaceSlug,
        taskId: savedId,
        memberIds: assigneeMemberIds,
      });
    }

    setSubmitting(false);
    toast.success(task ? "Task updated" : "Task created");
    onOpenChange(false);
    router.refresh();
  }

  async function deleteTask() {
    if (!task) return;
    setSubmitting(true);
    const result = await deleteTaskAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      taskId: task.id,
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Task deleted");
    onOpenChange(false);
    router.refresh();
  }

  async function addDependency() {
    if (!task || !dependencyCandidate) return;
    const result = await addTaskDependencyFromTaskAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      blockerTaskId: dependencyCandidate,
      blockedTaskId: task.id,
    });

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Dependency added");
    setDependencyCandidate("");
    router.refresh();
  }

  async function removeDependency(dependencyId: string) {
    const result = await removeTaskDependencyFromTaskAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      dependencyId,
    });

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Dependency removed");
    router.refresh();
  }

  async function uploadAttachment() {
    if (!task || !selectedFile) return;

    const formData = new FormData();
    formData.set("file", selectedFile);
    setUploadSubmitting(true);
    const result = await uploadTaskAttachmentAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      taskId: task.id,
      data: formData,
    });
    setUploadSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Attachment uploaded");
    setSelectedFile(null);
    router.refresh();
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-neutral-950/30" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l bg-background shadow-2xl focus:outline-none">
          <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
            <div>
              <Dialog.Title className="text-lg font-semibold">
                {task ? "Task detail" : "New task"}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {selectedStatus?.name ?? "No status selected"}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
              <section className="grid gap-4">
                <div className="grid gap-2">
                  <label htmlFor="task-title" className="text-sm font-medium">
                    Title
                  </label>
                  <Input
                    id="task-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    maxLength={500}
                  />
                </div>

                <div className="grid gap-2">
                  <label htmlFor="task-description" className="text-sm font-medium">
                    Description
                  </label>
                  <Textarea
                    id="task-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-28"
                  />
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <Field label="Status" htmlFor="task-status">
                  <select
                    id="task-status"
                    value={statusId}
                    onChange={(e) => setStatusId(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {statuses.map((status) => (
                      <option key={status.id} value={status.id}>
                        {status.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Priority" htmlFor="task-priority">
                  <select
                    id="task-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as typeof priority)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </Field>

                <div className="grid gap-2">
                  <span className="text-sm font-medium">Assignees</span>
                  <AssigneeMultiSelect
                    members={members}
                    selected={assigneeMemberIds}
                    onToggle={(id) =>
                      setAssigneeMemberIds((cur) =>
                        cur.includes(id) ? cur.filter((m) => m !== id) : [...cur, id]
                      )
                    }
                  />
                </div>

                <Field label="Parent task" htmlFor="task-parent">
                  <select
                    id="task-parent"
                    value={parentTaskId}
                    onChange={(e) => setParentTaskId(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">None</option>
                    {tasks
                      .filter((item) => item.id !== task?.id)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                  </select>
                </Field>

                <Field label="Start date" htmlFor="task-start">
                  <Input
                    id="task-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </Field>

                <Field label="Due date" htmlFor="task-due">
                  <Input
                    id="task-due"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </Field>

                <Field label="Estimate (h)" htmlFor="task-estimate">
                  <Input
                    id="task-estimate"
                    type="number"
                    min="0"
                    step="0.25"
                    value={estimateHours}
                    onChange={(e) => setEstimateHours(e.target.value)}
                  />
                </Field>

                <Field label="Actual (h)" htmlFor="task-actual">
                  <Input
                    id="task-actual"
                    type="number"
                    min="0"
                    step="0.25"
                    placeholder="Log real time"
                    value={actualHours}
                    onChange={(e) => setActualHours(e.target.value)}
                  />
                </Field>

                <label className="flex items-center gap-2 self-end rounded-md border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isMilestone}
                    onChange={(e) => setIsMilestone(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  Milestone
                </label>
              </section>

              {selectedStatus?.type === "blocked" && (
                <section className="grid gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
                  <label htmlFor="task-blocker-reason" className="text-sm font-medium">
                    Blocker reason
                  </label>
                  <Textarea
                    id="task-blocker-reason"
                    value={blockerReason}
                    onChange={(e) => setBlockerReason(e.target.value)}
                    className="border-amber-200 bg-white"
                  />
                </section>
              )}

              {task && selectedStatus?.type === "in_review" && (
                <section className="grid gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <div className="text-sm font-semibold">Review</div>
                  <p className="text-xs text-muted-foreground">
                    Approve to close the task, or request changes with feedback. Only a reviewer or lead
                    can decide.
                  </p>
                  <Textarea
                    value={reviewFeedback}
                    onChange={(e) => setReviewFeedback(e.target.value)}
                    placeholder="Feedback for the assignee (required to request changes)"
                    className="min-h-[64px] text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => handleReview("approve")}
                      disabled={reviewSubmitting}
                      className="bg-green-600 text-white hover:bg-green-700"
                    >
                      Approve &amp; close
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleReview("rework")}
                      disabled={reviewSubmitting}
                    >
                      Request changes
                    </Button>
                  </div>
                </section>
              )}

              <section className="grid gap-2">
                <label htmlFor="task-labels" className="text-sm font-medium">
                  Labels
                </label>
                <Input id="task-labels" value={labels} onChange={(e) => setLabels(e.target.value)} />
              </section>

              <section className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    Acceptance criteria
                    {criteria.length > 0 && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {criteria.filter((c) => c.checked).length}/{criteria.length}
                      </span>
                    )}
                  </h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => setCriteria((current) => [...current, newCriterion()])}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
                {criteria.length > 0 && (
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${Math.round(
                          (criteria.filter((c) => c.checked).length / criteria.length) * 100
                        )}%`,
                      }}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  {criteria.map((item, index) => (
                    <div key={item.id ?? index} className="grid gap-2 rounded-md border p-3">
                      <Input
                        value={item.text}
                        onChange={(e) =>
                          setCriteria((current) =>
                            current.map((criterion, i) =>
                              i === index ? { ...criterion, text: e.target.value } : criterion
                            )
                          )
                        }
                      />
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex gap-4 text-sm">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={item.required}
                              onChange={(e) =>
                                setCriteria((current) =>
                                  current.map((criterion, i) =>
                                    i === index
                                      ? { ...criterion, required: e.target.checked }
                                      : criterion
                                  )
                                )
                              }
                            />
                            Required
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={item.checked}
                              onChange={(e) =>
                                setCriteria((current) =>
                                  current.map((criterion, i) =>
                                    i === index
                                      ? { ...criterion, checked: e.target.checked }
                                      : criterion
                                  )
                                )
                              }
                            />
                            Checked
                          </label>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remove criterion"
                          onClick={() =>
                            setCriteria((current) => current.filter((_, i) => i !== index))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {task && (
                <section className="grid gap-3">
                  <h3 className="text-sm font-semibold">Dependencies</h3>
                  <div className="space-y-2">
                    {blockerDependencies.map((dependency) => (
                      <div
                        key={dependency.id}
                        className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                      >
                        <span className="truncate text-sm">
                          {taskById.get(dependency.blockerTaskId)?.title ?? "Task"}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remove dependency"
                          onClick={() => removeDependency(dependency.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={dependencyCandidate}
                      onChange={(e) => setDependencyCandidate(e.target.value)}
                      className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="">Select blocker</option>
                      {availableBlockers.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                    <Button type="button" variant="outline" onClick={addDependency}>
                      Add
                    </Button>
                  </div>
                </section>
              )}

              {task && (
                <TaskComments
                  workspaceId={workspaceId}
                  workspaceSlug={workspaceSlug}
                  projectId={projectId}
                  taskId={task.id}
                  members={members}
                />
              )}

              {task && (
                <section className="grid gap-3 border-t pt-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <Paperclip className="h-4 w-4" />
                      Attachments
                    </h3>
                    <span className="text-xs text-muted-foreground">{taskAttachments.length}</span>
                  </div>

                  <div className="grid gap-2 rounded-md border bg-muted/20 p-3 md:grid-cols-[minmax(0,1fr)_auto]">
                    <Input
                      type="file"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                      className="bg-background"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      disabled={uploadSubmitting || !selectedFile}
                      onClick={uploadAttachment}
                    >
                      <FileUp className="h-4 w-4" />
                      {uploadSubmitting ? "Uploading..." : "Upload"}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {taskAttachments.map((attachment) => (
                      <div
                        key={attachment.attachmentId}
                        className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{attachment.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(attachment.sizeBytes)}
                          </p>
                        </div>
                        <a
                          href={`/api/files/${attachment.fileId}?projectId=${projectId}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2"
                          aria-label="Download attachment"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </div>
                    ))}
                    {taskAttachments.length === 0 && (
                      <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                        No attachments yet.
                      </div>
                    )}
                  </div>
                </section>
              )}

              <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={allowBlockedOverride}
                  onChange={(e) => setAllowBlockedOverride(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Override blocker dependency
              </label>
            </div>

            <div className="flex items-center justify-between gap-3 border-t px-5 py-4">
              <div>
                {task && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={deleteTask}
                    disabled={submitting}
                  >
                    Delete
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Dialog.Close asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Dialog.Close>
                <Button type="submit" disabled={submitting || !title.trim()}>
                  {submitting ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function AssigneeMultiSelect({
  members,
  selected,
  onToggle,
}: {
  members: MemberOptionView[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const byId = new Map(members.map((m) => [m.id, m]));
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex min-h-9 items-center justify-between gap-2 rounded-md border border-input bg-background px-2 py-1 text-left text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span className="flex min-w-0 flex-wrap gap-1">
            {selected.length === 0 && <span className="text-muted-foreground">Unassigned</span>}
            {selected.map((id) => {
              const m = byId.get(id);
              if (!m) return null;
              return (
                <span
                  key={id}
                  className="flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-0.5 pr-2 text-[11px] font-medium text-primary"
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/20 text-[8px]">
                    {memberInitials(m.fullName)}
                  </span>
                  {m.fullName}
                </span>
              );
            })}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-[60] max-h-64 min-w-[240px] overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {members.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No project members.</p>
          )}
          {members.map((m) => {
            const on = selected.includes(m.id);
            return (
              <DropdownMenu.CheckboxItem
                key={m.id}
                checked={on}
                onCheckedChange={() => onToggle(m.id)}
                onSelect={(e) => e.preventDefault()}
                className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-sm border",
                    on && "border-primary bg-primary text-primary-foreground"
                  )}
                >
                  {on && <Check className="h-3 w-3" />}
                </span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">
                  {memberInitials(m.fullName)}
                </span>
                {m.fullName}
              </DropdownMenu.CheckboxItem>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
