import "server-only";
import { and, asc, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import {
  db,
  channels,
  channelMembers,
  channelMessages,
  workspaceMembers,
  users,
  type Executor,
} from "@vieroc/db";

export type ChannelInsert = typeof channels.$inferInsert;
export type ChannelRow = typeof channels.$inferSelect;
export type ChannelMessageInsert = typeof channelMessages.$inferInsert;
export type ChannelMessageRow = typeof channelMessages.$inferSelect;

/** Open (non-DM) channels of a workspace. */
export async function listChannels(workspaceId: string, exec: Executor = db) {
  return exec
    .select({
      id: channels.id,
      name: channels.name,
      topic: channels.topic,
      createdAt: channels.createdAt,
    })
    .from(channels)
    .where(and(eq(channels.workspaceId, workspaceId), eq(channels.type, "channel")))
    .orderBy(asc(channels.createdAt));
}

/** DM channels the member participates in, labeled with the other side's name. */
export async function listDmsForMember(
  workspaceId: string,
  memberId: string,
  exec: Executor = db
) {
  const mine = exec
    .select({ channelId: channelMembers.channelId })
    .from(channelMembers)
    .where(eq(channelMembers.workspaceMemberId, memberId));

  return exec
    .select({
      id: channels.id,
      otherMemberId: channelMembers.workspaceMemberId,
      otherName: users.fullName,
      otherAvatarUrl: users.avatarUrl,
    })
    .from(channels)
    .innerJoin(channelMembers, eq(channelMembers.channelId, channels.id))
    .innerJoin(workspaceMembers, eq(workspaceMembers.id, channelMembers.workspaceMemberId))
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(
      and(
        eq(channels.workspaceId, workspaceId),
        eq(channels.type, "dm"),
        inArray(channels.id, mine),
        ne(channelMembers.workspaceMemberId, memberId)
      )
    )
    .orderBy(desc(channels.updatedAt));
}

export async function findById(id: string, exec: Executor = db): Promise<ChannelRow | null> {
  const [row] = await exec.select().from(channels).where(eq(channels.id, id)).limit(1);
  return row ?? null;
}

export async function findChannelByName(
  workspaceId: string,
  name: string,
  exec: Executor = db
): Promise<ChannelRow | null> {
  const [row] = await exec
    .select()
    .from(channels)
    .where(
      and(eq(channels.workspaceId, workspaceId), eq(channels.type, "channel"), eq(channels.name, name))
    )
    .limit(1);
  return row ?? null;
}

/** The existing DM channel between two members, if any. */
export async function findDmBetween(
  workspaceId: string,
  memberA: string,
  memberB: string,
  exec: Executor = db
): Promise<ChannelRow | null> {
  const a = exec
    .select({ channelId: channelMembers.channelId })
    .from(channelMembers)
    .where(eq(channelMembers.workspaceMemberId, memberA));
  const [row] = await exec
    .select({ channel: channels })
    .from(channels)
    .innerJoin(channelMembers, eq(channelMembers.channelId, channels.id))
    .where(
      and(
        eq(channels.workspaceId, workspaceId),
        eq(channels.type, "dm"),
        inArray(channels.id, a),
        eq(channelMembers.workspaceMemberId, memberB)
      )
    )
    .limit(1);
  return row?.channel ?? null;
}

export async function createChannel(values: ChannelInsert, exec: Executor = db): Promise<ChannelRow> {
  const [row] = await exec.insert(channels).values(values).returning();
  return row!;
}

export async function addMembers(
  channelId: string,
  memberIds: string[],
  exec: Executor = db
): Promise<void> {
  if (memberIds.length === 0) return;
  await exec
    .insert(channelMembers)
    .values(memberIds.map((workspaceMemberId) => ({ channelId, workspaceMemberId })))
    .onConflictDoNothing();
}

export async function isMember(
  channelId: string,
  memberId: string,
  exec: Executor = db
): Promise<boolean> {
  const [row] = await exec
    .select({ id: channelMembers.id })
    .from(channelMembers)
    .where(
      and(eq(channelMembers.channelId, channelId), eq(channelMembers.workspaceMemberId, memberId))
    )
    .limit(1);
  return !!row;
}

/** Messages with author identity; `after` enables incremental polling. */
export async function listMessages(
  channelId: string,
  opts: { after?: string; limit?: number } = {},
  exec: Executor = db
) {
  const conds = [eq(channelMessages.channelId, channelId)];
  if (opts.after) conds.push(gt(channelMessages.createdAt, new Date(opts.after)));
  return exec
    .select({
      id: channelMessages.id,
      body: channelMessages.body,
      createdAt: channelMessages.createdAt,
      authorMemberId: channelMessages.authorMemberId,
      authorName: users.fullName,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(channelMessages)
    .innerJoin(workspaceMembers, eq(workspaceMembers.id, channelMessages.authorMemberId))
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(and(...conds))
    .orderBy(asc(channelMessages.createdAt))
    .limit(opts.limit ?? 200);
}

export async function createMessage(
  values: ChannelMessageInsert,
  exec: Executor = db
): Promise<ChannelMessageRow> {
  const [row] = await exec.insert(channelMessages).values(values).returning();
  await exec
    .update(channels)
    .set({ updatedAt: sql`now()` })
    .where(eq(channels.id, values.channelId));
  return row!;
}

/** All members of the workspace — the DM directory. */
export async function listWorkspaceMembersWithNames(workspaceId: string, exec: Executor = db) {
  return exec
    .select({
      memberId: workspaceMembers.id,
      userId: workspaceMembers.userId,
      name: users.fullName,
      avatarUrl: users.avatarUrl,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(asc(users.fullName));
}
