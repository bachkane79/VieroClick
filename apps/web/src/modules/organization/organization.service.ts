import "server-only";
import { cache } from "react";
import { z } from "zod";
import { db } from "@vieroc/db";
import { getUserId, requireActor } from "@/server/lib/context";
import { NotFoundError, ValidationError } from "@/server/lib/errors";
import { invalidateCache, invalidateCachePattern } from "@/server/lib/cache";
import * as repo from "./organization.repo";

const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "org"
  );
}

export const listMyOrganizations = cache(async function listMyOrganizations() {
  const userId = await getUserId();
  if (!userId) return [];
  return repo.listForUser(userId);
});

export async function createOrganization(input: unknown) {
  const data = createOrgSchema.parse(input);
  const userId = await getUserId();
  if (!userId) throw new ValidationError("Not authenticated");

  // Derive a unique slug (base, then base-<n> on collision).
  let slug = data.slug ?? slugify(data.name);
  if (await repo.findBySlug(slug)) {
    for (let i = 2; i < 50; i++) {
      const candidate = `${slug}-${i}`;
      if (!(await repo.findBySlug(candidate))) {
        slug = candidate;
        break;
      }
    }
  }

  return db.transaction(async (tx) => {
    const org = await repo.create({ name: data.name, slug, ownerId: userId }, tx);
    await repo.addMember({ organizationId: org.id, userId, role: "owner" }, tx);
    return org;
  });
}

export const getOrganization = cache(async function getOrganization(slug: string) {
  const userId = await getUserId();
  if (!userId) throw new NotFoundError("Organization");
  const org = await repo.findBySlug(slug);
  if (!org || !(await repo.isMember(org.id, userId))) throw new NotFoundError("Organization");
  return org;
});

export async function listOrganizationMembers(slug: string) {
  const org = await getOrganization(slug);
  return repo.listMembers(org.id);
}

export async function listOrganizationWorkspaces(slug: string) {
  const org = await getOrganization(slug);
  return repo.listWorkspaces(org.id);
}

/**
 * Attach a workspace (team) to an organization and seed the org directory with
 * that team's members. Requires the caller to manage the workspace AND be an
 * org member. Access stays workspace-scoped — this only groups + shares people.
 */
export async function attachWorkspaceToOrg(p: { workspaceId: string; organizationId: string }) {
  const ctx = await requireActor(p.workspaceId);
  if (!["owner", "admin"].includes(ctx.workspaceRole)) {
    throw new ValidationError("Only a workspace owner/admin can move it into an organization");
  }

  const userId = await getUserId();
  if (!userId || !(await repo.isMember(p.organizationId, userId))) {
    throw new ValidationError("You must belong to the target organization");
  }

  const result = await db.transaction(async (tx) => {
    await repo.attachWorkspace(p.workspaceId, p.organizationId, tx);
    // Share directory: add the team's members into the org.
    const userIds = await repo.listWorkspaceUserIds(p.workspaceId, tx);
    for (const uid of userIds) {
      await repo.addMember({ organizationId: p.organizationId, userId: uid, role: "member" }, tx);
    }
    return { ok: true };
  });

  // The sidebar reads workspace→org grouping from these persistent caches.
  invalidateCache(`my_workspaces:${userId}`);
  invalidateCachePattern(`workspace_by_slug:${userId}:`);
  return result;
}
