import "server-only";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError, ForbiddenError } from "@/server/lib/errors";
import { assertRateLimit } from "@/server/lib/rate-limit";
import * as repo from "./channel.repo";
import * as events from "./channel.events";
import { createChannelSchema, sendMessageSchema, openDmSchema } from "./channel.schema";
import {
  assertCanAccessChat,
  assertCanPostMessage,
  assertCanCreateChannel,
  assertCanManageChannel,
} from "./channel.policy";

/**
 * A member may enter an open channel of their workspace freely; a DM only if
 * they are one of its two participants. Returns the channel row.
 */
async function requireChannelAccess(ctx: { workspaceMemberId: string }, channelId: string, workspaceId: string) {
  const channel = await repo.findById(channelId);
  if (!channel || channel.workspaceId !== workspaceId) throw new NotFoundError("Channel");
  if (channel.type === "dm") {
    const member = await repo.isMember(channelId, ctx.workspaceMemberId);
    if (!member) throw new ForbiddenError("Not a participant of this conversation");
  }
  return channel;
}

/** Channels + my DMs — the chat sidebar dataset. Seeds #general on first visit. */
export async function listChatDirectory(workspaceId: string) {
  const ctx = await requireActor(workspaceId);
  assertCanAccessChat(ctx);

  let channels = await repo.listChannels(workspaceId);
  // First visit: seed the default open channel so the surface is never empty
  // (mirrors ClickUp's General). Only contributors can create channels, so
  // viewers on a brand-new workspace simply see an empty list.
  if (channels.length === 0 && ctx.workspaceRole !== "viewer" && ctx.workspaceRole !== "guest") {
    await db.transaction(async (tx) => {
      const channel = await repo.createChannel(
        {
          workspaceId,
          type: "channel",
          name: "general",
          topic: "Kênh chung của cả team",
          createdByMemberId: ctx.workspaceMemberId,
        },
        tx
      );
      await events.channelCreated(tx, ctx, channel);
    });
    channels = await repo.listChannels(workspaceId);
  }

  const [dms, members] = await Promise.all([
    repo.listDmsForMember(workspaceId, ctx.workspaceMemberId),
    repo.listWorkspaceMembersWithNames(workspaceId),
  ]);

  return {
    channels,
    dms,
    members: members.filter((m) => m.memberId !== ctx.workspaceMemberId),
    myMemberId: ctx.workspaceMemberId,
    canPost: ctx.workspaceRole !== "viewer" && ctx.workspaceRole !== "guest",
  };
}

export async function createChannel(p: { workspaceId: string; input: unknown }) {
  const data = createChannelSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId);
  assertCanCreateChannel(ctx);
  // WP-C5: cap channel creation per user (10 / min).
  await assertRateLimit(ctx.userId, "channel-create", { limit: 10, windowSec: 60 });

  const existing = await repo.findChannelByName(p.workspaceId, data.name);
  if (existing) return existing;

  return db.transaction(async (tx) => {
    const channel = await repo.createChannel(
      {
        workspaceId: p.workspaceId,
        type: "channel",
        name: data.name,
        topic: data.topic ?? null,
        createdByMemberId: ctx.workspaceMemberId,
      },
      tx
    );
    await events.channelCreated(tx, ctx, channel);
    return channel;
  });
}

/** Find or create the DM channel between me and the target member. */
export async function openDm(p: { workspaceId: string; input: unknown }) {
  const data = openDmSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId);
  assertCanAccessChat(ctx);
  if (data.targetMemberId === ctx.workspaceMemberId) {
    throw new ForbiddenError("Cannot open a conversation with yourself");
  }

  const existing = await repo.findDmBetween(p.workspaceId, ctx.workspaceMemberId, data.targetMemberId);
  if (existing) return existing;

  return db.transaction(async (tx) => {
    const channel = await repo.createChannel(
      {
        workspaceId: p.workspaceId,
        type: "dm",
        name: "dm",
        createdByMemberId: ctx.workspaceMemberId,
      },
      tx
    );
    await repo.addMembers(channel.id, [ctx.workspaceMemberId, data.targetMemberId], tx);
    return channel;
  });
}

export async function getChannel(p: { workspaceId: string; channelId: string }) {
  const ctx = await requireActor(p.workspaceId);
  assertCanAccessChat(ctx);
  const channel = await requireChannelAccess(ctx, p.channelId, p.workspaceId);

  // A DM is titled after the other participant.
  if (channel.type === "dm") {
    const dms = await repo.listDmsForMember(p.workspaceId, ctx.workspaceMemberId);
    const dm = dms.find((d) => d.id === channel.id);
    return { ...channel, displayName: dm?.otherName ?? "Direct message" };
  }
  return { ...channel, displayName: `#${channel.name}` };
}

export async function listMessages(p: { workspaceId: string; channelId: string; after?: string }) {
  const ctx = await requireActor(p.workspaceId);
  assertCanAccessChat(ctx);
  await requireChannelAccess(ctx, p.channelId, p.workspaceId);
  return repo.listMessages(p.channelId, { after: p.after });
}

/** WP-D4: hard-delete (no restore). Creator or workspace admin/owner only; DMs cannot be deleted this way. */
export async function deleteChannel(p: { workspaceId: string; channelId: string }) {
  const ctx = await requireActor(p.workspaceId);
  assertCanAccessChat(ctx);
  const channel = await requireChannelAccess(ctx, p.channelId, p.workspaceId);
  if (channel.type === "dm") throw new ForbiddenError("Direct messages cannot be deleted here");
  assertCanManageChannel(ctx, channel.createdByMemberId);

  return db.transaction(async (tx) => {
    await events.channelDeleted(tx, ctx, channel);
    await repo.remove(p.channelId, tx);
    return { id: p.channelId };
  });
}

export async function sendMessage(p: { workspaceId: string; channelId: string; input: unknown }) {
  const data = sendMessageSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId);
  assertCanPostMessage(ctx);
  // WP-C5: chat is the primary flood target — cap per user (30 msg / 10s).
  await assertRateLimit(ctx.userId, "chat-send", { limit: 30, windowSec: 10 });
  await requireChannelAccess(ctx, p.channelId, p.workspaceId);

  return db.transaction(async (tx) => {
    return repo.createMessage(
      {
        channelId: p.channelId,
        authorMemberId: ctx.workspaceMemberId,
        body: data.body.trim(),
      },
      tx
    );
  });
}
