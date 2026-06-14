import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";

interface ChannelLike {
  id: string;
  telegramChatId: string;
  title: string | null;
  projectId: string | null;
  isActive: boolean;
}

export function channelLinked(exec: Executor, ctx: ActorContext, channel: ChannelLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "telegram_channel",
    entityId: channel.id,
    eventType: "telegram.channel_linked",
    after: { telegramChatId: channel.telegramChatId, title: channel.title },
  });
}

export function channelUpdated(
  exec: Executor,
  ctx: ActorContext,
  before: ChannelLike,
  after: ChannelLike
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "telegram_channel",
    entityId: after.id,
    eventType: "telegram.channel_updated",
    before: { title: before.title, projectId: before.projectId, isActive: before.isActive },
    after: { title: after.title, projectId: after.projectId, isActive: after.isActive },
  });
}

export function channelUnlinked(exec: Executor, ctx: ActorContext, channel: ChannelLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "telegram_channel",
    entityId: channel.id,
    eventType: "telegram.channel_unlinked",
    before: { telegramChatId: channel.telegramChatId, title: channel.title },
  });
}
