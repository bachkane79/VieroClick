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

/**
 * Ask agent-api to (de)register a Telegram webhook for a single bot.
 * agent-api is the only place that owns the webhook URL — web never calls
 * Telegram's setWebhook directly. This avoids the dual-source problem where
 * web and agent-api would race to overwrite each other's webhook URL.
 */
async function callAgentApi(path: string, body: { botId: string; botToken: string }) {
  const base = process.env.AGENT_API_URL?.trim().replace(/\/$/, "");
  const secret = process.env.AGENT_API_SECRET ?? "";
  if (!base) {
    throw new ValidationError("AGENT_API_URL is not configured.");
  }
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Secret": secret,
      },
      body: JSON.stringify({ bot_id: body.botId, bot_token: body.botToken }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw new ValidationError(
      `Could not reach agent-api: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  if (!res.ok) {
    const detail = await res
      .json()
      .then((b) => (b as { detail?: string }).detail)
      .catch(() => undefined);
    throw new ValidationError(detail ?? `agent-api returned ${res.status}`);
  }
}

async function registerBotWebhook(botId: string, botToken: string): Promise<void> {
  await callAgentApi("/api/telegram/admin/register-webhook", { botId, botToken });
}

async function deleteBotWebhook(botId: string, botToken: string): Promise<void> {
  try {
    await callAgentApi("/api/telegram/admin/delete-webhook", { botId, botToken });
  } catch (err) {
    // Best-effort: removal in our DB proceeds even if Telegram rejects.
    console.warn("telegram.deleteWebhook failed:", err);
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

  await registerBotWebhook(bot.id, data.botToken);

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
  await deleteBotWebhook(existing.id, existing.botToken);
  return { ok: true };
}

/**
 * Returns the chat id agent-api has auto-saved from the first incoming
 * Telegram update for this bot. With the webhook active, Telegram doesn't
 * let us call getUpdates anymore — agent-api is the one that sees messages,
 * so we just read the value it wrote.
 */
export async function detectChat(p: {
  workspaceId: string;
}): Promise<{ chatId: string; title: string } | null> {
  const ctx = await requireActor(p.workspaceId);
  assertCanManageTelegram(ctx);

  const bot = await repo.findBotByWorkspace(p.workspaceId);
  if (!bot) throw new NotFoundError("Telegram bot");
  if (!bot.defaultChatId) return null;

  return { chatId: bot.defaultChatId, title: `Chat ${bot.defaultChatId}` };
}

/** Send a test message to the configured chat. */
export async function sendTest(p: { workspaceId: string }): Promise<{ ok: true }> {
  const ctx = await requireActor(p.workspaceId);
  assertCanManageTelegram(ctx);

  const bot = await repo.findBotByWorkspace(p.workspaceId);
  if (!bot) throw new NotFoundError("Telegram bot");
  if (!bot.defaultChatId) {
    throw new ValidationError("No chat linked yet. Send /start to your bot first.");
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
