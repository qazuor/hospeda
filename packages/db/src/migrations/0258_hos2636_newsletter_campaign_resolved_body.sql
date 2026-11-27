ALTER TABLE "newsletter_campaigns" ADD COLUMN "resolved_body_json" jsonb;--> statement-breakpoint
ALTER TABLE "newsletter_campaigns" ADD COLUMN "resolved_at" timestamp with time zone;