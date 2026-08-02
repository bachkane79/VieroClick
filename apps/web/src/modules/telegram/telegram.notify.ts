import "server-only";
import * as repo from "./telegram.repo";
import { sendMessage } from "./telegram.client";

/**
 * Forward a notification to the workspace's Telegram bot, if one is connected
 * and active and has a target chat. System-triggered (no actor context) and
 * fully best-effort — callers fire this without awaiting and never let a
 * Telegram failure affect the originating mutation.
 *
 * Routing: a project whose notifications should land in their own group gets an
 * active `telegram_channels` row (linked from workspace settings); everything
 * else falls back to the bot's default chat. Before this, linked channels were
 * stored but never read, so per-project routing silently did nothing.
 */
export async function notifyWorkspaceBot(
  workspaceId: string,
  title: string,
  body?: string | null,
  projectId?: string | null
): Promise<void> {
  const bot = await repo.findBotByWorkspace(workspaceId);
  if (!bot || !bot.isActive) return;

  const channel = projectId
    ? await repo.findActiveChannelForProject(workspaceId, projectId)
    : null;
  const chatId = channel?.telegramChatId ?? bot.defaultChatId;
  if (!chatId) return;

  const text = body ? `*${escapeMd(title)}*\n${escapeMd(body)}` : `*${escapeMd(title)}*`;
  await sendMessage(bot.botToken, chatId, text);
}

// Escape the subset of Markdown that breaks Telegram's legacy parser.
function escapeMd(s: string): string {
  return s.replace(/([_*`[])/g, "\\$1");
}
