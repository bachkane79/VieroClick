import "server-only";
import { cache } from "react";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import { getOrSetCache, invalidateCache } from "@/server/lib/cache";
import { isProjectManager, meetsLevel } from "@/server/lib/permissions";
import { resolveGrantLevel } from "@/modules/permission/permission.access";
import { createProjectDocSchema } from "./project-doc.schema";
import { assertCanCreateDoc, assertCanManageDoc } from "./project-doc.policy";
import * as repo from "./project-doc.repo";
import * as events from "./project-doc.events";

/** Read: project docs for a project. Requires workspace membership. */
export const listDocs = cache(async function listDocs(workspaceId: string, projectId: string) {
  await requireActor(workspaceId, projectId);
  return getOrSetCache(`docs:${projectId}`, () => repo.listByProject(projectId));
});

export async function createDoc(p: { workspaceId: string; projectId: string; input: unknown }) {
  const data = createProjectDocSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanCreateDoc(ctx);

  return db.transaction(async (tx) => {
    const doc = await repo.create(
      {
        projectId: p.projectId,
        title: data.title,
        type: data.type,
        content: data.content,
        createdBy: ctx.userId,
      },
      tx
    );

    await events.docCreated(tx, ctx, doc);
    await invalidateCache(`docs:${p.projectId}`);

    return doc;
  });
}

export async function deleteDoc(p: { workspaceId: string; projectId: string; docId: string }) {
  const ctx = await requireActor(p.workspaceId, p.projectId);

  const existing = await repo.findById(p.docId);
  if (!existing || existing.projectId !== p.projectId) throw new NotFoundError("Document");

  // §4.2 layer 2: a manager can always manage docs; otherwise an explicit
  // `full` grant on this doc (or inherited from its project) authorizes it.
  // Without this the share dialog on a doc would hand out a level nothing reads.
  if (!isProjectManager(ctx)) {
    const grantLevel = await resolveGrantLevel(ctx, {
      type: "doc",
      id: p.docId,
      createdBy: existing.createdBy,
      projectId: p.projectId,
    });
    if (!meetsLevel(grantLevel, "full")) assertCanManageDoc(ctx);
  }

  return db.transaction(async (tx) => {
    await events.docDeleted(tx, ctx, existing);
    await repo.remove(p.docId, tx);
    await invalidateCache(`docs:${p.projectId}`);
    return { id: p.docId };
  });
}
