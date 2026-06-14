import { activityEvents, type Executor } from "@vieroc/db";
import type { ActorContext } from "./context";

export type ActorType = "human" | "agent" | "system";

export interface RecordEventInput {
  workspaceId: string;
  projectId?: string | null;
  actorUserId?: string | null;
  actorMemberId?: string | null;
  actorType?: ActorType;
  entityType: string;
  entityId: string;
  eventType: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}

/**
 * Append a row to `activity_events`. Pass the open transaction as `exec` so the
 * event is written atomically with the mutation it describes (see §4.3).
 */
export async function recordEvent(exec: Executor, e: RecordEventInput): Promise<void> {
  await exec.insert(activityEvents).values({
    workspaceId: e.workspaceId,
    projectId: e.projectId ?? null,
    actorUserId: e.actorUserId ?? null,
    actorMemberId: e.actorMemberId ?? null,
    actorType: e.actorType ?? "human",
    entityType: e.entityType,
    entityId: e.entityId,
    eventType: e.eventType,
    beforeData: e.before ?? null,
    afterData: e.after ?? null,
    metadata: e.metadata ?? {},
  });
}

/** Actor + workspace fields derived from a context, spread into event helpers. */
export function actorFields(ctx: ActorContext) {
  return {
    workspaceId: ctx.workspaceId,
    projectId: ctx.projectId,
    actorUserId: ctx.userId,
    actorMemberId: ctx.workspaceMemberId,
    actorType: "human" as const,
  };
}
