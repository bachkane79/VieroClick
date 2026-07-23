import { NextResponse } from "next/server";
import { and, desc, eq, lt } from "drizzle-orm";
import { db, activityEvents } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { isWorkspaceAdmin } from "@/server/lib/permissions";
import { ForbiddenError, ValidationError } from "@/server/lib/errors";
import { buildPage, decodeCursor } from "@/server/lib/cursor";
import { withApiLogging } from "@/server/lib/api-handler";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * WP-G3 — audit lookup over `activity_events`, admin-only. Uses the
 * `(workspaceId, createdAt)` / `(projectId, createdAt)` indexes added in
 * WP-D1. Cursor keys off `createdAt` alone (not a compound createdAt+id
 * tuple) — timestamptz has microsecond precision and this is an internal
 * lookup tool, not a security boundary (see cursor.ts), so the rare same-tick
 * tie is an acceptable simplification here.
 */
export const GET = withApiLogging("api.admin.activity-events.list", async (request) => {
  const url = new URL(request.url);
  const params = url.searchParams;

  const workspaceId = params.get("workspaceId");
  if (!workspaceId) throw new ValidationError("workspaceId is required");

  const ctx = await requireActor(workspaceId);
  if (!isWorkspaceAdmin(ctx)) throw new ForbiddenError("Admin access required");

  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.get("limit")) || DEFAULT_LIMIT));
  const cursor = decodeCursor(params.get("cursor"));

  const conditions = [eq(activityEvents.workspaceId, workspaceId)];
  const projectId = params.get("projectId");
  if (projectId) conditions.push(eq(activityEvents.projectId, projectId));
  const entityType = params.get("entityType");
  if (entityType) conditions.push(eq(activityEvents.entityType, entityType));
  const entityId = params.get("entityId");
  if (entityId) conditions.push(eq(activityEvents.entityId, entityId));
  const actorUserId = params.get("actorUserId");
  if (actorUserId) conditions.push(eq(activityEvents.actorUserId, actorUserId));
  if (cursor?.createdAt) conditions.push(lt(activityEvents.createdAt, new Date(cursor.createdAt)));

  const rows = await db
    .select()
    .from(activityEvents)
    .where(and(...conditions))
    .orderBy(desc(activityEvents.createdAt))
    .limit(limit + 1);

  const page = buildPage(rows, limit, (row) => ({ createdAt: row.createdAt.toISOString() }));

  return NextResponse.json(page);
});
