import "server-only";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import * as taskRepo from "../task/task.repo";
import { registerFileSchema, attachToTaskSchema } from "./file.schema";
import { assertCanContribute } from "./file.policy";
import * as repo from "./file.repo";
import * as events from "./file.events";

/** Register an uploaded file at the workspace level. */
export async function registerFile(p: { workspaceId: string; input: unknown }) {
  const data = registerFileSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId);
  assertCanContribute(ctx);

  return db.transaction(async (tx) => {
    const file = await repo.createFile(
      {
        workspaceId: ctx.workspaceId,
        uploadedBy: ctx.userId,
        fileName: data.fileName,
        mimeType: data.mimeType ?? null,
        storageKey: data.storageKey,
        sizeBytes: data.sizeBytes ?? null,
      },
      tx
    );

    await events.fileUploaded(tx, ctx, file.id, file.fileName);

    return file;
  });
}

/** Attach an already-registered file to a task within a project. */
export async function attachToTask(p: {
  workspaceId: string;
  projectId: string;
  input: unknown;
}) {
  const data = attachToTaskSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanContribute(ctx);

  const task = await taskRepo.findById(data.taskId);
  if (!task) throw new NotFoundError("Task");

  const file = await repo.findFile(data.fileId);
  if (!file) throw new NotFoundError("File");

  return db.transaction(async (tx) => {
    const attachment = await repo.attach(
      {
        taskId: data.taskId,
        fileId: data.fileId,
      },
      tx
    );

    await events.attachmentAdded(tx, ctx, data.taskId, data.fileId);

    return attachment;
  });
}

/** Read: all files attached to a task. Requires workspace membership. */
export async function listAttachments(workspaceId: string, projectId: string, taskId: string) {
  await requireActor(workspaceId, projectId);
  return repo.listTaskAttachments(taskId);
}
