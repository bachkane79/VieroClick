import "server-only";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError, ValidationError } from "@/server/lib/errors";
import { linkChannelSchema, updateChannelSchema } from "./telegram.schema";
import { assertCanManageTelegram } from "./telegram.policy";
import * as repo from "./telegram.repo";
import * as events from "./telegram.events";

export async function listChannels(workspaceId: string) {
  await requireActor(workspaceId);
  return repo.listChannels(workspaceId);
}

export async function linkChannel(p: { workspaceId: string; input: unknown }) {
  const data = linkChannelSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, data.projectId);
  assertCanManageTelegram(ctx);

  const duplicate = await repo.findByChatId(p.workspaceId, data.telegramChatId);
  if (duplicate) throw new ValidationError("This Telegram chat is already linked");

  return db.transaction(async (tx) => {
    const channel = await repo.createChannel(
      {
        workspaceId: p.workspaceId,
        projectId: data.projectId ?? null,
        telegramChatId: data.telegramChatId,
        title: data.title ?? null,
        type: data.type ?? null,
      },
      tx
    );

    await events.channelLinked(tx, ctx, channel);

    return channel;
  });
}

export async function updateChannel(p: {
  workspaceId: string;
  channelId: string;
  input: unknown;
}) {
  const data = updateChannelSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId);
  assertCanManageTelegram(ctx);

  const existing = await repo.findChannelById(p.channelId);
  if (!existing || existing.workspaceId !== p.workspaceId) throw new NotFoundError("Channel");

  const values: Partial<repo.TelegramChannelInsert> = {};
  if (data.isActive !== undefined) values.isActive = data.isActive;
  if (data.projectId !== undefined) values.projectId = data.projectId;
  if (data.title !== undefined) values.title = data.title;

  return db.transaction(async (tx) => {
    const updated = await repo.updateChannel(p.channelId, values, tx);
    if (!updated) throw new NotFoundError("Channel");

    await events.channelUpdated(tx, ctx, existing, updated);

    return updated;
  });
}

export async function unlinkChannel(p: { workspaceId: string; channelId: string }) {
  const ctx = await requireActor(p.workspaceId);
  assertCanManageTelegram(ctx);

  const existing = await repo.findChannelById(p.channelId);
  if (!existing || existing.workspaceId !== p.workspaceId) throw new NotFoundError("Channel");

  return db.transaction(async (tx) => {
    await events.channelUnlinked(tx, ctx, existing);
    await repo.removeChannel(p.channelId, tx);
    return { id: p.channelId };
  });
}
