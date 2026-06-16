"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Button, Input, Textarea } from "@vieroc/ui";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  addTaskDependencyFromTaskAction,
  createTaskAction,
  deleteTaskAction,
  removeTaskDependencyFromTaskAction,
  updateTaskAction,
} from "../task.actions";
import {
  addCommentAction,
  deleteCommentAction,
  listCommentsAction,
} from "@/modules/comment/comment.actions";

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
}: Props) {
  const router = useRouter();
  const defaultStatusId = initialStatusId ?? statuses[0]?.id ?? "";
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [statusId, setStatusId] = useState(defaultStatusId);
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [assigneeMemberId, setAssigneeMemberId] = useState("");
  const [parentTaskId, setParentTaskId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimateHours, setEstimateHours] = useState("");
  const [labels, setLabels] = useState("");
  const [isMilestone, setIsMilestone] = useState(false);
  const [criteria, setCriteria] = useState<AcceptanceCriterionView[]>([]);
  const [blockerReason, setBlockerReason] = useState("");
  const [allowBlockedOverride, setAllowBlockedOverride] = useState(false);
  const [dependencyCandidate, setDependencyCandidate] = useState("");

  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentBody, setNewCommentBody] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setStatusId(task?.statusId ?? initialStatusId ?? statuses[0]?.id ?? "");
    setPriority(task?.priority ?? "medium");
    setAssigneeMemberId(task?.assigneeMemberId ?? "");
    setParentTaskId(task?.parentTaskId ?? "");
    setStartDate(task?.startDate ?? "");
    setDueDate(task?.dueDate ?? "");
    setEstimateHours(task?.estimateHours ?? "");
    setLabels(task?.labels.join(", ") ?? "");
    setIsMilestone(task?.isMilestone ?? false);
    setCriteria(task?.acceptanceCriteria.length ? task.acceptanceCriteria : []);
    setBlockerReason("");
    setAllowBlockedOverride(false);
    setDependencyCandidate("");
  }, [initialStatusId, open, statuses, task]);

  useEffect(() => {
    if (!open || !task) {
      setComments([]);
      return;
    }
    async function loadComments() {
      setLoadingComments(true);
      const res = await listCommentsAction({
        workspaceId,
        projectId,
        taskId: task!.id,
      });
      setLoadingComments(false);
      if (res.ok) {
        setComments(res.data);
      }
    }
    loadComments();
  }, [open, task, workspaceId, projectId]);

  async function submitComment() {
    if (!task || !newCommentBody.trim()) return;
    const body = newCommentBody.trim();
    setNewCommentBody("");
    const result = await addCommentAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      taskId: task.id,
      data: { body },
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const res = await listCommentsAction({
      workspaceId,
      projectId,
      taskId: task.id,
    });
    if (res.ok) {
      setComments(res.data);
    }
    toast.success("Comment posted");
  }

  async function deleteComment(commentId: string) {
    if (!task) return;
    const result = await deleteCommentAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      commentId,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setComments((current) => current.filter((c) => c.id !== commentId));
    toast.success("Comment deleted");
  }


  const selectedStatus = statuses.find((status) => status.id === statusId);
  const taskById = useMemo(() => new Map(tasks.map((item) => [item.id, item])), [tasks]);
  const blockerDependencies = task
    ? dependencies.filter((dependency) => dependency.blockedTaskId === task.id)
    : [];
  const availableBlockers = tasks.filter((item) => item.id !== task?.id);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!statusId || !title.trim()) return;

    setSubmitting(true);
    const estimate = estimateHours ? Number(estimateHours) : undefined;
    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      statusId,
      priority,
      assigneeMemberId: assigneeMemberId || null,
      parentTaskId: parentTaskId || null,
      startDate: startDate || undefined,
      dueDate: dueDate || undefined,
      estimateHours: Number.isFinite(estimate) ? estimate : undefined,
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

    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

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

                <Field label="Assignee" htmlFor="task-assignee">
                  <select
                    id="task-assignee"
                    value={assigneeMemberId}
                    onChange={(e) => setAssigneeMemberId(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Unassigned</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.fullName}
                      </option>
                    ))}
                  </select>
                </Field>

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

                <Field label="Estimate" htmlFor="task-estimate">
                  <Input
                    id="task-estimate"
                    type="number"
                    min="0"
                    step="0.25"
                    value={estimateHours}
                    onChange={(e) => setEstimateHours(e.target.value)}
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

              <section className="grid gap-2">
                <label htmlFor="task-labels" className="text-sm font-medium">
                  Labels
                </label>
                <Input
                  id="task-labels"
                  value={labels}
                  onChange={(e) => setLabels(e.target.value)}
                />
              </section>

              <section className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">Acceptance criteria</h3>
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

              <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={allowBlockedOverride}
                  onChange={(e) => setAllowBlockedOverride(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Override blocker dependency
              </label>

              {task && (
                <section className="grid gap-3 border-t pt-5">
                  <h3 className="text-sm font-semibold">Comments</h3>
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {loadingComments ? (
                      <p className="text-xs text-muted-foreground">Loading comments...</p>
                    ) : comments.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No comments yet. Start the conversation!</p>
                    ) : (
                      comments.map((comment) => {
                        const author = members.find((m) => m.id === comment.authorMemberId);
                        const authorName = author?.fullName ?? "Unknown Member";
                        return (
                          <div
                            key={comment.id}
                            className="rounded-lg bg-neutral-50 dark:bg-neutral-900 border p-3 text-sm flex items-start justify-between gap-3 group"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-xs">{authorName}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(comment.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                                {comment.body}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              onClick={() => deleteComment(comment.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="flex gap-2 items-end mt-2">
                    <Textarea
                      placeholder="Add a comment... Use @name to mention"
                      value={newCommentBody}
                      onChange={(e) => setNewCommentBody(e.target.value)}
                      className="min-h-16 flex-1 text-xs"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={!newCommentBody.trim()}
                      onClick={submitComment}
                    >
                      Post
                    </Button>
                  </div>
                </section>
              )}

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
