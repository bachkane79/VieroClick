import {
  pgTable,
  pgEnum,
  text,
  uuid,
  integer,
  boolean,
  date,
  numeric,
  jsonb,
  unique,
  uniqueIndex,
  check,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { timestamptz } from "./_helpers";
import { users } from "./users";
import { workspaceMembers } from "./workspaces";
import { projects } from "./projects";

export interface AcceptanceCriterion {
  id?: string;
  text: string;
  required: boolean;
  checked: boolean;
}

export const taskStatusTypeEnum = pgEnum("task_status_type", [
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
]);

export const taskPriorityEnum = pgEnum("task_priority", ["low", "medium", "high", "urgent"]);

export const taskStatuses = pgTable(
  "task_statuses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: taskStatusTypeEnum("type").notNull(),
    position: integer("position").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
  },
  (t) => [unique().on(t.projectId, t.name)]
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    parentTaskId: uuid("parent_task_id").references((): AnyPgColumn => tasks.id, {
      onDelete: "cascade",
    }),
    statusId: uuid("status_id")
      .notNull()
      .references(() => taskStatuses.id),
    title: text("title").notNull(),
    description: text("description"),
    priority: taskPriorityEnum("priority").notNull().default("medium"),
    assigneeMemberId: uuid("assignee_member_id").references(() => workspaceMembers.id),
    reporterMemberId: uuid("reporter_member_id").references(() => workspaceMembers.id),
    startDate: date("start_date"),
    dueDate: date("due_date"),
    estimateHours: numeric("estimate_hours", { precision: 6, scale: 2 }),
    actualHours: numeric("actual_hours", { precision: 6, scale: 2 }),
    // Number of times this task was sent back for rework during review (feeds quality score).
    reworkCount: integer("rework_count").notNull().default(0),
    acceptanceCriteria: jsonb("acceptance_criteria")
      .$type<AcceptanceCriterion[]>()
      .notNull()
      .default([]),
    labels: jsonb("labels").$type<string[]>().notNull().default([]),
    position: integer("position").notNull().default(0),
    milestoneId: uuid("milestone_id"), // FK to milestones(id) — omit .references() to avoid circular import (planning.ts → tasks.ts)
    isMilestone: boolean("is_milestone").notNull().default(false),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    completedAt: timestamptz("completed_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
    planRef: text("plan_ref"),
    // WP-D3: optimistic concurrency token, see projects.version for the same pattern.
    version: integer("version").notNull().default(1),
  },
  (t) => [
    uniqueIndex("tasks_project_plan_ref_idx")
      .on(t.projectId, t.planRef)
      .where(sql`plan_ref IS NOT NULL`),
  ]
);

export const taskDependencies = pgTable(
  "task_dependencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    blockerTaskId: uuid("blocker_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    blockedTaskId: uuid("blocked_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    dependencyType: text("dependency_type").notNull().default("finish_to_start"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.blockerTaskId, t.blockedTaskId),
    check("no_self_dependency", sql`${t.blockerTaskId} <> ${t.blockedTaskId}`),
  ]
);

// Multi-assignee join table. `tasks.assigneeMemberId` remains the PRIMARY/lead
// assignee (kept in sync as the first entry) for backward compatibility; this
// table holds the full assignee set.
export const taskAssignees = pgTable(
  "task_assignees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    workspaceMemberId: uuid("workspace_member_id")
      .notNull()
      .references(() => workspaceMembers.id, { onDelete: "cascade" }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [unique("task_assignees_task_member_unique").on(t.taskId, t.workspaceMemberId)]
);

export const taskComments = pgTable("task_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  // Self-reference for threaded replies (null = top-level comment).
  parentCommentId: uuid("parent_comment_id").references((): AnyPgColumn => taskComments.id, {
    onDelete: "cascade",
  }),
  authorMemberId: uuid("author_member_id")
    .notNull()
    .references(() => workspaceMembers.id),
  body: text("body").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});
