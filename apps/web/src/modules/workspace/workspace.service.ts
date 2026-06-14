import "server-only";
import { db } from "@vieroc/db";
import { getUserId, requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import { createWorkspaceSchema, updateWorkspaceSchema } from "./workspace.schema";
import { assertCanManageWorkspace } from "./workspace.policy";
import * as repo from "./workspace.repo";
import * as events from "./workspace.events";

export async function listMyWorkspaces() {
  const userId = await getUserId();
  return repo.listForUser(userId);
}

/** Resolve a workspace by slug, ensuring the current user is a member. */
export async function getWorkspace(slug: string) {
  await getUserId();
  const ws = await repo.findBySlug(slug);
  if (!ws) throw new NotFoundError("Workspace");
  await requireActor(ws.id); // membership check
  return ws;
}

export async function createWorkspace(input: unknown) {
  const data = createWorkspaceSchema.parse(input);
  const userId = await getUserId();

  return db.transaction(async (tx) => {
    const ws = await repo.create({ name: data.name, slug: data.slug, ownerId: userId }, tx);
    const member = await repo.addMember(
      { workspaceId: ws.id, userId, role: "owner" },
      tx
    );
    await events.workspaceCreated(
      tx,
      { workspaceId: ws.id, actorUserId: userId, actorMemberId: member.id },
      ws.name
    );
    return ws;
  });
}

export async function updateWorkspace(workspaceId: string, input: unknown) {
  const data = updateWorkspaceSchema.parse(input);
  const ctx = await requireActor(workspaceId);
  assertCanManageWorkspace(ctx);

  return db.transaction(async (tx) => {
    const updated = await repo.update(workspaceId, data, tx);
    if (!updated) throw new NotFoundError("Workspace");
    await events.workspaceUpdated(tx, ctx, { ...data });
    return updated;
  });
}
