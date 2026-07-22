import { pgTable, pgEnum, uuid, text, unique } from "drizzle-orm/pg-core";
import { timestamptz } from "./_helpers";
import { users } from "./users";
import { workspaces, workspaceMembers } from "./workspaces";

/**
 * Fine-grained permission infrastructure — the "Hybrid" ClickUp-style model
 * (§4.2). Layered on top of the existing workspace → project → task hierarchy
 * rather than introducing a separate Space/Folder/List tree.
 *
 * A subject's effective access to an item is resolved in this order, first
 * match wins (see server/lib/permissions resolver):
 *   1. creator of the item          → full
 *   2. personal grant (member)      → its level
 *   3. team grant (member in team)  → its level
 *   4. item is private & subject not shared → no access
 *   5. subject is a guest           → capped / no Space access
 *   6. inherited from hierarchy     → role default (members: full on public items)
 * When several sources apply, the most specific location + highest level wins.
 * Levels rank:  full > edit > comment > view.
 */

// Four access levels, ordered weakest → strongest (index encodes the rank).
export const permissionLevelEnum = pgEnum("permission_level", ["view", "comment", "edit", "full"]);

// The kinds of items a grant can target. Extensible; starts with the three
// shareable resources that exist today (project ≈ ClickUp Space/List).
export const permissionResourceTypeEnum = pgEnum("permission_resource_type", [
  "project",
  "task",
  "doc",
]);

// A grant is addressed to either a single membership (user/guest) or a team.
export const permissionSubjectTypeEnum = pgEnum("permission_subject_type", ["member", "team"]);

/**
 * Teams — a named group of workspace members that a grant can target, so
 * "share with the Design team" is one grant row instead of N. Membership in a
 * team confers NO access by itself (a directory, like organizations); access
 * only comes from a `permission_grants` row whose subject is the team.
 */
export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    workspaceMemberId: uuid("workspace_member_id")
      .notNull()
      .references(() => workspaceMembers.id, { onDelete: "cascade" }),
  },
  (t) => [unique().on(t.teamId, t.workspaceMemberId)]
);

/**
 * The polymorphic ACL. One row = "subject S has level L on item (type, id)".
 * Absence of any matching row means access falls through to hierarchy
 * inheritance / role defaults (resolved in code, not encoded here).
 *
 * `subjectId` is a `workspace_members.id` when `subjectType = 'member'`, or a
 * `teams.id` when `'team'`. No FK (polymorphic); integrity is enforced in the
 * service layer that writes grants.
 */
export const permissionGrants = pgTable(
  "permission_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Scope every grant to a workspace for cheap isolation + cascade cleanup.
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    resourceType: permissionResourceTypeEnum("resource_type").notNull(),
    resourceId: uuid("resource_id").notNull(),
    subjectType: permissionSubjectTypeEnum("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    level: permissionLevelEnum("level").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.resourceType, t.resourceId, t.subjectType, t.subjectId)]
);
