CREATE TABLE IF NOT EXISTS "dead_letter" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"job_type" text,
	"project_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "telegram_bots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"bot_token" text NOT NULL,
	"bot_username" text,
	"default_chat_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_bots_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "telegram_pending_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"chat_id" text NOT NULL,
	"action_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "agent_autonomy" text DEFAULT 'full_auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "agent_confidence_threshold" real DEFAULT 0.7 NOT NULL;--> statement-breakpoint
ALTER TABLE "task_comments" ADD COLUMN "parent_comment_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "rework_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "milestone_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "plan_ref" text;--> statement-breakpoint
ALTER TABLE "blockers" ADD COLUMN "escalated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "plan_ref" text;--> statement-breakpoint
ALTER TABLE "project_risks" ADD COLUMN "escalated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project_risks" ADD COLUMN "plan_ref" text;--> statement-breakpoint
ALTER TABLE "wbs_nodes" ADD COLUMN "plan_ref" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dead_letter" ADD CONSTRAINT "dead_letter_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "telegram_bots" ADD CONSTRAINT "telegram_bots_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "telegram_pending_actions" ADD CONSTRAINT "telegram_pending_actions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "telegram_pending_actions" ADD CONSTRAINT "telegram_pending_actions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telegram_pending_actions_chat_status_idx" ON "telegram_pending_actions" USING btree ("chat_id","status");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_parent_comment_id_task_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."task_comments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tasks_project_plan_ref_idx" ON "tasks" USING btree ("project_id","plan_ref") WHERE plan_ref IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "milestones_project_plan_ref_idx" ON "milestones" USING btree ("project_id","plan_ref") WHERE plan_ref IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_risks_project_plan_ref_idx" ON "project_risks" USING btree ("project_id","plan_ref") WHERE plan_ref IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wbs_nodes_project_plan_ref_idx" ON "wbs_nodes" USING btree ("project_id","plan_ref") WHERE plan_ref IS NOT NULL;