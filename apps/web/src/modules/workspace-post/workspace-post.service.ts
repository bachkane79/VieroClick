import "server-only";
import { z } from "zod";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import { getOrSetCache, invalidateCache } from "@/server/lib/cache";
import * as repo from "./workspace-post.repo";

const createPostSchema = z.object({
  body: z.string().min(1).max(4000),
  pinned: z.boolean().default(false),
});

const CACHE = (workspaceId: string) => `wsposts:${workspaceId}`;

export async function listWorkspacePosts(workspaceId: string) {
  await requireActor(workspaceId);
  return getOrSetCache(CACHE(workspaceId), () => repo.listByWorkspace(workspaceId));
}

const MANAGER_ROLES = new Set(["owner", "admin", "leader"]);

export async function createWorkspacePost(p: { workspaceId: string; input: unknown }) {
  const data = createPostSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId);

  return db.transaction(async (tx) => {
    const post = await repo.create(
      {
        workspaceId: p.workspaceId,
        authorMemberId: ctx.workspaceMemberId,
        body: data.body.trim(),
        // Only managers may pin; others always post unpinned.
        pinned: data.pinned && MANAGER_ROLES.has(ctx.workspaceRole),
      },
      tx
    );
    await invalidateCache(CACHE(p.workspaceId));
    return post;
  });
}

export async function setWorkspacePostPinned(p: {
  workspaceId: string;
  postId: string;
  pinned: boolean;
}) {
  const ctx = await requireActor(p.workspaceId);
  const existing = await repo.findById(p.postId);
  if (!existing || existing.workspaceId !== p.workspaceId) throw new NotFoundError("Post");
  if (!MANAGER_ROLES.has(ctx.workspaceRole)) throw new NotFoundError("Post");

  return db.transaction(async (tx) => {
    await repo.setPinned(p.postId, p.pinned, tx);
    await invalidateCache(CACHE(p.workspaceId));
    return { id: p.postId, pinned: p.pinned };
  });
}

export async function deleteWorkspacePost(p: { workspaceId: string; postId: string }) {
  const ctx = await requireActor(p.workspaceId);
  const existing = await repo.findById(p.postId);
  if (!existing || existing.workspaceId !== p.workspaceId) throw new NotFoundError("Post");
  // Author or a manager can delete.
  if (existing.authorMemberId !== ctx.workspaceMemberId && !MANAGER_ROLES.has(ctx.workspaceRole)) {
    throw new NotFoundError("Post");
  }

  return db.transaction(async (tx) => {
    await repo.remove(p.postId, tx);
    await invalidateCache(CACHE(p.workspaceId));
    return { id: p.postId };
  });
}
