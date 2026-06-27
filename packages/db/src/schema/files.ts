import { pgTable, text, uuid, bigint, unique } from "drizzle-orm/pg-core";
import { timestamptz } from "./_helpers";
import { users } from "./users";
import { workspaces } from "./workspaces";
import { tasks } from "./tasks";

export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type"),
  storageKey: text("storage_key").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

export const taskAttachments = pgTable(
  "task_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.taskId, t.fileId)]
);
