import { pgTable, text, uuid, boolean, jsonb } from "drizzle-orm/pg-core";
import { timestamptz } from "./_helpers";
import { workspaces, workspaceMembers } from "./workspaces";
import { projects } from "./projects";

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  recipientMemberId: uuid("recipient_member_id")
    .notNull()
    .references(() => workspaceMembers.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamptz("read_at"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});
