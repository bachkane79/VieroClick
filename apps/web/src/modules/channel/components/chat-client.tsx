"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@vieroc/ui";
import { useLocale } from "@/lib/i18n/client";
import { t } from "@/lib/i18n/dict";
import { Hash, MessagesSquare, Plus, SendHorizonal, UserCircle } from "lucide-react";
import {
  createChannelAction,
  listChannelMessagesAction,
  openDmAction,
  sendChannelMessageAction,
} from "../channel.actions";

export interface ChatMessage {
  id: string;
  body: string;
  createdAt: string;
  authorMemberId: string;
  authorName: string;
  authorAvatarUrl: string | null;
}

interface Props {
  workspaceId: string;
  slug: string;
  channel: { id: string; type: string; displayName: string; topic: string | null };
  channels: Array<{ id: string; name: string }>;
  dms: Array<{ id: string; otherName: string; otherAvatarUrl: string | null }>;
  members: Array<{ memberId: string; name: string; avatarUrl: string | null }>;
  myMemberId: string;
  canPost: boolean;
  initialMessages: ChatMessage[];
}

const POLL_MS = 4000;

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Discord-style chat surface (full-system spec §5.13): channel/DM directory on
 * the left, virtual-enough timeline + composer on the right. New messages
 * arrive via incremental polling (`after` cursor) — no websocket in the stack.
 */
