import { pgTable, pgEnum, text, uuid, integer, date, jsonb, unique } from "drizzle-orm/pg-core";
import { timestamptz } from "./_helpers";
import { users } from "./users";
import { workspaces, workspaceMembers } from "./workspaces";

export const projectStatusEnum = pgEnum("project_status", [
  "draft",
  "active",
  "paused",
  "completed",
  "archived",
]);

export const projectRoleEnum = pgEnum("project_role", [
  "project_lead",
  "tech_lead",
  "member",
  "reviewer",
  "stakeholder",
]);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  scope: text("scope"),
  status: projectStatusEnum("status").notNull().default("draft"),
  leadMemberId: uuid("lead_member_id").references(() => workspaceMembers.id),
  startDate: date("start_date"),
  targetEndDate: date("target_end_date"),
  goals: jsonb("goals").$type<string[]>().notNull().default([]),
  constraints: jsonb("constraints").$type<string[]>().notNull().default([]),
  expectedDeliverables: jsonb("expected_deliverables").$type<string[]>().notNull().default([]),
  initialContext: text("initial_context"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

export const projectMembers = pgTable(
  "project_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    workspaceMemberId: uuid("workspace_member_id")
      .notNull()
      .references(() => workspaceMembers.id, { onDelete: "cascade" }),
    role: projectRoleEnum("role").notNull().default("member"),
    allocationPercent: integer("allocation_percent").notNull().default(100),
  },
  (t) => [unique().on(t.projectId, t.workspaceMemberId)]
);
