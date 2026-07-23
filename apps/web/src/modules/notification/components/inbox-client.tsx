"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Button, cn } from "@vieroc/ui";
import { Bell, Check, CheckCheck, Clock, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  clearAllAction,
  listInboxAction,
  markAllReadAction,
  markNotificationsReadAction,
  snoozeAction,
} from "../notification.actions";
import type { InboxTab } from "../notification.repo";
import { notificationHref, type NotificationView } from "../notification.view";

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  notifications: NotificationView[];
}

const TABS: { key: InboxTab; label: string }[] = [
  { key: "primary", label: "Primary" },
  { key: "other", label: "Other" },
  { key: "later", label: "Later" },
  { key: "cleared", label: "Cleared" },
];

const SNOOZE_PRESETS: { label: string; hours: number }[] = [
  { label: "1 hour", hours: 1 },
  { label: "Tomorrow", hours: 24 },
  { label: "Next week", hours: 24 * 7 },
];

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
  const [tab, setTab] = useState<InboxTab>("primary");
  const [items, setItems] = useState<NotificationView[]>(initial);
  const [loading, setLoading] = useState(false);

  async function loadTab(next: InboxTab) {
    setTab(next);
    setLoading(true);
    const res = await listInboxAction({ workspaceId, tab: next });
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setItems(res.data);
  }

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

  async function handleSnooze(id: string, hours: number) {
    const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    setItems((cur) => cur.filter((n) => n.id !== id));
    const res = await snoozeAction({ workspaceId, ids: [id], until });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Snoozed");
  }

  async function handleClearAll() {
    const res = await clearAllAction({ workspaceId });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Cleared ${res.data.cleared} notification${res.data.cleared === 1 ? "" : "s"}`);
    setItems([]);
  }

  function open(n: NotificationView) {
    if (!n.isRead) void markRead([n.id]);
    const href = notificationHref(workspaceSlug, n);
    if (href) router.push(href);
  }

  const unreadCount = items.filter((n) => !n.isRead).length;
  const canClearAll = (tab === "primary" || tab === "other") && items.length > 0;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex rounded-md border bg-card p-1">
          {TABS.map((t) => (
            <Button
              key={t.key}
              type="button"
              size="sm"
              variant={tab === t.key ? "default" : "ghost"}
              onClick={() => loadTab(t.key)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!canClearAll}
            onClick={handleClearAll}
          >
            <Trash2 className="h-4 w-4" />
            Clear all
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Bell className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-semibold">Nothing here</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Mentions, assignments, and AI observer signals land here.
          </p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border bg-card shadow-sm">
          {items.map((n) => {
            const isAgent = n.type.startsWith("agent.") || n.type.startsWith("comment.");
            const canSnooze = tab === "primary" || tab === "other";
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
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {tab === "later" && n.snoozedUntil
                      ? `Returns ${relativeTime(n.snoozedUntil)}`
                      : relativeTime(n.createdAt)}
                  </p>
                </div>
                {canSnooze && (
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        type="button"
                        aria-label="Snooze"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Clock className="h-4 w-4" />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        align="end"
                        sideOffset={4}
                        className="z-50 min-w-[150px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                      >
                        {SNOOZE_PRESETS.map((preset) => (
                          <DropdownMenu.Item
                            key={preset.label}
                            onSelect={() => handleSnooze(n.id, preset.hours)}
                            className="cursor-pointer rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent"
                          >
                            {preset.label}
                          </DropdownMenu.Item>
                        ))}
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                )}
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
