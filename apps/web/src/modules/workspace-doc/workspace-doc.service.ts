import "server-only";
import { z } from "zod";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import { getOrSetCache, invalidateCache } from "@/server/lib/cache";
import { canContribute, requirePermission } from "@/server/lib/permissions";
import * as repo from "./workspace-doc.repo";

// WP-C2: workspace docs previously had NO privilege gate — any member incl.
// read-only viewers could create/edit/delete. Gate authoring to contributors
// (mirrors the rest of the app's canContribute model) and restrict delete to the
// author or a workspace manager (mirrors workspace-post).
const MANAGER_ROLES = new Set(["owner", "admin", "leader"]);

const createDocSchema = z.object({
  title: z.string().min(1).max(200).default("Untitled"),
  parentId: z.string().uuid().nullable().optional(),
  content: z.string().default(""),
});

const updateDocSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  parentId: z.string().uuid().nullable().optional(),
});

const CACHE = (workspaceId: string) => `wsdocs:${workspaceId}`;

export async function listWorkspaceDocs(workspaceId: string) {
  await requireActor(workspaceId);
  return getOrSetCache(CACHE(workspaceId), () => repo.listByWorkspace(workspaceId));
}

export async function createWorkspaceDoc(p: { workspaceId: string; input: unknown }) {
  const data = createDocSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId);
  requirePermission(canContribute(ctx), "You do not have permission to create documents");

  return db.transaction(async (tx) => {
    const doc = await repo.create(
      {
        workspaceId: p.workspaceId,
        parentId: data.parentId ?? null,
        title: data.title,
        content: data.content,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
      tx
    );
    await invalidateCache(CACHE(p.workspaceId));
    return doc;
  });
}

export async function updateWorkspaceDoc(p: {
  workspaceId: string;
  docId: string;
  input: unknown;
}) {
  const data = updateDocSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId);
  requirePermission(canContribute(ctx), "You do not have permission to edit documents");

  const existing = await repo.findById(p.docId);
  if (!existing || existing.workspaceId !== p.workspaceId) throw new NotFoundError("Document");

  const patch: Partial<repo.WorkspaceDocInsert> = { updatedBy: ctx.userId };
  if (data.title !== undefined) patch.title = data.title;
  if (data.content !== undefined) patch.content = data.content;
  if (data.parentId !== undefined) patch.parentId = data.parentId ?? null;

  return db.transaction(async (tx) => {
    const updated = await repo.update(p.docId, patch, tx);
    if (!updated) throw new NotFoundError("Document");
    await invalidateCache(CACHE(p.workspaceId));
    return updated;
  });
}

export async function deleteWorkspaceDoc(p: { workspaceId: string; docId: string }) {
  const ctx = await requireActor(p.workspaceId);
  const existing = await repo.findById(p.docId);
  if (!existing || existing.workspaceId !== p.workspaceId) throw new NotFoundError("Document");
  // Author or a workspace manager can delete.
  if (existing.createdBy !== ctx.userId && !MANAGER_ROLES.has(ctx.workspaceRole)) {
    throw new NotFoundError("Document");
  }

  return db.transaction(async (tx) => {
    await repo.remove(p.docId, tx);
    await invalidateCache(CACHE(p.workspaceId));
    return { id: p.docId };
  });
}
