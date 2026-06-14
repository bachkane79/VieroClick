import "server-only";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { markReadSchema } from "./notification.schema";
import { assertCanReadOwnNotifications } from "./notification.policy";
import * as repo from "./notification.repo";
import * as events from "./notification.events";

export async function listMyNotifications(workspaceId: string) {
  const ctx = await requireActor(workspaceId);
  assertCanReadOwnNotifications(ctx);
  return repo.listForRecipient(workspaceId, ctx.workspaceMemberId);
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
