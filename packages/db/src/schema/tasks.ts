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
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
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

export const tasks = pgTable("tasks", {
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
  acceptanceCriteria: jsonb("acceptance_criteria")
    .$type<AcceptanceCriterion[]>()
    .notNull()
    .default([]),
  labels: jsonb("labels").$type<string[]>().notNull().default([]),
  position: integer("position").notNull().default(0),
  isMilestone: boolean("is_milestone").notNull().default(false),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  completedAt: timestamptz("completed_at"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  planRef: text("plan_ref"),
});

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
  (t) => [unique().on(t.blockerTaskId, t.blockedTaskId)]
);

export const taskComments = pgTable("task_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  authorMemberId: uuid("author_member_id")
    .notNull()
    .references(() => workspaceMembers.id),
  body: text("body").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});
