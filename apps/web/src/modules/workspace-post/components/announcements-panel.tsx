"use client";

import { useState } from "react";
import { Button, cn, Textarea } from "@vieroc/ui";
import { Megaphone, Pin, PinOff, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useFormatter, useTranslations } from "next-intl";
import { memberInitials } from "@/modules/task/status-colors";
import { useActionError } from "@/i18n/use-action-error";
import {
  createWorkspacePostAction,
  deleteWorkspacePostAction,
  setWorkspacePostPinnedAction,
} from "../workspace-post.actions";

export interface PostView {
  id: string;
  body: string;
  pinned: boolean;
  authorMemberId: string;
  authorName: string;
  createdAt: string;
}

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  initialPosts: PostView[];
  canManage: boolean;
  currentMemberId: string;
}

export function AnnouncementsPanel({
  workspaceId,
  workspaceSlug,
  initialPosts,
  canManage,
  currentMemberId,
}: Props) {
  const t = useTranslations();
  const actionError = useActionError();
  const format = useFormatter();
  const now = new Date();
  const [posts, setPosts] = useState<PostView[]>(initialPosts);
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const trimmed = body.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    const res = await createWorkspacePostAction({
      workspaceId,
      slug: workspaceSlug,
      data: { body: trimmed, pinned: pinned && canManage },
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(actionError(res));
      return;
    }
    setPosts((cur) => [
      {
        id: res.data.id,
        body: trimmed,
        pinned: res.data.pinned,
        authorMemberId: currentMemberId,
        authorName: t("announcements.you"),
        createdAt: new Date().toISOString(),
      },
      ...cur,
    ]);
    setBody("");
    setPinned(false);
  }

  async function togglePin(post: PostView) {
    const next = !post.pinned;
    setPosts((cur) => cur.map((p) => (p.id === post.id ? { ...p, pinned: next } : p)));
    const res = await setWorkspacePostPinnedAction({
      workspaceId,
      slug: workspaceSlug,
      postId: post.id,
      pinned: next,
    });
    if (!res.ok) {
      setPosts((cur) => cur.map((p) => (p.id === post.id ? { ...p, pinned: post.pinned } : p)));
      toast.error(actionError(res));
    }
  }

  async function remove(id: string) {
    const res = await deleteWorkspacePostAction({ workspaceId, slug: workspaceSlug, postId: id });
    if (!res.ok) {
      toast.error(actionError(res));
      return;
    }
    setPosts((cur) => cur.filter((p) => p.id !== id));
  }

  const ordered = [...posts].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || +new Date(b.createdAt) - +new Date(a.createdAt)
  );

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-soft">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Megaphone className="h-4 w-4 text-primary" />
        {t("announcements.teamBoard")}
      </h2>

      <div className="mb-3.5 rounded-xl border border-border/70 bg-surface-subtle p-2.5">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("announcements.placeholder")}
          className="min-h-16 border-0 bg-transparent text-xs shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center justify-between gap-2 px-1 pt-1">
          {canManage ? (
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="h-3.5 w-3.5 rounded text-primary focus:ring-primary/40"
              />
              <Pin className="h-3 w-3" /> {t("announcements.pin")}
            </label>
          ) : (
            <span />
          )}
          <Button
            type="button"
            variant="dark"
            size="sm"
            className="h-7 gap-1.5 px-3.5 text-xs"
            disabled={submitting || !body.trim()}
            onClick={submit}
          >
            <Send className="h-3 w-3" />
            {t("announcements.post")}
          </Button>
        </div>
      </div>

      {ordered.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">{t("announcements.empty")}</p>
      ) : (
        <div className="space-y-2">
          {ordered.map((post) => {
            const mine = post.authorMemberId === currentMemberId;
            return (
              <article
                key={post.id}
                className={cn(
                  "group rounded-md border p-3",
                  post.pinned ? "border-primary/30 bg-primary/[0.04]" : "bg-card"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                      {memberInitials(post.authorName)}
                    </span>
                    <span className="text-sm font-medium">{post.authorName}</span>
                    {post.pinned && <Pin className="h-3 w-3 text-primary" />}
                    <span className="text-[11px] text-muted-foreground">
                      {format.relativeTime(new Date(post.createdAt), now)}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {canManage && (
                      <button
                        type="button"
                        aria-label={post.pinned ? t("announcements.unpin") : t("announcements.pin")}
                        onClick={() => togglePin(post)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        {post.pinned ? (
                          <PinOff className="h-3.5 w-3.5" />
                        ) : (
                          <Pin className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                    {(mine || canManage) && (
                      <button
                        type="button"
                        aria-label={t("common.delete")}
                        onClick={() => remove(post.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{post.body}</p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
