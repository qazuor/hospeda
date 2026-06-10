ALTER TABLE "accommodation_reviews" ADD COLUMN "moderation_state" "moderation_status_enum" DEFAULT 'APPROVED' NOT NULL;--> statement-breakpoint
ALTER TABLE "accommodation_reviews" ADD COLUMN "moderated_by_id" uuid;--> statement-breakpoint
ALTER TABLE "accommodation_reviews" ADD COLUMN "moderated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accommodation_reviews" ADD COLUMN "moderation_reason" text;--> statement-breakpoint
ALTER TABLE "destination_reviews" ADD COLUMN "moderation_state" "moderation_status_enum" DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
-- SPEC-166 §3.5: pre-existing destination_reviews were publicly visible before moderation
-- was introduced, so they should be backfilled to APPROVED. Future inserts still default
-- to PENDING (the column DEFAULT above).  This UPDATE runs once during the migration and
-- only touches rows that exist at migration time.
UPDATE "destination_reviews" SET "moderation_state" = 'APPROVED';--> statement-breakpoint
ALTER TABLE "destination_reviews" ADD COLUMN "moderated_by_id" uuid;--> statement-breakpoint
ALTER TABLE "destination_reviews" ADD COLUMN "moderated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "destination_reviews" ADD COLUMN "moderation_reason" text;--> statement-breakpoint
ALTER TABLE "accommodation_reviews" ADD CONSTRAINT "accommodation_reviews_moderated_by_id_users_id_fk" FOREIGN KEY ("moderated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_reviews" ADD CONSTRAINT "destination_reviews_moderated_by_id_users_id_fk" FOREIGN KEY ("moderated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accommodation_reviews_moderationState_idx" ON "accommodation_reviews" USING btree ("moderation_state");--> statement-breakpoint
CREATE INDEX "destination_reviews_moderationState_idx" ON "destination_reviews" USING btree ("moderation_state");