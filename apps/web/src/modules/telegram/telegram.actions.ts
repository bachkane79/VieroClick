"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./telegram.service";

interface BaseArgs {
  workspaceId: string;
  slug: string;
}

export async function saveTelegramBotAction(args: BaseArgs & { data: unknown }) {
  return runAction(async () => {
    const config = await service.saveBot({ workspaceId: args.workspaceId, input: args.data });
    revalidatePath(`/workspace/${args.slug}/settings`);
    return config;
  });
}

export async function updateTelegramBotAction(args: BaseArgs & { data: unknown }) {
  return runAction(async () => {
    const config = await service.updateBot({ workspaceId: args.workspaceId, input: args.data });
    revalidatePath(`/workspace/${args.slug}/settings`);
    return config;
  });
}

export async function removeTelegramBotAction(args: BaseArgs) {
  return runAction(async () => {
    const result = await service.removeBot({ workspaceId: args.workspaceId });
    revalidatePath(`/workspace/${args.slug}/settings`);
    return result;
  });
}

export async function detectTelegramChatAction(args: BaseArgs) {
  return runAction(async () => {
    const detected = await service.detectChat({ workspaceId: args.workspaceId });
    revalidatePath(`/workspace/${args.slug}/settings`);
    return detected;
  });
}

export async function testTelegramBotAction(args: BaseArgs) {
  return runAction(() => service.sendTest({ workspaceId: args.workspaceId }));
}

export async function linkTelegramChannelAction(args: BaseArgs & { data: unknown }) {
  return runAction(async () => {
    const channel = await service.linkChannel({
      workspaceId: args.workspaceId,
      input: args.data,
    });
    revalidatePath(`/workspace/${args.slug}`);
    return channel;
  });
}

export async function updateTelegramChannelAction(
  args: BaseArgs & { channelId: string; data: unknown }
) {
  return runAction(async () => {
    const channel = await service.updateChannel({
      workspaceId: args.workspaceId,
      channelId: args.channelId,
      input: args.data,
    });
    revalidatePath(`/workspace/${args.slug}`);
    return channel;
  });
}

export async function unlinkTelegramChannelAction(args: BaseArgs & { channelId: string }) {
  return runAction(async () => {
    const result = await service.unlinkChannel({
      workspaceId: args.workspaceId,
      channelId: args.channelId,
    });
    revalidatePath(`/workspace/${args.slug}`);
    return result;
  });
}
