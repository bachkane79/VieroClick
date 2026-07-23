CREATE INDEX IF NOT EXISTS "tasks_project_active_idx" ON "tasks" USING btree ("project_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_assignee_active_idx" ON "tasks" USING btree ("assignee_member_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blockers_project_idx" ON "blockers" USING btree ("project_id");