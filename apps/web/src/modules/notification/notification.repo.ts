import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, notifications, type Executor } from "@vieroc/db";

export type NotificationInsert = typeof notifications.$inferInsert;
export type NotificationRow = typeof notifications.$inferSelect;

export async function listForRecipient(
  workspaceId: string,
  recipientMemberId: string,
  exec: Executor = db
): Promise<NotificationRow[]> {
  return exec
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.workspaceId, workspaceId),
        eq(notifications.recipientMemberId, recipientMemberId)
      )
    )
    .orderBy(desc(notifications.createdAt));
}

export async function countUnread(
  workspaceId: string,
  recipientMemberId: string,
  exec: Executor = db
): Promise<number> {
  const rows = await exec
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.workspaceId, workspaceId),
        eq(notifications.recipientMemberId, recipientMemberId),
        eq(notifications.isRead, false)
      )
    );
  return rows.length;
}

export async function markRead(
  ids: string[],
  recipientMemberId: string,
  exec: Executor = db
): Promise<void> {
  if (ids.length === 0) return;
  await exec
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        inArray(notifications.id, ids),
        eq(notifications.recipientMemberId, recipientMemberId)
      )
    );
}

export async function markAllRead(
  workspaceId: string,
  recipientMemberId: string,
  exec: Executor = db
): Promise<void> {
  await exec
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        eq(notifications.workspaceId, workspaceId),
        eq(notifications.recipientMemberId, recipientMemberId),
        eq(notifications.isRead, false)
      )
    );
}
