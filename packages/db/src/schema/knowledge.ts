import { pgTable, pgEnum, text, uuid, jsonb, vector } from "drizzle-orm/pg-core";
import { timestamptz } from "./_helpers";
import { users } from "./users";
import { workspaceMembers } from "./workspaces";
import { projects } from "./projects";

export const projectDocTypeEnum = pgEnum("project_doc_type", [
  "requirement",
  "technical_note",
  "decision",
  "meeting_note",
  "scope",
  "other",
]);

export const projectDocs = pgTable("project_docs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  type: projectDocTypeEnum("type").notNull().default("other"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

export const decisionLogs = pgTable("decision_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  decision: text("decision").notNull(),
  reason: text("reason"),
  decidedByMemberId: uuid("decided_by_member_id").references(() => workspaceMembers.id),
  affectedTaskIds: uuid("affected_task_ids").array().notNull().default([]),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(),
  sourceId: uuid("source_id").notNull(),
  chunkText: text("chunk_text").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});
