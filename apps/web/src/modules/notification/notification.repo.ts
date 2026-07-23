import "server-only";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db, notifications, type Executor } from "@vieroc/db";

export type NotificationInsert = typeof notifications.$inferInsert;
export type NotificationRow = typeof notifications.$inferSelect;

export type InboxTab = "primary" | "other" | "later" | "cleared";

/** WP-D5: not-snoozed-right-now = never snoozed, or a snooze that has already
 *  expired — this is what lets Later "return" a notification without a cron. */
const NOT_CURRENTLY_SNOOZED = or(
  isNull(notifications.snoozedUntil),
  sql`${notifications.snoozedUntil} <= now()`
);

function tabCondition(tab: InboxTab) {
  switch (tab) {
    case "primary":
      return and(eq(notifications.category, "primary"), isNull(notifications.clearedAt), NOT_CURRENTLY_SNOOZED);
    case "other":
      return and(eq(notifications.category, "other"), isNull(notifications.clearedAt), NOT_CURRENTLY_SNOOZED);
    case "later":
      return and(
        isNull(notifications.clearedAt),
        sql`${notifications.snoozedUntil} IS NOT NULL AND ${notifications.snoozedUntil} > now()`
      );
    case "cleared":
      return sql`${notifications.clearedAt} IS NOT NULL`;
  }
}

export async function listInbox(
  workspaceId: string,
  recipientMemberId: string,
  tab: InboxTab,
  exec: Executor = db
): Promise<NotificationRow[]> {
  return exec
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.workspaceId, workspaceId),
        eq(notifications.recipientMemberId, recipientMemberId),
        tabCondition(tab)
      )
    )
    .orderBy(desc(notifications.createdAt));
}

/** Primary + Other, not snoozed, not cleared — what `clearAll` operates on and what its empty-guard checks. */
export async function countActive(
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
        isNull(notifications.clearedAt),
        NOT_CURRENTLY_SNOOZED
      )
    );
  return rows.length;
}

export async function snooze(
  ids: string[],
  recipientMemberId: string,
  until: Date,
  exec: Executor = db
): Promise<void> {
  if (ids.length === 0) return;
  await exec
    .update(notifications)
    .set({ snoozedUntil: until })
    .where(and(inArray(notifications.id, ids), eq(notifications.recipientMemberId, recipientMemberId)));
}

/** Clears active (non-snoozed) Primary/Other items only — an intentionally
 *  snoozed item stays in Later, "clear all" isn't meant to undo that. */
export async function clearAll(
  workspaceId: string,
  recipientMemberId: string,
  exec: Executor = db
): Promise<void> {
  await exec
    .update(notifications)
    .set({ clearedAt: new Date() })
    .where(
      and(
        eq(notifications.workspaceId, workspaceId),
        eq(notifications.recipientMemberId, recipientMemberId),
        isNull(notifications.clearedAt),
        NOT_CURRENTLY_SNOOZED
      )
    );
}

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
