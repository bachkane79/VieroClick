import { notifications, type Executor } from "@vieroc/db";
import { notifyWorkspaceBot } from "@/modules/telegram/telegram.notify";

export interface NotificationInput {
  workspaceId: string;
  recipientMemberId: string;
  projectId?: string | null;
  type: string;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Insert notifications. Pass the open transaction as `exec` so delivery is
 * committed atomically with the mutation that triggered it (§4.3). A later
 * worker/UI marks them read; this layer only enqueues.
 *
 * As a side effect, every distinct notification is also forwarded to the
 * workspace's Telegram bot (if connected) — fire-and-forget, so a down or
 * misconfigured bot never affects the originating mutation. The forward reads
 * already-committed bot config via the root client and only uses the in-memory
 * title/body, so it's safe to dispatch before this transaction commits.
 */
export async function enqueueNotifications(
  exec: Executor,
  items: NotificationInput[]
): Promise<void> {
  if (items.length === 0) return;
  await exec.insert(notifications).values(
    items.map((n) => ({
      workspaceId: n.workspaceId,
      recipientMemberId: n.recipientMemberId,
      projectId: n.projectId ?? null,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      entityType: n.entityType ?? null,
      entityId: n.entityId ?? null,
      metadata: n.metadata ?? {},
    }))
  );

  // Forward to Telegram once per distinct (workspace, title, body) so multiple
  // recipients of the same event don't produce duplicate messages.
  const seen = new Set<string>();
  for (const n of items) {
    const key = `${n.workspaceId}|${n.title}|${n.body ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    void notifyWorkspaceBot(n.workspaceId, n.title, n.body).catch(() => {
      // best-effort: never surface Telegram delivery failures to the caller
    });
  }
}