export function ChatClient({
  workspaceId,
  slug,
  channel,
  channels,
  dms,
  members,
  myMemberId,
  canPost,
  initialMessages,
}: Props) {
  const router = useRouter();
  const locale = useLocale();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCreatedAt = useRef<string | null>(
    initialMessages.length > 0 ? initialMessages[initialMessages.length - 1]!.createdAt : null
  );

  // Reset the timeline when navigating between channels (same mounted client).
  useEffect(() => {
    setMessages(initialMessages);
    lastCreatedAt.current =
      initialMessages.length > 0 ? initialMessages[initialMessages.length - 1]!.createdAt : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id]);

  function appendNew(rows: ChatMessage[]) {
    if (rows.length === 0) return;
    setMessages((cur) => {
      const seen = new Set(cur.map((m) => m.id));
      const fresh = rows.filter((m) => !seen.has(m.id));
      if (fresh.length === 0) return cur;
      const next = [...cur, ...fresh];
      lastCreatedAt.current = next[next.length - 1]!.createdAt;
      return next;
    });
  }

  async function fetchNew() {
    const res = await listChannelMessagesAction({
      workspaceId,
      channelId: channel.id,
      after: lastCreatedAt.current ?? undefined,
    });
    if (res.ok) appendNew(res.data);
  }

  // Incremental polling keeps the room live for everyone in it.
  useEffect(() => {
    const timer = setInterval(fetchNew, POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id]);

  // Stick to the bottom when messages arrive and the user is already there.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [channel.id]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const res = await sendChannelMessageAction({ workspaceId, channelId: channel.id, data: { body } });
    setSending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDraft("");
    await fetchNew();
  }

  async function createChannel() {
    const name = newChannelName.trim();
    if (!name) return;
    const res = await createChannelAction({ workspaceId, slug, data: { name } });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setNewChannelName("");
    setCreatingChannel(false);
    router.push(`/workspace/${slug}/chat/${res.data.id}`);
  }

  async function openDm(targetMemberId: string) {
    const res = await openDmAction({ workspaceId, slug, data: { targetMemberId } });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.push(`/workspace/${slug}/chat/${res.data.id}`);
  }

  // Members who don't have an open DM with me yet.
  const dmNames = useMemo(() => new Set(dms.map((d) => d.otherName)), [dms]);
  const newDmTargets = members.filter((m) => !dmNames.has(m.name));

  // Group consecutive messages by the same author within 5 minutes, with a
  // divider between calendar days.
  const timeline = useMemo(() => {
    const items: Array<
      | { kind: "day"; key: string; label: string }
      | { kind: "message"; message: ChatMessage; withHeader: boolean }
    > = [];
    let prev: ChatMessage | null = null;
    for (const m of messages) {
      if (!prev || dayKey(prev.createdAt) !== dayKey(m.createdAt)) {
        items.push({ kind: "day", key: `day-${m.id}`, label: dayKey(m.createdAt) });
        prev = null;
      }
      const withHeader =
        !prev ||
        prev.authorMemberId !== m.authorMemberId ||
        new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60_000;
      items.push({ kind: "message", message: m, withHeader });
      prev = m;
    }
    return items;
  }, [messages]);

  return (
    <div className="flex h-full min-h-0">
      {/* ── Directory: channels + DMs (Discord-style) ─────────────────────── */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          <MessagesSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold">Chat</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <div className="flex items-center justify-between px-2 pb-1 pt-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {t(locale, "chat.channels")}
            </p>
            {canPost && (
              <button
                type="button"
                onClick={() => setCreatingChannel((v) => !v)}
                title={t(locale, "chat.addChannel")}
                className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {creatingChannel && (
            <div className="px-2 pb-1.5">
              <input
                autoFocus
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void createChannel();
                  if (e.key === "Escape") setCreatingChannel(false);
                }}
                placeholder={t(locale, "chat.channelNamePlaceholder")}
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-[13px] outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}
          <div className="space-y-px">
            {channels.map((c) => (
              <Link
                key={c.id}
                href={`/workspace/${slug}/chat/${c.id}`}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                  c.id === channel.id
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-foreground/80 hover:bg-accent"
                )}
              >
                <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{c.name}</span>
              </Link>
            ))}
          </div>

          <p className="px-2 pb-1 pt-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t(locale, "chat.dms")}
          </p>
          <div className="space-y-px">
            {dms.map((d) => (
              <Link
                key={d.id}
                href={`/workspace/${slug}/chat/${d.id}`}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                  d.id === channel.id
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-foreground/80 hover:bg-accent"
                )}
              >
                <Avatar name={d.otherName} url={d.otherAvatarUrl} />
                <span className="truncate">{d.otherName}</span>
              </Link>
            ))}
            {newDmTargets.map((m) => (
              <button
                key={m.memberId}
                type="button"
                onClick={() => openDm(m.memberId)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title={t(locale, "chat.startDm", { name: m.name })}
              >
                <Avatar name={m.name} url={m.avatarUrl} />
                <span className="truncate">{m.name}</span>
                <Plus className="ml-auto h-3 w-3 shrink-0 opacity-60" />
              </button>
            ))}
            {dms.length === 0 && newDmTargets.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">{t(locale, "chat.noMembers")}</p>
            )}
          </div>
        </div>
      </aside>

      {/* ── Room: header + timeline + composer ────────────────────────────── */}
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          {channel.type === "dm" ? (
            <UserCircle className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Hash className="h-4 w-4 text-muted-foreground" />
          )}
          <h1 className="text-sm font-bold">{channel.displayName}</h1>
          {channel.topic && (
            <span className="min-w-0 truncate border-l border-border pl-2 text-xs text-muted-foreground">
              {channel.topic}
            </span>
          )}
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {timeline.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <MessagesSquare className="mb-2 h-8 w-8 opacity-40" />
              <p className="text-sm font-semibold">{t(locale, "chat.emptyTitle")}</p>
              <p className="mt-1 text-xs">{t(locale, "chat.emptySub")}</p>
            </div>
          )}
          {timeline.map((item) =>
            item.kind === "day" ? (
              <div key={item.key} className="my-3 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
            ) : (
              <div
                key={item.message.id}
                className={cn("group flex gap-2.5 px-1", item.withHeader ? "mt-2.5" : "mt-0.5")}
              >
                <div className="w-8 shrink-0 pt-0.5">
                  {item.withHeader && (
                    <Avatar name={item.message.authorName} url={item.message.authorAvatarUrl} size={32} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {item.withHeader && (
                    <p className="flex items-baseline gap-2">
                      <span
                        className={cn(
                          "text-[13px] font-bold",
                          item.message.authorMemberId === myMemberId ? "text-primary" : "text-foreground"
                        )}
                      >
                        {item.message.authorName}
                      </span>
                      <span className="text-[10.5px] text-muted-foreground">
                        {timeLabel(item.message.createdAt)}
                      </span>
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words text-[13.5px] leading-6 text-foreground/90">
                    {item.message.body}
                  </p>
                </div>
              </div>
            )
          )}
        </div>

        <footer className="shrink-0 border-t border-border p-3">
          {canPost ? (
            <div className="flex items-end gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-soft focus-within:ring-2 focus-within:ring-primary/25">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={Math.min(6, Math.max(1, draft.split("\n").length))}
                placeholder={t(locale, "chat.composerPlaceholder", { channel: channel.displayName })}
                className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent text-[13.5px] leading-6 outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={!draft.trim() || sending}
                title={t(locale, "chat.send")}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
              >
                <SendHorizonal className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <p className="px-1 text-center text-xs text-muted-foreground">{t(locale, "chat.readOnly")}</p>
          )}
          <p className="mt-1 px-1 text-[10.5px] text-muted-foreground">{t(locale, "chat.hint")}</p>
        </footer>
      </section>
    </div>
  );
}

function Avatar({ name, url, size = 20 }: { name: string; url: string | null; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-secondary font-bold uppercase text-foreground/70"
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.38) }}
    >
      {name.charAt(0)}
    </span>
  );
}
