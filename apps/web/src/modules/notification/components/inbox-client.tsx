"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, cn } from "@vieroc/ui";
import { Bell, Check, CheckCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  markAllReadAction,
  markNotificationsReadAction,
} from "../notification.actions";
import { notificationHref, type NotificationView } from "../notification.view";

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  notifications: NotificationView[];
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.round((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(iso));
}

export function InboxClient({ workspaceId, workspaceSlug, notifications: initial }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationView[]>(initial);
  const [tab, setTab] = useState<"all" | "unread">("all");

  const unreadCount = useMemo(() => items.filter((n) => !n.isRead).length, [items]);
  const visible = tab === "unread" ? items.filter((n) => !n.isRead) : items;

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    setItems((cur) => cur.map((n) => (ids.includes(n.id) ? { ...n, isRead: true } : n)));
    const res = await markNotificationsReadAction({ workspaceId, data: { ids } });
    if (!res.ok) toast.error(res.error);
  }

  async function markAll() {
    const ids = items.filter((n) => !n.isRead).map((n) => n.id);
    if (ids.length === 0) return;
    setItems((cur) => cur.map((n) => ({ ...n, isRead: true })));
    const res = await markAllReadAction({ workspaceId });
    if (!res.ok) toast.error(res.error);
    else toast.success("All caught up");
  }

  function open(n: NotificationView) {
    if (!n.isRead) void markRead([n.id]);
    const href = notificationHref(workspaceSlug, n);
    if (href) router.push(href);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex rounded-md border bg-card p-1">
          <Button
            type="button"
            size="sm"
            variant={tab === "all" ? "default" : "ghost"}
            onClick={() => setTab("all")}
          >
            All
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tab === "unread" ? "default" : "ghost"}
            onClick={() => setTab("unread")}
          >
            Unread{unreadCount > 0 ? ` (${unreadCount})` : ""}
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={unreadCount === 0}
          onClick={markAll}
        >
          <CheckCheck className="h-4 w-4" />
          Mark all read
        </Button>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Bell className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-semibold">
            {tab === "unread" ? "No unread notifications" : "Your inbox is empty"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Mentions, assignments, and AI observer signals land here.
          </p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border bg-card shadow-sm">
          {visible.map((n) => {
            const isAgent = n.type.startsWith("agent.") || n.type.startsWith("comment.");
            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => open(n)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") open(n);
                }}
                className={cn(
                  "flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring",
                  !n.isRead && "bg-primary/[0.04]"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    isAgent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  {isAgent ? <Sparkles className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {!n.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    <p className={cn("truncate text-sm", n.isRead ? "font-medium" : "font-semibold")}>
                      {n.title}
                    </p>
                  </div>
                  {n.body && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">{relativeTime(n.createdAt)}</p>
                </div>
                {!n.isRead && (
                  <button
                    type="button"
                    aria-label="Mark read"
                    onClick={(e) => {
                      e.stopPropagation();
                      void markRead([n.id]);
                    }}
                    className="mt-0.5 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
