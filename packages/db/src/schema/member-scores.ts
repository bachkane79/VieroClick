import { pgTable, uuid, numeric, unique, index } from "drizzle-orm/pg-core";
import { timestamptz } from "./_helpers";
import { workspaceMembers } from "./workspaces";
import { projects } from "./projects";

// One computed profile per (project, member): a snapshot of a member's five
// operational metrics derived from that project's own tasks / daily updates /
// blockers (no EMA smoothing — see member-score.service#recomputeProjectMemberScore).
// The workspace-level effective score is the unweighted mean of the leader seed
// (member_profiles.*_seed) plus one of these rows per project the member is in.
// Columns are nullable: null = no signal for that metric in this project, so it
// is excluded from the mean.
export const projectMemberScores = pgTable(
  "project_member_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    workspaceMemberId: uuid("workspace_member_id")
      .notNull()
      .references(() => workspaceMembers.id, { onDelete: "cascade" }),
    reliabilityScore: numeric("reliability_score", { precision: 5, scale: 2 }),
    speedScore: numeric("speed_score", { precision: 5, scale: 2 }),
    qualityScore: numeric("quality_score", { precision: 5, scale: 2 }),
    communicationScore: numeric("communication_score", { precision: 5, scale: 2 }),
    blockerHandlingScore: numeric("blocker_handling_score", { precision: 5, scale: 2 }),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.projectId, t.workspaceMemberId),
    index("project_member_scores_member_idx").on(t.workspaceMemberId),
  ]
);
