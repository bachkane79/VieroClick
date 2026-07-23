import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";

interface ProjectLike {
  id: string;
  name: string;
  status: string;
}

export function projectCreated(exec: Executor, ctx: ActorContext, project: ProjectLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    projectId: project.id,
    entityType: "project",
    entityId: project.id,
    eventType: "project.created",
    after: { name: project.name, status: project.status },
  });
}

export function projectUpdated(
  exec: Executor,
  ctx: ActorContext,
  project: ProjectLike,
  after: Record<string, unknown>
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    projectId: project.id,
    entityType: "project",
    entityId: project.id,
    eventType: "project.updated",
    after,
  });
}

/** WP-D4: `project` carries the full row (caller passes the loaded entity) so
 *  the audit trail has a complete before-snapshot even though the delete is soft. */
export function projectDeleted(exec: Executor, ctx: ActorContext, project: ProjectLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    projectId: project.id,
    entityType: "project",
    entityId: project.id,
    eventType: "project.deleted",
    before: { ...project },
  });
}

export function projectRestored(exec: Executor, ctx: ActorContext, project: ProjectLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    projectId: project.id,
    entityType: "project",
    entityId: project.id,
    eventType: "project.restored",
    after: { name: project.name },
  });
}
