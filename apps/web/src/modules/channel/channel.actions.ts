"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./channel.service";

export async function listChatDirectoryAction(args: { workspaceId: string }) {
  return runAction(() => service.listChatDirectory(args.workspaceId));
}

export async function createChannelAction(args: { workspaceId: string; slug: string; data: unknown }) {
  return runAction(async () => {
    const channel = await service.createChannel({ workspaceId: args.workspaceId, input: args.data });
    revalidatePath(`/workspace/${args.slug}/chat`);
    return channel;
  });
}

export async function openDmAction(args: { workspaceId: string; slug: string; data: unknown }) {
  return runAction(async () => {
    const channel = await service.openDm({ workspaceId: args.workspaceId, input: args.data });
    revalidatePath(`/workspace/${args.slug}/chat`);
    return channel;
  });
}

export async function deleteChannelAction(args: { workspaceId: string; channelId: string; slug: string }) {
  return runAction(async () => {
    const result = await service.deleteChannel({ workspaceId: args.workspaceId, channelId: args.channelId });
    revalidatePath(`/workspace/${args.slug}/chat`);
    return result;
  });
}

export async function listChannelMessagesAction(args: {
  workspaceId: string;
  channelId: string;
  after?: string;
}) {
  return runAction(async () => {
    const rows = await service.listMessages(args);
    return rows.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      authorMemberId: m.authorMemberId,
      authorName: m.authorName,
      authorAvatarUrl: m.authorAvatarUrl,
    }));
  });
}

export async function chatUnreadCountsAction(args: { workspaceId: string }) {
  return runAction(() => service.getChatUnreadCounts(args.workspaceId));
}

export async function markChannelReadAction(args: { workspaceId: string; channelId: string }) {
  return runAction(() => service.markChannelRead(args));
}

export async function sendChannelMessageAction(args: {
  workspaceId: string;
  channelId: string;
  data: unknown;
}) {
  return runAction(async () => {
    const message = await service.sendMessage({
      workspaceId: args.workspaceId,
      channelId: args.channelId,
      input: args.data,
    });
    return { id: message.id, createdAt: message.createdAt.toISOString() };
  });
}
