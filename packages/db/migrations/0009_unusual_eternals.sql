ALTER TABLE "notifications" ADD COLUMN "category" text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "snoozed_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "cleared_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_inbox_tab_idx" ON "notifications" USING btree ("workspace_id","recipient_member_id","category","cleared_at","snoozed_until");