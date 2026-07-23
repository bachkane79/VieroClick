"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, cn, Textarea } from "@vieroc/ui";
import { Check, CheckCircle2, CornerDownRight, MessageSquare, Send, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import {
  addCommentAction,
  deleteCommentAction,
  listCommentsAction,
  resolveCommentAction,
} from "@/modules/comment/comment.actions";
import type { CommentView } from "@/modules/comment/comment.view";
import { memberInitials } from "../status-colors";
import type { MemberOptionView } from "../task.view";

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  projectId: string;
  taskId: string;
  members: MemberOptionView[];
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function TaskComments({ workspaceId, workspaceSlug, projectId, taskId, members }: Props) {
  const [comments, setComments] = useState<CommentView[]>([]);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<CommentView | null>(null);
  const [assignedMemberId, setAssignedMemberId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Mention autocomplete popover state.
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const memberByEmailLocal = useMemo(
    () => new Map(members.map((m) => [m.email.split("@")[0]?.toLowerCase() ?? "", m])),
    [members]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await listCommentsAction({ workspaceId, projectId, taskId });
      if (cancelled) return;
      setLoading(false);
      if (res.ok) setComments(res.data);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectId, taskId]);

  async function refresh() {
    const res = await listCommentsAction({ workspaceId, projectId, taskId });
    if (res.ok) setComments(res.data);
  }

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return members
      .filter(
        (m) => m.fullName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [mentionQuery, members]);

  function detectMention(value: string, caret: number) {
    // Find an `@token` immediately before the caret with no whitespace.
    const upToCaret = value.slice(0, caret);
    const match = /@([a-zA-Z0-9._-]*)$/.exec(upToCaret);
    if (match) {
      setMentionQuery(match[1] ?? "");
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  }

  function onBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setBody(e.target.value);
    detectMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
  }

  function applyMention(member: MemberOptionView) {
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? body.length;
    const upToCaret = body.slice(0, caret);
    const rest = body.slice(caret);
    const replaced = upToCaret.replace(/@([a-zA-Z0-9._-]*)$/, `@${member.email.split("@")[0]} `);
    const next = replaced + rest;
    setBody(next);
    setMentionQuery(null);
    // Restore focus and caret position after the inserted mention.
    requestAnimationFrame(() => {
      el?.focus();
      const pos = replaced.length;
      el?.setSelectionRange(pos, pos);
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery !== null && mentionMatches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionMatches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const picked = mentionMatches[mentionIndex];
        if (picked) applyMention(picked);
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        return;
      }
    }
    // Cmd/Ctrl+Enter submits.
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit();
    }
  }

  async function submit() {
    const trimmed = body.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    const result = await addCommentAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      taskId,
      data: {
        body: trimmed,
        parentCommentId: replyTo?.id ?? undefined,
        metadata: {
          links: [],
          assignedMemberId: assignedMemberId || undefined,
        },
      },
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setBody("");
    setReplyTo(null);
    setAssignedMemberId("");
    setMentionQuery(null);
    await refresh();
    toast.success(replyTo ? "Reply posted" : "Comment posted");
  }

  async function toggleResolved(comment: CommentView) {
    // Optimistic flip.
    setComments((cur) =>
      cur.map((c) => (c.id === comment.id ? { ...c, resolved: !c.resolved } : c))
    );
    const result = await resolveCommentAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      commentId: comment.id,
      resolved: !comment.resolved,
    });
    if (!result.ok) {
      setComments((cur) =>
        cur.map((c) => (c.id === comment.id ? { ...c, resolved: comment.resolved } : c))
      );
      toast.error(result.error);
    }
  }

  async function remove(commentId: string) {
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
    setComments((cur) => cur.filter((c) => c.id !== commentId));
    toast.success("Comment deleted");
  }

  // Build threaded rows: top-level comments each followed by their replies.
  const rows = useMemo(() => {
    const top = comments.filter((c) => !c.parentCommentId);
    const repliesByParent = new Map<string, CommentView[]>();
    for (const c of comments) {
      if (c.parentCommentId) {
        const list = repliesByParent.get(c.parentCommentId) ?? [];
        list.push(c);
        repliesByParent.set(c.parentCommentId, list);
      }
    }
    const out: { comment: CommentView; depth: number }[] = [];
    const placed = new Set<string>();
    for (const t of top) {
      out.push({ comment: t, depth: 0 });
      placed.add(t.id);
      for (const r of repliesByParent.get(t.id) ?? []) {
        out.push({ comment: r, depth: 1 });
        placed.add(r.id);
      }
    }
    // Orphaned replies (parent missing) render at top level.
    for (const c of comments) if (!placed.has(c.id)) out.push({ comment: c, depth: 0 });
    return out;
  }, [comments]);

  function renderBody(text: string) {
    // Highlight @mentions that resolve to a known member.
    const parts = text.split(/(@[a-zA-Z0-9._-]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        const key = part.slice(1).toLowerCase();
        const member = memberByEmailLocal.get(key);
        if (member) {
          return (
            <span key={i} className="rounded bg-primary/10 px-1 font-medium text-primary">
              @{member.fullName}
            </span>
          );
        }
      }
      return <span key={i}>{part}</span>;
    });
  }

  return (
    <section className="grid gap-3 border-t pt-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquare className="h-4 w-4" />
          Comments
        </h3>
        <span className="text-xs text-muted-foreground">{comments.length}</span>
      </div>

      <div className="space-y-2">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading comments…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            No comments yet. Start the conversation.
          </div>
        ) : (
          rows.map(({ comment, depth }) => {
            const author = memberById.get(comment.authorMemberId);
            const assigned = comment.assignedMemberId
              ? memberById.get(comment.assignedMemberId)
              : null;
            return (
              <article
                key={comment.id}
                id={`comment-${comment.id}`}
                style={{ marginLeft: depth ? 24 : 0 }}
                className={cn(
                  "group rounded-md border bg-card p-3 transition-colors",
                  comment.resolved && "border-green-500/30 bg-green-500/5"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {depth > 0 && (
                      <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                      {memberInitials(author?.fullName ?? "?")}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium leading-4">
                        {author?.fullName ?? "Workspace member"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDateTime(comment.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      aria-label={comment.resolved ? "Reopen comment" : "Resolve comment"}
                      onClick={() => toggleResolved(comment)}
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded hover:bg-accent",
                        comment.resolved ? "text-green-600" : "text-muted-foreground"
                      )}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete comment"
                      onClick={() => remove(comment.id)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{renderBody(comment.body)}</p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {assigned && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                      <UserPlus className="h-3 w-3" />
                      {assigned.fullName}
                    </span>
                  )}
                  {comment.resolved && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:text-green-400">
                      <Check className="h-3 w-3" />
                      Resolved
                    </span>
                  )}
                  {depth === 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTo(comment);
                        textareaRef.current?.focus();
                      }}
                      className="text-[11px] font-semibold text-primary hover:underline"
                    >
                      Reply
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Composer */}
      <div className="relative grid gap-2 rounded-2xl border border-border bg-surface-subtle p-3">
        {replyTo && (
          <div className="flex items-center justify-between rounded bg-primary/5 px-2 py-1 text-[11px] text-primary">
            <span className="truncate">
              Replying to {memberById.get(replyTo.authorMemberId)?.fullName ?? "comment"}
            </span>
            <button
              type="button"
              aria-label="Cancel reply"
              onClick={() => setReplyTo(null)}
              className="hover:underline"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={onBodyChange}
            onKeyDown={onKeyDown}
            placeholder={
              replyTo ? "Write a reply… @ to mention" : "Add a comment… @ to mention, ⌘/Ctrl+Enter to post"
            }
            className="min-h-20 bg-background"
          />
          {mentionQuery !== null && mentionMatches.length > 0 && (
            <ul className="absolute bottom-full left-2 z-50 mb-1 w-64 overflow-hidden rounded-md border bg-popover p-1 shadow-md">
              {mentionMatches.map((member, i) => (
                <li key={member.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applyMention(member);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                      i === mentionIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent"
                    )}
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">
                      {memberInitials(member.fullName)}
                    </span>
                    <span className="min-w-0 truncate">{member.fullName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <UserPlus className="h-3.5 w-3.5" />
            <select
              value={assignedMemberId}
              onChange={(e) => setAssignedMemberId(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Assign to…</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            size="sm"
            className="gap-2"
            disabled={submitting || !body.trim()}
            onClick={() => void submit()}
          >
            <Send className="h-3.5 w-3.5" />
            {submitting ? "Posting…" : replyTo ? "Reply" : "Post"}
          </Button>
        </div>
      </div>
    </section>
  );
}
