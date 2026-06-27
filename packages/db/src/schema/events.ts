import { pgTable, text, uuid, jsonb } from "drizzle-orm/pg-core";
import { timestamptz } from "./_helpers";
import { users } from "./users";
import { workspaces, workspaceMembers } from "./workspaces";
import { projects } from "./projects";

export const activityEvents = pgTable("activity_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  actorMemberId: uuid("actor_member_id").references(() => workspaceMembers.id),
  actorType: text("actor_type").notNull().default("human"),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  eventType: text("event_type").notNull(),
  beforeData: jsonb("before_data").$type<Record<string, unknown>>(),
  afterData: jsonb("after_data").$type<Record<string, unknown>>(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});
