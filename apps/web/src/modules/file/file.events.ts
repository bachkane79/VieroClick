import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";

export function fileUploaded(
  exec: Executor,
  ctx: ActorContext,
  fileId: string,
  fileName: string
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "file",
    entityId: fileId,
    eventType: "file.uploaded",
    after: { fileName },
  });
}

export function attachmentAdded(
  exec: Executor,
  ctx: ActorContext,
  taskId: string,
  fileId: string
) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "task",
    entityId: taskId,
    eventType: "task.attachment_added",
    metadata: { fileId },
  });
}
