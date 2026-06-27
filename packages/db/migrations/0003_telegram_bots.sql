CREATE TABLE IF NOT EXISTS "telegram_bots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"bot_token" text NOT NULL,
	"bot_username" text,
	"default_chat_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_bots_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "telegram_bots" ADD CONSTRAINT "telegram_bots_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
