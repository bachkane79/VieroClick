"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea } from "@vieroc/ui";
import { Plus, Trash2, Link as LinkIcon, Folder, Box, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  createWbsNodeAction,
  deleteWbsNodeAction,
  updateWbsNodeAction,
} from "@/modules/wbs/wbs.actions";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

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
  const [submitting, setSubmitting] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Form states for creating a new node
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newType, setNewType] = useState("deliverable"); // deliverable or work_package
  const [newParentId, setNewParentId] = useState("");
  const [newLinkedTaskId, setNewLinkedTaskId] = useState("");

  const [nodes, setNodes] = useState<NodeRow[]>(initialNodes);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes]);

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Build tree structure
  const rootNodes = nodes.filter((n) => !n.parentId);
  const childrenMap = new Map<string, NodeRow[]>();
  for (const n of nodes) {
    if (n.parentId) {
      const list = childrenMap.get(n.parentId) ?? [];
      list.push(n);
      childrenMap.set(n.parentId, list);
    }
  }

  // Sort child lists by position
  for (const [key, val] of childrenMap.entries()) {
    childrenMap.set(key, val.sort((a, b) => a.position - b.position));
  }
  const sortedRootNodes = rootNodes.sort((a, b) => a.position - b.position);

  async function submitNode(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const titleVal = newTitle.trim();
    const descVal = newDescription.trim() || null;
    const typeVal = newType;
    const parentVal = newParentId || null;
    const taskVal = newLinkedTaskId || null;

    setIsAdding(false);
    setNewTitle("");
    setNewDescription("");
    setNewParentId("");
    setNewLinkedTaskId("");

    // Optimistic add
    const tempId = `temp-${Date.now()}`;
    const newNode: NodeRow = {
      id: tempId,
      projectId,
      parentId: parentVal,
      title: titleVal,
      description: descVal,
      nodeType: typeVal,
      linkedTaskId: taskVal,
      position: nodes.length,
    };
    setNodes((current) => [...current, newNode]);
    toast.success("WBS Node created");

    setSubmitting(true);
    const res = await createWbsNodeAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      data: {
        title: titleVal,
        description: descVal || undefined,
        nodeType: typeVal,
        parentId: parentVal || undefined,
        linkedTaskId: taskVal || undefined,
        position: nodes.length,
      },
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      // rollback
      setNodes((current) => current.filter((n) => n.id !== tempId));
    } else {
      router.refresh();
    }
  }

  function deleteNode(nodeId: string) {
    setDeleteCandidateId(nodeId);
  }

  async function executeDeleteNode(nodeId: string) {
    const previousNodes = [...nodes];
    setNodes((current) => current.filter((n) => n.id !== nodeId));
    toast.success("WBS Node deleted");

    setSubmitting(true);
    const res = await deleteWbsNodeAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      nodeId,
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      // rollback
      setNodes(previousNodes);
    } else {
      router.refresh();
    }
  }

  async function handleLinkTask(nodeId: string, taskId: string) {
    const previousNodes = [...nodes];
    setNodes((current) =>
      current.map((n) => (n.id === nodeId ? { ...n, linkedTaskId: taskId || null } : n))
    );
    toast.success("Task link updated");

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
      toast.error(res.error);
      // rollback
      setNodes(previousNodes);
    } else {
      router.refresh();
    }
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
          className="flex flex-wrap items-center justify-between gap-4 py-2.5 px-4 rounded-xl border border-neutral-200/40 dark:border-neutral-800/40 bg-card hover:bg-muted/30 transition-colors shadow-sm"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button
              onClick={() => toggleExpand(node.id)}
              className={`w-5 h-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground shrink-0 ${
                !hasChildren && "opacity-0 cursor-default"
              }`}
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {node.nodeType === "deliverable" ? (
              <Folder className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <Box className="w-4 h-4 text-purple-500 shrink-0" />
            )}

            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold text-foreground block truncate">{node.title}</span>
              {node.description && (
                <span className="text-[10px] text-muted-foreground block truncate mt-0.5">
                  {node.description}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Task Link Selector */}
            <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-2 py-1 border border-neutral-200/40 dark:border-neutral-800/40 text-[10px]">
              <LinkIcon className="w-3 h-3 text-muted-foreground" />
              <select
                value={node.linkedTaskId ?? ""}
                onChange={(e) => handleLinkTask(node.id, e.target.value)}
                disabled={submitting}
                className="bg-transparent font-semibold focus:outline-none max-w-40 text-ellipsis text-foreground"
              >
                <option value="">Link Task...</option>
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
              className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10 shrink-0"
              disabled={submitting}
              onClick={() => deleteNode(node.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-1 mt-1">
            {children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Tree View Panel */}
      <div className="xl:col-span-2 space-y-4">
        <div className="p-5 border border-neutral-200/50 dark:border-neutral-800/50 rounded-2xl bg-card shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-neutral-100 dark:border-neutral-800">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Work Breakdown structure Tree
            </h3>
            {!isAdding && (
              <Button size="sm" onClick={() => setIsAdding(true)} className="gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> Add WBS Node
              </Button>
            )}
          </div>

          {nodes.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800">
              <Folder className="w-8 h-8 mx-auto mb-3 opacity-40 text-primary" />
              <p className="text-sm font-semibold">No WBS nodes defined</p>
              <p className="text-xs mt-0.5">
                Decompose project objectives into deliverables and work packages to organize implementation.
              </p>
              <Button size="sm" onClick={() => setIsAdding(true)} className="mt-4 gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> Create First Node
              </Button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {sortedRootNodes.map((n) => renderNode(n))}
            </div>
          )}
        </div>
      </div>

      {/* Creation / Sidebar Form Panel */}
      <div className="space-y-4">
        {isAdding && (
          <div className="p-5 border border-neutral-200/50 dark:border-neutral-800/50 rounded-2xl bg-card shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-neutral-100 dark:border-neutral-800">
              <h3 className="text-sm font-bold text-foreground">Create WBS Node</h3>
              <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
            </div>

            <form onSubmit={submitNode} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1.5">
                <label className="text-muted-foreground">Title</label>
                <Input
                  required
                  placeholder="e.g. Core Features Package"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground">Description</label>
                <Textarea
                  placeholder="Node scope and details..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="min-h-16"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-muted-foreground">Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="deliverable">Deliverable (Folder)</option>
                    <option value="work_package">Work Package (Box)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground">Parent Node</label>
                  <select
                    value={newParentId}
                    onChange={(e) => setNewParentId(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">None (Root)</option>
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
                <label className="text-muted-foreground">Link Project Task</label>
                <select
                  value={newLinkedTaskId}
                  onChange={(e) => setNewLinkedTaskId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Unlinked</option>
                  {tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
              </div>

              <Button type="submit" disabled={submitting} className="w-full text-xs">
                {submitting ? "Saving..." : "Save WBS Node"}
              </Button>
            </form>
          </div>
        )}

        <div className="p-5 border border-neutral-200/50 dark:border-neutral-800/50 rounded-2xl bg-card shadow-sm text-xs space-y-3">
          <h4 className="font-bold text-foreground">WBS Integration Info</h4>
          <p className="text-muted-foreground leading-relaxed">
            A Work Breakdown Structure (WBS) is a hierarchical decomposition of the total scope of work to be carried out by the project team.
          </p>
          <ul className="space-y-1.5 text-muted-foreground list-disc pl-4 leading-normal">
            <li><strong>Deliverables</strong> act as summary tasks or category groupings.</li>
            <li><strong>Work Packages</strong> represent specific deliverable work units that can be mapped 1-to-1 to execution tasks.</li>
          </ul>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={deleteCandidateId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteCandidateId(null);
        }}
        title="Delete WBS Node"
        description="Are you sure you want to delete this WBS node? This action cannot be undone."
        variant="destructive"
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleteCandidateId) {
            await executeDeleteNode(deleteCandidateId);
            setDeleteCandidateId(null);
          }
        }}
      />
    </div>
  );
}
