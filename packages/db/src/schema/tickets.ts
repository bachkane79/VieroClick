import { pgTable, pgEnum, text, uuid } from "drizzle-orm/pg-core";
import { timestamptz } from "./_helpers";
import { projects } from "./projects";
import { workspaces, workspaceMembers } from "./workspaces";

/**
 * Ticket — a Linear-style issue/request form submitted by a project member and
 * decided by the project leader. An approval carries a resolution note and
 * triggers a "replan" agent dispatch (see ticket.service.ts); a rejection is
 * terminal with no side effects.
 */
export const ticketStatusEnum = pgEnum("ticket_status", ["open", "approved", "rejected"]);

export const tickets = pgTable("tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  createdByMemberId: uuid("created_by_member_id")
    .notNull()
    .references(() => workspaceMembers.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: ticketStatusEnum("status").notNull().default("open"),
  resolutionNote: text("resolution_note"),
  decidedByMemberId: uuid("decided_by_member_id").references(() => workspaceMembers.id),
  decidedAt: timestamptz("decided_at"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});
