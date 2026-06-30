import { pgTable, text, uuid, integer, date, check, uniqueIndex, type AnyPgColumn } from "drizzle-orm/pg-core";
import { timestamptz } from "./_helpers";
import { sql } from "drizzle-orm";
import { workspaceMembers } from "./workspaces";
import { projects } from "./projects";
import { tasks } from "./tasks";

export const milestones = pgTable(
  "milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    targetDate: date("target_date"),
    status: text("status").notNull().default("planned"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    planRef: text("plan_ref"),
  },
  (t) => [
    uniqueIndex("milestones_project_plan_ref_idx")
      .on(t.projectId, t.planRef)
      .where(sql`plan_ref IS NOT NULL`),
  ]
);

export const projectRisks = pgTable(
  "project_risks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    probability: integer("probability"),
    impact: integer("impact"),
    ownerMemberId: uuid("owner_member_id").references(() => workspaceMembers.id),
    mitigation: text("mitigation"),
    escalationPath: text("escalation_path"),
    status: text("status").notNull().default("open"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
    escalatedAt: timestamptz("escalated_at"),
    planRef: text("plan_ref"),
  },
  (t) => [
    check("probability_range", sql`${t.probability} between 1 and 5`),
    check("impact_range", sql`${t.impact} between 1 and 5`),
    uniqueIndex("project_risks_project_plan_ref_idx")
      .on(t.projectId, t.planRef)
      .where(sql`plan_ref IS NOT NULL`),
  ]
);

export const wbsNodes = pgTable(
  "wbs_nodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => wbsNodes.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    nodeType: text("node_type").notNull(),
    linkedTaskId: uuid("linked_task_id").references(() => tasks.id, { onDelete: "set null" }),
    position: integer("position").notNull().default(0),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    planRef: text("plan_ref"),
  },
  (t) => [
    uniqueIndex("wbs_nodes_project_plan_ref_idx")
      .on(t.projectId, t.planRef)
      .where(sql`plan_ref IS NOT NULL`),
  ]
);
