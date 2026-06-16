import "server-only";

import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError, ValidationError } from "@/server/lib/errors";
import {
  putLocalFileObject,
  readLocalFileObject,
  removeLocalFileObject,
} from "@/server/lib/local-file-storage";
import * as taskRepo from "../task/task.repo";
import { registerFileSchema, attachToTaskSchema } from "./file.schema";
import { assertCanContribute } from "./file.policy";
import * as events from "./file.events";
import * as repo from "./file.repo";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

async function getTaskInProject(taskId: string, projectId: string) {
  const task = await taskRepo.findById(taskId);
  if (!task || task.projectId !== projectId) throw new NotFoundError("Task");
  return task;
}

function assertUploadableFile(file: File) {
  if (!file.name || file.size === 0) throw new ValidationError("Choose a file to upload");
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError("File must be 25 MB or smaller");
  }
}

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

/** Upload a file object and attach it to a task in one project-scoped flow. */
export async function uploadAndAttachToTask(p: {
  workspaceId: string;
  projectId: string;
  taskId: string;
  file: File;
}) {
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanContribute(ctx);
  assertUploadableFile(p.file);
  const task = await getTaskInProject(p.taskId, p.projectId);
  const stored = await putLocalFileObject(ctx.workspaceId, p.file);

  try {
    return await db.transaction(async (tx) => {
      const file = await repo.createFile(
        {
          workspaceId: ctx.workspaceId,
          uploadedBy: ctx.userId,
          fileName: stored.fileName,
          mimeType: stored.mimeType,
          storageKey: stored.storageKey,
          sizeBytes: stored.sizeBytes,
        },
        tx
      );

      const attachment = await repo.attach(
        {
          taskId: task.id,
          fileId: file.id,
        },
        tx
      );

      await events.fileUploaded(tx, ctx, file.id, file.fileName);
      await events.attachmentAdded(tx, ctx, task.id, file.id);

      return { file, attachment };
    });
  } catch (err) {
    await removeLocalFileObject(stored.storageKey);
    throw err;
  }
}

/** Attach an already-registered file to a task within a project. */
export async function attachToTask(p: { workspaceId: string; projectId: string; input: unknown }) {
  const data = attachToTaskSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanContribute(ctx);

  const task = await getTaskInProject(data.taskId, p.projectId);

  const file = await repo.findFile(data.fileId);
  if (!file || file.workspaceId !== p.workspaceId) throw new NotFoundError("File");

  return db.transaction(async (tx) => {
    const attachment = await repo.attach(
      {
        taskId: task.id,
        fileId: file.id,
      },
      tx
    );

    await events.attachmentAdded(tx, ctx, task.id, file.id);

    return attachment;
  });
}

/** Read: all files attached to a task. Requires project membership. */
export async function listAttachments(workspaceId: string, projectId: string, taskId: string) {
  await requireActor(workspaceId, projectId);
  await getTaskInProject(taskId, projectId);
  return repo.listTaskAttachments(taskId);
}

export async function listProjectAttachments(workspaceId: string, projectId: string) {
  await requireActor(workspaceId, projectId);
  return repo.listProjectAttachments(projectId);
}

export async function readAttachedFile(fileId: string, projectId: string) {
  const file = await repo.findFile(fileId);
  if (!file) throw new NotFoundError("File");

  await requireActor(file.workspaceId, projectId);
  const attachment = await repo.findAttachmentByFileInProject(fileId, projectId);
  if (!attachment) throw new NotFoundError("Attachment");

  const bytes = await readLocalFileObject(file.storageKey);
  return { file, bytes };
}
