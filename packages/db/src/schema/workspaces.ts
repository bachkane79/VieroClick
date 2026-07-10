import { pgTable, pgEnum, text, uuid, numeric, integer, jsonb, unique } from "drizzle-orm/pg-core";
import { timestamptz } from "./_helpers";
import { users } from "./users";

export const workspaceRoleEnum = pgEnum("workspace_role", [
  "owner",
  "admin",
  "leader",
  "member",
  "viewer",
]);

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  // Optional umbrella org (see schema/organizations.ts). Null = standalone team.
  // No FK reference here to avoid a circular import (organizations imports users
  // only); the column is a plain uuid enforced at the DB level by the migration.
  organizationId: uuid("organization_id"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceRoleEnum("role").notNull().default("member"),
    title: text("title"),
    department: text("department"),
    joinedAt: timestamptz("joined_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.workspaceId, t.userId)]
);

export const memberProfiles = pgTable("member_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceMemberId: uuid("workspace_member_id")
    .notNull()
    .unique()
    .references(() => workspaceMembers.id, { onDelete: "cascade" }),
  skills: jsonb("skills").$type<string[]>().notNull().default([]),
  seniorityLevel: integer("seniority_level").notNull().default(1),
  availabilityHoursPerWeek: numeric("availability_hours_per_week", { precision: 5, scale: 2 }),
  timezone: text("timezone"),
  reliabilityScore: numeric("reliability_score", { precision: 5, scale: 2 }).notNull().default("0"),
  speedScore: numeric("speed_score", { precision: 5, scale: 2 }).notNull().default("0"),
  qualityScore: numeric("quality_score", { precision: 5, scale: 2 }).notNull().default("0"),
  communicationScore: numeric("communication_score", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  blockerHandlingScore: numeric("blocker_handling_score", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  profileNotes: text("profile_notes"),
  updatedByAgentAt: timestamptz("updated_by_agent_at"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});
