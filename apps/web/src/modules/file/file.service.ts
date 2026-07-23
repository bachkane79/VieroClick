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

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

/** WP-D6: MIME whitelist — enforced on BOTH write paths (uploadAndAttachToTask
 *  and registerFile). Before this, registerFile trusted client-supplied
 *  mimeType/sizeBytes with zero validation — the actual security gap. */
export const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/json",
]);

async function getTaskInProject(taskId: string, projectId: string) {
  const task = await taskRepo.findById(taskId);
  if (!task || task.projectId !== projectId) throw new NotFoundError("Task");
  return task;
}

/** WP-D6: single validation gate for file metadata, used by every write path
 *  (upload with real bytes, or register-by-reference) so neither can bypass
 *  the size/MIME rules the other one enforces. */
export function assertUploadableMeta(meta: { sizeBytes: number | null | undefined; mimeType: string | null | undefined }) {
  if (!meta.sizeBytes || meta.sizeBytes <= 0) throw new ValidationError("Choose a file to upload");
  if (meta.sizeBytes > MAX_FILE_SIZE_BYTES) throw new ValidationError("File must be 25 MB or smaller");
  if (!meta.mimeType || !ALLOWED_MIME_TYPES.has(meta.mimeType)) {
    throw new ValidationError(`File type "${meta.mimeType ?? "unknown"}" is not allowed`);
  }
}

function assertUploadableFile(file: File) {
  if (!file.name) throw new ValidationError("Choose a file to upload");
  assertUploadableMeta({ sizeBytes: file.size, mimeType: file.type });
}

/** WP-D6: per-workspace storage cap. Overridable via env for testing (see
 *  test-wp-d6-file-hardening.ts, which sets a low quota to exercise the guard
 *  without uploading gigabytes of test data). */
export function getWorkspaceQuotaBytes(): number {
  const mb = Number(process.env.WORKSPACE_STORAGE_QUOTA_MB);
  return Number.isFinite(mb) && mb > 0 ? mb * 1024 * 1024 : 5 * 1024 * 1024 * 1024; // default 5GB
}

export async function assertWithinWorkspaceQuota(workspaceId: string, incomingBytes: number) {
  const quota = getWorkspaceQuotaBytes();
  const used = await repo.sumSizeByWorkspace(workspaceId);
  if (used + incomingBytes > quota) {
    throw new ValidationError("Workspace storage quota exceeded");
  }
}

/** Register an uploaded file at the workspace level. */
export async function registerFile(p: { workspaceId: string; input: unknown }) {
  const data = registerFileSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId);
  assertCanContribute(ctx);
  assertUploadableMeta({ sizeBytes: data.sizeBytes, mimeType: data.mimeType });
  await assertWithinWorkspaceQuota(ctx.workspaceId, data.sizeBytes ?? 0);

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
  await assertWithinWorkspaceQuota(ctx.workspaceId, p.file.size);
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
