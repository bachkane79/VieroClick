ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "rework_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "task_comments" ADD COLUMN IF NOT EXISTS "parent_comment_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_parent_comment_id_task_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."task_comments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
