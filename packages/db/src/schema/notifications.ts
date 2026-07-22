import { pgTable, text, uuid, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { timestamptz } from "./_helpers";
import { workspaces, workspaceMembers } from "./workspaces";
import { projects } from "./projects";

export const notifications = pgTable(
  "notifications",
  {
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
  },
  (t) => [
    // WP-D1: keyset pagination for listForRecipient (ORDER BY created_at DESC,
    // id DESC scoped to workspace+recipient) — previously no index beyond PK,
    // meaning every inbox load was a full table scan.
    index("notifications_recipient_created_idx").on(
      t.workspaceId,
      t.recipientMemberId,
      t.createdAt
    ),
  ]
);
