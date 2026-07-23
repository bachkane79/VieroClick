import { pgTable, pgEnum, text, uuid, index, unique, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { timestamptz } from "./_helpers";
import { workspaces, workspaceMembers } from "./workspaces";

/**
 * Discord/ClickUp-style chat (full-system spec §5.13, UC-08).
 * Two channel kinds share one table:
 *  - "channel": open to every workspace member (no membership rows needed).
 *  - "dm": a private pair conversation — exactly two `channel_members` rows.
 */
export const channelTypeEnum = pgEnum("channel_type", ["channel", "dm"]);

export const channels = pgTable(
  "channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    type: channelTypeEnum("type").notNull().default("channel"),
    // For DMs the name is a placeholder ("dm") — the UI renders the other
    // participant's name instead.
    name: text("name").notNull(),
    topic: text("topic"),
    createdByMemberId: uuid("created_by_member_id")
      .notNull()
      .references(() => workspaceMembers.id, { onDelete: "cascade" }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // Channel names are unique per workspace; DMs are exempt (they all share
    // the placeholder name and are deduplicated per member pair in the service).
    uniqueIndex("channels_workspace_name_idx")
      .on(t.workspaceId, t.name)
      .where(sql`type = 'channel'`),
  ]
);

export const channelMembers = pgTable(
  "channel_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    workspaceMemberId: uuid("workspace_member_id")
      .notNull()
      .references(() => workspaceMembers.id, { onDelete: "cascade" }),
    joinedAt: timestamptz("joined_at").notNull().defaultNow(),
  },
  (t) => [unique("channel_members_channel_member_unique").on(t.channelId, t.workspaceMemberId)]
);

export const channelMessages = pgTable(
  "channel_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    authorMemberId: uuid("author_member_id")
      .notNull()
      .references(() => workspaceMembers.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [index("channel_messages_channel_created_idx").on(t.channelId, t.createdAt)]
);

/**
 * WP-E2: per-member read cursor. A separate table (not a column on
 * `channelMembers`) because open "channel" type rows have no membership row
 * to hang a cursor off — this table is upserted for any channel type the
 * moment a member reads it, regardless of membership semantics.
 */
export const channelReads = pgTable(
  "channel_reads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    workspaceMemberId: uuid("workspace_member_id")
      .notNull()
      .references(() => workspaceMembers.id, { onDelete: "cascade" }),
    lastReadAt: timestamptz("last_read_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("channel_reads_channel_member_idx").on(t.channelId, t.workspaceMemberId)]
);
