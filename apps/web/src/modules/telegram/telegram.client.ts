import "server-only";

/**
 * Thin wrapper over the Telegram Bot HTTP API. The bot token is supplied by
 * the workspace (created via @BotFather), never a global secret. All calls are
 * best-effort from the caller's perspective — failures are surfaced as a
 * typed result so the service can decide whether to throw or swallow.
 */

const API_BASE = "https://api.telegram.org";

interface TelegramResult<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

async function call<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>
): Promise<TelegramResult<T>> {
  const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    // Telegram should respond quickly; bound it so a stuck request never hangs
    signal: AbortSignal.timeout(10_000),
  });
  return (await res.json()) as TelegramResult<T>;
}

export interface BotIdentity {
  id: number;
  username?: string;
  first_name: string;
}

/** Validate a token and return the bot's identity (username, etc.). */
export async function getMe(token: string): Promise<BotIdentity | null> {
  try {
    const res = await call<BotIdentity>(token, "getMe");
    return res.ok ? (res.result ?? null) : null;
  } catch {
    return null;
  }
}

/** Send a Markdown message to a chat. Returns true on success. */
export async function sendMessage(
  token: string,
  chatId: string,
  text: string
): Promise<{ ok: boolean; description?: string }> {
  try {
    const res = await call<unknown>(token, "sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    });
    return { ok: res.ok, description: res.description };
  } catch (err) {
    return { ok: false, description: err instanceof Error ? err.message : "Network error" };
  }
}

interface TgChat {
  id: number;
  type?: string;
  title?: string;
  username?: string;
}

interface Update {
  message?: { chat?: TgChat };
  channel_post?: { chat?: TgChat };
  my_chat_member?: { chat?: TgChat };
}

export interface DetectedChat {
  chatId: string;
  title: string;
  type: string;
}

/**
 * Read recent updates and surface the most recent chat that messaged the bot,
 * so the user can auto-fill the chat id after sending /start (or adding the
 * bot to a group).
 */
export async function detectChat(token: string): Promise<DetectedChat | null> {
  try {
    const res = await call<Update[]>(token, "getUpdates", { limit: 20, timeout: 0 });
    if (!res.ok || !res.result?.length) return null;
    for (let i = res.result.length - 1; i >= 0; i--) {
      const u = res.result[i]!;
      const chat = u.message?.chat ?? u.channel_post?.chat ?? u.my_chat_member?.chat;
      if (chat?.id != null) {
        return {
          chatId: String(chat.id),
          title: chat.title ?? chat.username ?? `Chat ${chat.id}`,
          type: chat.type ?? "private",
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}
