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
