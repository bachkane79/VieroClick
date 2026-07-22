import "server-only";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError, ValidationError } from "@/server/lib/errors";
import { createTaskDependencySchema } from "./task-dependency.schema";
import { assertCanManageTasks } from "./task-dependency.policy";
import * as repo from "./task-dependency.repo";
import * as events from "./task-dependency.events";
import { wouldCreateCycle } from "./task-dependency.pure";

/** Read: all dependencies for a project. Requires workspace membership. */
export async function listDependencies(workspaceId: string, projectId: string) {
  await requireActor(workspaceId, projectId);
  return repo.listByProject(projectId);
}

export async function addDependency(p: {
  workspaceId: string;
  projectId: string;
  input: unknown;
}) {
  const data = createTaskDependencySchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageTasks(ctx);

  if (data.blockerTaskId === data.blockedTaskId) {
    throw new ValidationError("A task cannot depend on itself");
  }

  return db.transaction(async (tx) => {
    const existing = await repo.listByProject(p.projectId, tx);
    const cycleCheck = wouldCreateCycle(existing, {
      blockerTaskId: data.blockerTaskId,
      blockedTaskId: data.blockedTaskId,
    });
    if (cycleCheck.cycle) {
      throw new ValidationError(
        `Cannot add dependency: would create a cycle (${cycleCheck.path.join(" → ")} → ${data.blockerTaskId})`
      );
    }

    const dependency = await repo.create(
      {
        projectId: p.projectId,
        blockerTaskId: data.blockerTaskId,
        blockedTaskId: data.blockedTaskId,
        dependencyType: data.dependencyType,
      },
      tx
    );

    await events.dependencyAdded(tx, ctx, dependency.blockedTaskId, dependency.blockerTaskId);

    return dependency;
  });
}

export async function removeDependency(p: {
  workspaceId: string;
  projectId: string;
  dependencyId: string;
}) {
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanManageTasks(ctx);

  const all = await repo.listByProject(p.projectId);
  const existing = all.find((d) => d.id === p.dependencyId);
  if (!existing) throw new NotFoundError("Task dependency");

  return db.transaction(async (tx) => {
    await events.dependencyRemoved(tx, ctx, existing.blockedTaskId, existing.blockerTaskId);
    await repo.remove(p.dependencyId, tx);
    return { id: p.dependencyId };
  });
}
