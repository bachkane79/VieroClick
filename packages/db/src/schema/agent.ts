import { pgTable, pgEnum, text, uuid, jsonb, boolean } from "drizzle-orm/pg-core";
import { timestamptz } from "./_helpers";
import { users } from "./users";
import { workspaceMembers } from "./workspaces";
import { projects } from "./projects";

export const agentJobStatusEnum = pgEnum("agent_job_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

export const agentJobs = pgTable("agent_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  jobType: text("job_type").notNull(),
  status: agentJobStatusEnum("status").notNull().default("queued"),
  input: jsonb("input").$type<Record<string, unknown>>().notNull().default({}),
  output: jsonb("output").$type<Record<string, unknown>>(),
  error: text("error"),
  requestedByUserId: uuid("requested_by_user_id").references(() => users.id),
  startedAt: timestamptz("started_at"),
  finishedAt: timestamptz("finished_at"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

export const agentSuggestions = pgTable("agent_suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").references(() => agentJobs.id, { onDelete: "set null" }),
  suggestionType: text("suggestion_type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  status: text("status").notNull().default("pending"),
  reviewedByMemberId: uuid("reviewed_by_member_id").references(() => workspaceMembers.id),
  reviewedAt: timestamptz("reviewed_at"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});
