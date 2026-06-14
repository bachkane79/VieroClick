import { notifications, type Executor } from "@vieroc/db";

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
}
