CREATE TYPE "public"."external_reputation_run_status_enum" AS ENUM('idle', 'pending', 'running');--> statement-breakpoint
ALTER TABLE "accommodation_external_reputation" ADD COLUMN "run_status" "external_reputation_run_status_enum" DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "accommodation_external_reputation" ADD COLUMN "apify_run_id" text;--> statement-breakpoint
ALTER TABLE "accommodation_external_reputation" ADD COLUMN "apify_dataset_id" text;--> statement-breakpoint
ALTER TABLE "accommodation_external_reputation" ADD COLUMN "run_started_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "accommodation_external_reputation_runStatus_idx" ON "accommodation_external_reputation" USING btree ("run_status");