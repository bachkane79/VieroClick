import "server-only";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import { createTaskStatusSchema, updateTaskStatusSchema } from "./task-status.schema";
import { assertCanManageStatuses } from "./task-status.policy";
import { getOrSetCache, invalidateCache } from "@/server/lib/cache";
import * as repo from "./task-status.repo";
import * as events from "./task-status.events";

/** Read: all statuses for a project. Requires workspace membership. */
export async function listStatuses(workspaceId: string, projectId: string) {
  await requireActor(workspaceId, projectId);
  return getOrSetCache(`statuses:${projectId}`, () => repo.listByProject(projectId));
}

export async function createStatus(p: {
  workspaceId: string;
  projectId: string;
  input: unknown;
}) {
  const data = createTaskStatusSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageStatuses(ctx);

  return db.transaction(async (tx) => {
    const status = await repo.create(
      {
        projectId: p.projectId,
        name: data.name,
        type: data.type,
        position: data.position,
        isDefault: data.isDefault,
      },
      tx
    );

    await events.statusCreated(tx, ctx, status);
    await invalidateCache(`statuses:${p.projectId}`);
    await invalidateCache(`board:${p.projectId}`);

    return status;
  });
}

export async function updateStatus(p: {
  workspaceId: string;
  projectId: string;
  statusId: string;
  input: unknown;
}) {
  const data = updateTaskStatusSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageStatuses(ctx);

  const existing = await repo.findById(p.statusId);
  if (!existing) throw new NotFoundError("Task status");

  const values: Partial<repo.TaskStatusInsert> = {};
  if (data.name !== undefined) values.name = data.name;
  if (data.type !== undefined) values.type = data.type;
  if (data.position !== undefined) values.position = data.position;
  if (data.isDefault !== undefined) values.isDefault = data.isDefault;

  return db.transaction(async (tx) => {
    const updated = await repo.update(p.statusId, values, tx);
    if (!updated) throw new NotFoundError("Task status");

    await events.statusUpdated(tx, ctx, existing, updated);
    await invalidateCache(`statuses:${p.projectId}`);
    await invalidateCache(`board:${p.projectId}`);

    return updated;
  });
}

export async function deleteStatus(p: {
  workspaceId: string;
  projectId: string;
  statusId: string;
}) {
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageStatuses(ctx);

  const existing = await repo.findById(p.statusId);
  if (!existing) throw new NotFoundError("Task status");

  return db.transaction(async (tx) => {
    await events.statusDeleted(tx, ctx, existing);
    await repo.remove(p.statusId, tx);
    await invalidateCache(`statuses:${p.projectId}`);
    await invalidateCache(`board:${p.projectId}`);
    return { id: p.statusId };
  });
}
