import "server-only";

/**
 * Thin wrapper over the Telegram Bot HTTP API. The bot token is supplied by
 * the workspace (created via @BotFather), never a global secret. All calls are
 * best-effort from the caller's perspective — failures are surfaced as a
 * typed result so the service can decide whether to throw or swallow.
 *
 * Webhook lifecycle (setWebhook / deleteWebhook) is NOT here — it lives in
 * agent-api so there's a single source of truth for the webhook URL.
 * getUpdates is also gone: while a webhook is active Telegram rejects
 * getUpdates with 409, and agent-api now auto-saves the chat id on the
 * first inbound message.
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
