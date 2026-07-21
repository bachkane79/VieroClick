import { pgTable, text, uuid, unique } from "drizzle-orm/pg-core";
import { timestamptz } from "./_helpers";
import { users } from "./users";

/**
 * Organization — an OPTIONAL umbrella that groups multiple workspaces (teams)
 * and provides a shared people directory. Workspaces can also stand alone
 * (organizationId null) so solo/single-team customers are unaffected. Access
 * remains workspace-scoped; org membership is a directory, not an access grant.
 */
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "admin", "member"] })
      .notNull()
      .default("member"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [unique("organization_members_org_user_unique").on(t.organizationId, t.userId)]
);
