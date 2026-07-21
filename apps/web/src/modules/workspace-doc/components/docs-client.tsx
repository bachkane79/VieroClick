"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, cn, Input } from "@vieroc/ui";
import { ChevronDown, ChevronRight, Eye, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createWorkspaceDocAction,
  deleteWorkspaceDocAction,
  updateWorkspaceDocAction,
} from "../workspace-doc.actions";

export interface DocNode {
  id: string;
  parentId: string | null;
  title: string;
  content: string;
  updatedAt: string;
}

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  initialDocs: DocNode[];
  /** Deep-link target (`?doc=<id>`) — e.g. from the sidebar Docs panel. */
  initialDocId?: string | null;
}

/** Minimal, dependency-free markdown → HTML (escaped first). */
function renderMarkdown(src: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    esc(s)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="text-primary underline" href="$2" target="_blank" rel="noreferrer">$1</a>')
      .replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-[0.85em]">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");

  const lines = src.split("\n");
  const out: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };
  for (const line of lines) {
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) {
        out.push('<ul class="ml-5 list-disc space-y-1">');
        inList = true;
      }
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ""))}</li>`);
      continue;
    }
    closeList();
    if (/^###\s+/.test(line)) out.push(`<h3 class="mt-4 text-base font-semibold">${inline(line.slice(4))}</h3>`);
    else if (/^##\s+/.test(line)) out.push(`<h2 class="mt-5 text-lg font-bold">${inline(line.slice(3))}</h2>`);
    else if (/^#\s+/.test(line)) out.push(`<h1 class="mt-2 text-xl font-bold">${inline(line.slice(2))}</h1>`);
    else if (line.trim() === "") out.push("");
    else out.push(`<p class="leading-7">${inline(line)}</p>`);
  }
  closeList();
  return out.join("\n");
}

export function DocsClient({ workspaceId, workspaceSlug, initialDocs, initialDocId }: Props) {
  const initial = initialDocs.find((d) => d.id === initialDocId) ?? initialDocs[0] ?? null;
  const [docs, setDocs] = useState<DocNode[]>(initialDocs);
  const [selectedId, setSelectedId] = useState<string | null>(initial?.id ?? null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Follow ?doc= when it changes while the page stays mounted (sidebar links).
  // Never clobber unsaved edits.
  useEffect(() => {
    if (!initialDocId || initialDocId === selectedId || dirty) return;
    const target = docs.find((d) => d.id === initialDocId);
    if (target) selectDoc(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDocId]);

  const childrenOf = useMemo(() => {
    const map = new Map<string | null, DocNode[]>();
    for (const d of docs) {
      const list = map.get(d.parentId) ?? [];
      list.push(d);
      map.set(d.parentId, list);
    }
    return map;
  }, [docs]);

  const selected = docs.find((d) => d.id === selectedId) ?? null;

  function selectDoc(d: DocNode) {
    setSelectedId(d.id);
    setTitle(d.title);
    setContent(d.content);
    setMode("edit");
    setDirty(false);
  }

  async function createDoc(parentId: string | null) {
    const res = await createWorkspaceDocAction({
      workspaceId,
      slug: workspaceSlug,
      data: { title: "Untitled", parentId: parentId ?? undefined, content: "" },
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const node: DocNode = {
      id: res.data.id,
      parentId: res.data.parentId ?? null,
      title: res.data.title,
      content: res.data.content,
      updatedAt: String(res.data.updatedAt),
    };
    setDocs((cur) => [...cur, node]);
    selectDoc(node);
  }

  async function save() {
    if (!selected || saving) return;
    setSaving(true);
    const res = await updateWorkspaceDocAction({
      workspaceId,
      slug: workspaceSlug,
      docId: selected.id,
      data: { title: title.trim() || "Untitled", content },
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDocs((cur) =>
      cur.map((d) => (d.id === selected.id ? { ...d, title: title.trim() || "Untitled", content } : d))
    );
    setDirty(false);
    toast.success("Saved");
  }

  async function remove(id: string) {
    const res = await deleteWorkspaceDocAction({ workspaceId, slug: workspaceSlug, docId: id });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    // Drop the doc and any descendants from local state.
    const toDrop = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const d of docs) {
        if (d.parentId && toDrop.has(d.parentId) && !toDrop.has(d.id)) {
          toDrop.add(d.id);
          changed = true;
        }
      }
    }
    setDocs((cur) => cur.filter((d) => !toDrop.has(d.id)));
    if (selectedId && toDrop.has(selectedId)) {
      setSelectedId(null);
      setTitle("");
      setContent("");
    }
    toast.success("Deleted");
  }

  function renderTree(parentId: string | null, depth: number): React.ReactNode {
    const nodes = childrenOf.get(parentId) ?? [];
    return nodes.map((d) => {
      const kids = childrenOf.get(d.id) ?? [];
      const isCollapsed = collapsed[d.id];
      return (
        <div key={d.id}>
          <div
            className={cn(
              "group flex items-center gap-1 rounded-md pr-1 transition-colors",
              selectedId === d.id ? "bg-accent" : "hover:bg-accent/60"
            )}
            style={{ paddingLeft: depth * 12 }}
          >
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [d.id]: !c[d.id] }))}
              className={cn("rounded p-0.5 text-muted-foreground", kids.length === 0 && "invisible")}
              aria-label="Toggle"
            >
              {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => selectDoc(d)}
              className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left text-[13px]"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{d.title}</span>
            </button>
            <button
              type="button"
              onClick={() => createDoc(d.id)}
              title="Add sub-page"
              className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {!isCollapsed && renderTree(d.id, depth + 1)}
        </div>
      );
    });
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Tree */}
      <aside className="flex w-64 shrink-0 flex-col rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pages</span>
          <button
            type="button"
            onClick={() => createDoc(null)}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="New page"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5">
          {docs.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              No pages yet. Create the first team doc.
            </p>
          ) : (
            renderTree(null, 0)
          )}
        </div>
      </aside>

      {/* Editor */}
      <section className="flex min-w-0 flex-1 flex-col rounded-lg border bg-card">
        {selected ? (
          <>
            <div className="flex items-center gap-2 border-b px-4 py-2">
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setDirty(true);
                }}
                className="h-9 border-0 bg-transparent px-0 text-lg font-bold shadow-none focus-visible:ring-0"
                placeholder="Untitled"
              />
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMode(mode === "edit" ? "preview" : "edit")}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {mode === "edit" ? <Eye className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                  {mode === "edit" ? "Preview" : "Edit"}
                </button>
                <Button type="button" size="sm" className="h-8" disabled={saving || !dirty} onClick={save}>
                  {saving ? "Saving..." : "Save"}
                </Button>
                <button
                  type="button"
                  onClick={() => remove(selected.id)}
                  title="Delete page"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {mode === "edit" ? (
              <textarea
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setDirty(true);
                }}
                placeholder="Write with markdown — # heading, **bold**, - list, [link](url), `code`"
                className="min-h-0 flex-1 resize-none bg-transparent px-4 py-3 font-mono text-sm leading-6 outline-none"
              />
            ) : (
              <div
                className="prose-sm min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-3 text-sm"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
              />
            )}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center text-muted-foreground">
            <FileText className="mb-3 h-8 w-8 opacity-40" />
            <p className="text-sm font-semibold">Select or create a page</p>
            <p className="mt-1 text-xs">Workspace docs are shared with your whole team.</p>
          </div>
        )}
      </section>
    </div>
  );
}
