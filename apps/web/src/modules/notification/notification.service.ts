import "server-only";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { ValidationError } from "@/server/lib/errors";
import { markReadSchema, snoozeSchema, type SnoozeInput } from "./notification.schema";
import type { InboxTab } from "./notification.repo";
import { assertCanReadOwnNotifications } from "./notification.policy";
import * as repo from "./notification.repo";
import * as events from "./notification.events";

export async function listMyNotifications(workspaceId: string) {
  const ctx = await requireActor(workspaceId);
  assertCanReadOwnNotifications(ctx);
  return repo.listForRecipient(workspaceId, ctx.workspaceMemberId);
}

/** WP-D5: one of the 4 Inbox tabs — Primary/Other/Later/Cleared. */
export async function listInbox(workspaceId: string, tab: InboxTab) {
  const ctx = await requireActor(workspaceId);
  assertCanReadOwnNotifications(ctx);
  return repo.listInbox(workspaceId, ctx.workspaceMemberId, tab);
}

export async function snooze(p: { workspaceId: string; input: unknown }) {
  const data: SnoozeInput = snoozeSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId);
  assertCanReadOwnNotifications(ctx);

  return db.transaction(async (tx) => {
    await repo.snooze(data.ids, ctx.workspaceMemberId, new Date(data.until), tx);
    return { ids: data.ids };
  });
}

/** WP-D5: clears active (Primary/Other) items; guards against clearing an already-empty inbox. */
export async function clearAll(p: { workspaceId: string }) {
  const ctx = await requireActor(p.workspaceId);
  assertCanReadOwnNotifications(ctx);

  const activeCount = await repo.countActive(p.workspaceId, ctx.workspaceMemberId);
  if (activeCount === 0) throw new ValidationError("Inbox is already empty");

  return db.transaction(async (tx) => {
    await repo.clearAll(p.workspaceId, ctx.workspaceMemberId, tx);
    return { cleared: activeCount };
  });
}

export async function unreadCount(workspaceId: string) {
  const ctx = await requireActor(workspaceId);
  assertCanReadOwnNotifications(ctx);
  return repo.countUnread(workspaceId, ctx.workspaceMemberId);
}

export async function markRead(p: { workspaceId: string; input: unknown }) {
  const data = markReadSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId);
  assertCanReadOwnNotifications(ctx);

  return db.transaction(async (tx) => {
    await repo.markRead(data.ids, ctx.workspaceMemberId, tx);
    await events.notificationsRead(tx, ctx, data.ids);
    return { ids: data.ids };
  });
}

export async function markAllRead(p: { workspaceId: string }) {
  const ctx = await requireActor(p.workspaceId);
  assertCanReadOwnNotifications(ctx);

  return db.transaction(async (tx) => {
    await repo.markAllRead(p.workspaceId, ctx.workspaceMemberId, tx);
    return { ok: true };
  });
}
