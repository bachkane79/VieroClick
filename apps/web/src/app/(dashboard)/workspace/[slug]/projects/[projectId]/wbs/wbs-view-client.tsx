"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Input, Textarea } from "@vieroc/ui";
import {
  Plus,
  Trash2,
  Link as LinkIcon,
  Folder,
  Box,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  createWbsNodeAction,
  deleteWbsNodeAction,
  updateWbsNodeAction,
} from "@/modules/wbs/wbs.actions";
import { useActionError } from "@/i18n/use-action-error";

interface NodeRow {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  description: string | null;
  nodeType: string;
  linkedTaskId: string | null;
  position: number;
}

interface Props {
  workspaceId: string;
  projectId: string;
  workspaceSlug: string;
  initialNodes: NodeRow[];
  tasks: Array<{ id: string; title: string }>;
}

export function WbsViewClient({
  workspaceId,
  projectId,
  workspaceSlug,
  initialNodes,
  tasks,
}: Props) {
  const router = useRouter();
  const t = useTranslations();
  const actionError = useActionError();
  const [submitting, setSubmitting] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Form states for creating a new node
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newType, setNewType] = useState("deliverable"); // deliverable or work_package
  const [newParentId, setNewParentId] = useState("");
  const [newLinkedTaskId, setNewLinkedTaskId] = useState("");

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Build tree structure
  const rootNodes = initialNodes.filter((n) => !n.parentId);
  const childrenMap = new Map<string, NodeRow[]>();
  for (const n of initialNodes) {
    if (n.parentId) {
      const list = childrenMap.get(n.parentId) ?? [];
      list.push(n);
      childrenMap.set(n.parentId, list);
    }
  }

  // Sort child lists by position
  for (const [key, val] of childrenMap.entries()) {
    childrenMap.set(
      key,
      val.sort((a, b) => a.position - b.position)
    );
  }
  const sortedRootNodes = rootNodes.sort((a, b) => a.position - b.position);

  async function submitNode(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setSubmitting(true);
    const res = await createWbsNodeAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      data: {
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        nodeType: newType,
        parentId: newParentId || undefined,
        linkedTaskId: newLinkedTaskId || undefined,
        position: initialNodes.length,
      },
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(actionError(res));
      return;
    }

    toast.success(t("project.wbs.nodeCreated"));
    setIsAdding(false);
    setNewTitle("");
    setNewDescription("");
    setNewParentId("");
    setNewLinkedTaskId("");
    router.refresh();
  }

  async function deleteNode(nodeId: string) {
    if (!confirm(t("project.wbs.deleteConfirm"))) return;

    setSubmitting(true);
    const res = await deleteWbsNodeAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      nodeId,
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(actionError(res));
      return;
    }

    toast.success(t("project.wbs.nodeDeleted"));
    router.refresh();
  }

  async function handleLinkTask(nodeId: string, taskId: string) {
    setSubmitting(true);
    const res = await updateWbsNodeAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      nodeId,
      data: {
        linkedTaskId: taskId || null,
      },
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(actionError(res));
      return;
    }

    toast.success(t("project.wbs.taskLinkUpdated"));
    router.refresh();
  }

  // Recursive node renderer
  const renderNode = (node: NodeRow, depth = 0) => {
    const children = childrenMap.get(node.id) ?? [];
    const isExpanded = expandedNodes[node.id] ?? true;
    const hasChildren = children.length > 0;

    return (
      <div key={node.id} className="space-y-1">
        <div
          style={{ paddingLeft: `${depth * 1.5 + 0.75}rem` }}
          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-neutral-200/40 bg-card px-4 py-2.5 shadow-sm transition-colors hover:bg-muted/30 dark:border-neutral-800/40"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <button
              onClick={() => toggleExpand(node.id)}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted ${
                !hasChildren && "cursor-default opacity-0"
              }`}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>

            {node.nodeType === "deliverable" ? (
              <Folder className="h-4 w-4 shrink-0 text-primary" />
            ) : (
              <Box className="h-4 w-4 shrink-0 text-primary" />
            )}

            <div className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold text-foreground">{node.title}</span>
              {node.description && (
                <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                  {node.description}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {/* Task Link Selector */}
            <div className="flex items-center gap-1.5 rounded-lg border border-neutral-200/40 bg-muted/40 px-2 py-1 text-[10px] dark:border-neutral-800/40">
              <LinkIcon className="h-3 w-3 text-muted-foreground" />
              <select
                value={node.linkedTaskId ?? ""}
                onChange={(e) => handleLinkTask(node.id, e.target.value)}
                disabled={submitting}
                className="max-w-40 text-ellipsis bg-transparent font-semibold text-foreground focus:outline-none"
              >
                <option value="">{t("project.wbs.linkTaskPlaceholder")}</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Delete button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-red-500 hover:bg-red-500/10 hover:text-red-600"
              disabled={submitting}
              onClick={() => deleteNode(node.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-1">
            {children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      {/* Tree View Panel */}
      <div className="space-y-4 xl:col-span-2">
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              {t("project.wbs.treeTitle")}
            </h3>
            {!isAdding && (
              <Button size="sm" onClick={() => setIsAdding(true)} className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> {t("project.wbs.addNode")}
              </Button>
            )}
          </div>

          {initialNodes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-input p-12 text-center text-muted-foreground">
              <Folder className="mx-auto mb-3 h-8 w-8 text-primary opacity-40" />
              <p className="text-sm font-semibold">{t("project.wbs.emptyTitle")}</p>
              <p className="mt-0.5 text-xs">{t("project.wbs.emptyDescription")}</p>
              <Button size="sm" onClick={() => setIsAdding(true)} className="mt-4 gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> {t("project.wbs.createFirst")}
              </Button>
            </div>
          ) : (
            <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
              {sortedRootNodes.map((n) => renderNode(n))}
            </div>
          )}
        </div>
      </div>

      {/* Creation / Sidebar Form Panel */}
      <div className="space-y-4">
        {isAdding && (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
              <h3 className="text-sm font-semibold text-foreground">
                {t("project.wbs.createTitle")}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
                {t("common.cancel")}
              </Button>
            </div>

            <form onSubmit={submitNode} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1.5">
                <label className="text-muted-foreground">{t("project.wbs.titleLabel")}</label>
                <Input
                  required
                  placeholder={t("project.wbs.titlePlaceholder")}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground">{t("project.wbs.descriptionLabel")}</label>
                <Textarea
                  placeholder={t("project.wbs.descriptionPlaceholder")}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="min-h-16"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-muted-foreground">{t("project.wbs.typeLabel")}</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="deliverable">{t("project.wbs.typeDeliverable")}</option>
                    <option value="work_package">{t("project.wbs.typeWorkPackage")}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground">{t("project.wbs.parentLabel")}</label>
                  <select
                    value={newParentId}
                    onChange={(e) => setNewParentId(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">{t("project.wbs.parentNone")}</option>
                    {initialNodes
                      .filter((n) => n.nodeType === "deliverable")
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.title}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground">{t("project.wbs.linkTaskLabel")}</label>
                <select
                  value={newLinkedTaskId}
                  onChange={(e) => setNewLinkedTaskId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">{t("project.wbs.unlinked")}</option>
                  {tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
              </div>

              <Button type="submit" disabled={submitting} className="w-full text-xs">
                {submitting ? t("project.wbs.saving") : t("project.wbs.saveNode")}
              </Button>
            </form>
          </div>
        )}

        <div className="space-y-3 rounded-2xl border border-border bg-card p-5 text-xs shadow-sm">
          <h4 className="font-semibold text-foreground">{t("project.wbs.infoTitle")}</h4>
          <p className="leading-relaxed text-muted-foreground">
            {t("project.wbs.infoDescription")}
          </p>
          <ul className="list-disc space-y-1.5 pl-4 leading-normal text-muted-foreground">
            <li>{t.rich("project.wbs.infoDeliverables", { b: (c) => <strong>{c}</strong> })}</li>
            <li>{t.rich("project.wbs.infoWorkPackages", { b: (c) => <strong>{c}</strong> })}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
