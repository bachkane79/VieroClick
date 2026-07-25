-- Existing automations/automation_runs are seed/QA data only (jsonb
-- conditions/actions columns are being replaced by normalized tables below) —
-- discarded rather than migrated, per explicit product decision.
TRUNCATE TABLE "automation_runs", "automations" RESTART IDENTITY CASCADE;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "automation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"automation_id" uuid NOT NULL,
	"type" text NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "automation_conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"automation_id" uuid NOT NULL,
	"field" text NOT NULL,
	"op" text NOT NULL,
	"value" jsonb,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "automation_actions" ADD CONSTRAINT "automation_actions_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "automation_conditions" ADD CONSTRAINT "automation_conditions_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "automation_actions_automation_idx" ON "automation_actions" USING btree ("automation_id","order_index");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "automation_conditions_automation_idx" ON "automation_conditions" USING btree ("automation_id");--> statement-breakpoint
ALTER TABLE "automations" DROP COLUMN IF EXISTS "conditions";--> statement-breakpoint
ALTER TABLE "automations" DROP COLUMN IF EXISTS "actions";