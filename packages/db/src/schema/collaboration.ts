import { pgTable, text, uuid, integer, boolean, type AnyPgColumn } from "drizzle-orm/pg-core";
import { timestamptz } from "./_helpers";
import { users } from "./users";
import { workspaces, workspaceMembers } from "./workspaces";

/**
 * Workspace-level Docs/Wiki — a nested tree of documents shared by the whole
 * team (distinct from per-project docs). Content is markdown text.
 */
export const workspaceDocs = pgTable("workspace_docs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id").references((): AnyPgColumn => workspaceDocs.id, {
    onDelete: "cascade",
  }),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  icon: text("icon"),
  position: integer("position").notNull().default(0),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

/**
 * Team Hub announcements / posts — the casual team "sinh hoạt" board at the
 * workspace level.
 */
export const workspacePosts = pgTable("workspace_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  authorMemberId: uuid("author_member_id")
    .notNull()
    .references(() => workspaceMembers.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});
