import "server-only";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError, ValidationError } from "@/server/lib/errors";
import {
  linkChannelSchema,
  updateChannelSchema,
  saveBotSchema,
  updateBotSchema,
} from "./telegram.schema";
import { assertCanManageTelegram } from "./telegram.policy";
import * as repo from "./telegram.repo";
import * as events from "./telegram.events";
import * as tg from "./telegram.client";

const WEBHOOK_PATH = "/api/telegram/webhook";

function webhookUrl(): string | null {
  const base = process.env.PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  return base ? `${base}${WEBHOOK_PATH}` : null;
}

async function registerBotWebhook(token: string): Promise<void> {
  const url = webhookUrl();
  if (!url) return;
  const res = await tg.setWebhook(token, url, process.env.TELEGRAM_WEBHOOK_SECRET);
  if (!res.ok) {
    console.warn("telegram.setWebhook failed:", res.description);
  }
}

/** Public, token-free view of a workspace bot for the UI. */
export interface BotConfigView {
  connected: boolean;
  isActive: boolean;
  botUsername: string | null;
  defaultChatId: string | null;
}

export async function getBotConfig(workspaceId: string): Promise<BotConfigView> {
  await requireActor(workspaceId);
  const bot = await repo.findBotByWorkspace(workspaceId);
  if (!bot) {
    return { connected: false, isActive: false, botUsername: null, defaultChatId: null };
  }
  return {
    connected: true,
    isActive: bot.isActive,
    botUsername: bot.botUsername,
    defaultChatId: bot.defaultChatId,
  };
}

export async function saveBot(p: { workspaceId: string; input: unknown }): Promise<BotConfigView> {
  const data = saveBotSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId);
  assertCanManageTelegram(ctx);

  // Validate the token against Telegram before persisting.
  const identity = await tg.getMe(data.botToken);
  if (!identity) {
    throw new ValidationError("Telegram rejected this token. Double-check it with @BotFather.");
  }

  const bot = await db.transaction(async (tx) => {
    const saved = await repo.upsertBot(
      {
        workspaceId: p.workspaceId,
        botToken: data.botToken,
        botUsername: identity.username ?? null,
        defaultChatId: data.defaultChatId || null,
        isActive: true,
      },
      tx
    );
    await events.botConnected(tx, ctx, saved);
    return saved;
  });

  await registerBotWebhook(data.botToken);

  return {
    connected: true,
    isActive: bot.isActive,
    botUsername: bot.botUsername,
    defaultChatId: bot.defaultChatId,
  };
}

export async function updateBot(p: {
  workspaceId: string;
  input: unknown;
}): Promise<BotConfigView> {
  const data = updateBotSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId);
  assertCanManageTelegram(ctx);

  const existing = await repo.findBotByWorkspace(p.workspaceId);
  if (!existing) throw new NotFoundError("Telegram bot");

  const updated = await repo.patchBot(p.workspaceId, {
    isActive: data.isActive ?? existing.isActive,
    defaultChatId:
      data.defaultChatId === undefined ? existing.defaultChatId : data.defaultChatId || null,
  });
  if (!updated) throw new NotFoundError("Telegram bot");

  return {
    connected: true,
    isActive: updated.isActive,
    botUsername: updated.botUsername,
    defaultChatId: updated.defaultChatId,
  };
}

export async function removeBot(p: { workspaceId: string }): Promise<{ ok: true }> {
  const ctx = await requireActor(p.workspaceId);
  assertCanManageTelegram(ctx);

  const existing = await repo.findBotByWorkspace(p.workspaceId);
  if (!existing) return { ok: true };

  await db.transaction(async (tx) => {
    await events.botDisconnected(tx, ctx, existing.id);
    await repo.removeBot(p.workspaceId, tx);
  });
  await tg.deleteWebhook(existing.botToken);
  return { ok: true };
}

/**
 * Auto-detect the chat id from recent updates (after the user sends /start to
 * the bot or adds it to a group). Persists it so notifications have a target.
 */
export async function detectChat(p: {
  workspaceId: string;
}): Promise<{ chatId: string; title: string } | null> {
  const ctx = await requireActor(p.workspaceId);
  assertCanManageTelegram(ctx);

  const bot = await repo.findBotByWorkspace(p.workspaceId);
  if (!bot) throw new NotFoundError("Telegram bot");

  const detected = await tg.detectChat(bot.botToken);
  if (!detected) return null;

  await repo.patchBot(p.workspaceId, { defaultChatId: detected.chatId });
  return { chatId: detected.chatId, title: detected.title };
}

/** Send a test message to the configured chat. */
export async function sendTest(p: { workspaceId: string }): Promise<{ ok: true }> {
  const ctx = await requireActor(p.workspaceId);
  assertCanManageTelegram(ctx);

  const bot = await repo.findBotByWorkspace(p.workspaceId);
  if (!bot) throw new NotFoundError("Telegram bot");
  if (!bot.defaultChatId) {
    throw new ValidationError("Set a chat ID first (send /start to your bot, then Detect).");
  }

  const res = await tg.sendMessage(
    bot.botToken,
    bot.defaultChatId,
    "✅ *VieroClick* is connected. Notifications from this workspace will appear here."
  );
  if (!res.ok) {
    throw new ValidationError(
      res.description
        ? `Telegram could not deliver the message: ${res.description}`
        : "Telegram could not deliver the message. Check the chat ID."
    );
  }
  return { ok: true };
}

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
