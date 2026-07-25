import { pgTable, text, uuid, boolean, integer, jsonb, index } from "drizzle-orm/pg-core";
import { timestamptz } from "./_helpers";
import { users } from "./users";
import { workspaces } from "./workspaces";
import { projects } from "./projects";
import { activityEvents } from "./events";

export type AutomationCondition = {
  field: string;
  op: "eq" | "neq" | "in" | "gt" | "lt" | "contains";
  value: unknown;
};

export type AutomationAction = {
  type: string;
  params: Record<string, unknown>;
};

export const automations = pgTable(
  "automations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // null = applies workspace-wide; set = scoped to a single project.
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    // null = matches any entity satisfying trigger+conditions; set = pinned to
    // one specific entity (e.g. a single task). No FK — mirrors activity_events
    // .entityId, which can point at different tables depending on entityType.
    targetEntityId: uuid("target_entity_id"),

    name: text("name").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),

    triggerType: text("trigger_type").notNull(),
    conditions: jsonb("conditions").$type<AutomationCondition[]>().notNull().default([]),
    actions: jsonb("actions").$type<AutomationAction[]>().notNull().default([]),

    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("automations_trigger_idx").on(t.triggerType, t.projectId),
  ]
);

export const automationRuns = pgTable("automation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  automationId: uuid("automation_id")
    .notNull()
    .references(() => automations.id, { onDelete: "cascade" }),
  sourceEventId: uuid("source_event_id")
    .notNull()
    .references(() => activityEvents.id, { onDelete: "cascade" }),
  chainDepth: integer("chain_depth").notNull().default(0),

  // running | succeeded | failed | timed_out
  status: text("status").notNull().default("running"),
  actionsResult: jsonb("actions_result").$type<Record<string, unknown>[]>().notNull().default([]),
  error: text("error"),

  startedAt: timestamptz("started_at").notNull().defaultNow(),
  finishedAt: timestamptz("finished_at"),
});
