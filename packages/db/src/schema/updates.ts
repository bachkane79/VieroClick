import {
  pgTable,
  pgEnum,
  text,
  uuid,
  integer,
  date,
  jsonb,
  boolean,
  check,
  unique,
} from "drizzle-orm/pg-core";
import { timestamptz } from "./_helpers";
import { sql } from "drizzle-orm";
import { workspaceMembers } from "./workspaces";
import { projects } from "./projects";
import { tasks } from "./tasks";
import { taskPriorityEnum } from "./tasks";

export const dailyUpdates = pgTable(
  "daily_updates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => workspaceMembers.id),
    workDate: date("work_date").notNull(),
    completedText: text("completed_text"),
    inProgressText: text("in_progress_text"),
    blockersText: text("blockers_text"),
    confidenceLevel: integer("confidence_level"),
    supportNeeded: text("support_needed"),
    concerns: text("concerns"),
    submittedAt: timestamptz("submitted_at").notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.projectId, t.memberId, t.workDate),
    check("confidence_level_range", sql`${t.confidenceLevel} between 1 and 5`),
  ]
);

export const blockerStatusEnum = pgEnum("blocker_status", [
  "open",
  "in_review",
  "resolved",
  "ignored",
]);

export const blockers = pgTable("blockers", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  reportedByMemberId: uuid("reported_by_member_id").references(() => workspaceMembers.id),
  title: text("title").notNull(),
  description: text("description"),
  status: blockerStatusEnum("status").notNull().default("open"),
  severity: taskPriorityEnum("severity").notNull().default("medium"),
  ownerMemberId: uuid("owner_member_id").references(() => workspaceMembers.id),
  resolvedByMemberId: uuid("resolved_by_member_id").references(() => workspaceMembers.id),
  resolvedAt: timestamptz("resolved_at"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

export const leaderReports = pgTable(
  "leader_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    reportDate: date("report_date").notNull(),
    progressSummary: text("progress_summary").notNull(),
    riskSummary: text("risk_summary"),
    blockerSummary: text("blocker_summary"),
    recommendedActions: jsonb("recommended_actions").$type<string[]>().notNull().default([]),
    memberDemands: jsonb("member_demands").$type<Record<string, unknown>[]>().notNull().default([]),
    planDeviations: jsonb("plan_deviations").$type<Record<string, unknown>[]>().notNull().default([]),
    generatedByAgent: boolean("generated_by_agent").notNull().default(false),
    approvedByMemberId: uuid("approved_by_member_id").references(() => workspaceMembers.id),
    approvedAt: timestamptz("approved_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.projectId, t.reportDate)]
);
