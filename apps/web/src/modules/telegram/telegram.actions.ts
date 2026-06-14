"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./telegram.service";

interface BaseArgs {
  workspaceId: string;
  slug: string;
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
