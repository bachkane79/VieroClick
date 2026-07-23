import { pgTable, uuid, text, integer, jsonb } from "drizzle-orm/pg-core";
import { timestamptz } from "./_helpers";

/**
 * WP-D4: audit trail for hard-deleted workspaces. Deliberately has NO foreign
 * key to `workspaces.id` — `activity_events.workspace_id` cascades on workspace
 * delete, so an audit event written there would be destroyed along with the
 * workspace it's supposed to prove was deleted. This table survives instead.
 */
export const workspaceDeletions = pgTable("workspace_deletions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  workspaceName: text("workspace_name").notNull(),
  deletedByUserId: uuid("deleted_by_user_id"),
  memberCount: integer("member_count").notNull().default(0),
  projectCount: integer("project_count").notNull().default(0),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});
