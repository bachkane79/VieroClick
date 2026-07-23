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
    // WP-D5: Inbox 4-tab model. `category` is computed once from `type` at
    // insert time (see categorizeType() in server/lib/notifications.ts).
    // `snoozedUntil`/`clearedAt` drive the Later/Cleared tabs — both are
    // query-time conditions, not cron-driven: an expired snooze just falls
    // back into Primary/Other on the next read (`snoozedUntil <= now()`).
    category: text("category").notNull().default("other"),
    snoozedUntil: timestamptz("snoozed_until"),
    clearedAt: timestamptz("cleared_at"),
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
    // WP-D5: the 4-tab inbox query filters/sorts by exactly this tuple.
    index("notifications_inbox_tab_idx").on(
      t.workspaceId,
      t.recipientMemberId,
      t.category,
      t.clearedAt,
      t.snoozedUntil
    ),
  ]
);
