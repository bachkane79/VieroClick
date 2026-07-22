import "server-only";
import * as repo from "./telegram.repo";
import { sendMessage } from "./telegram.client";

/**
 * Forward a notification to the workspace's Telegram bot, if one is connected
 * and active and has a target chat. System-triggered (no actor context) and
 * fully best-effort — callers fire this without awaiting and never let a
 * Telegram failure affect the originating mutation.
 */
export async function notifyWorkspaceBot(
  workspaceId: string,
  title: string,
  body?: string | null
): Promise<void> {
  const bot = await repo.findBotByWorkspace(workspaceId);
  if (!bot || !bot.isActive || !bot.defaultChatId) return;

  const text = body ? `*${escapeMd(title)}*\n${escapeMd(body)}` : `*${escapeMd(title)}*`;
  await sendMessage(bot.botToken, bot.defaultChatId, text);
}

// Escape the subset of Markdown that breaks Telegram's legacy parser.
function escapeMd(s: string): string {
  return s.replace(/([_*`[])/g, "\\$1");
}
