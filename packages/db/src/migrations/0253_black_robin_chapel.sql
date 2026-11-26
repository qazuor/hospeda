CREATE TABLE "accommodation_review_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"moderation_state" "moderation_status_enum" DEFAULT 'APPROVED' NOT NULL,
	"moderated_by_id" uuid,
	"moderated_at" timestamp with time zone,
	"moderation_reason" text,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
ALTER TABLE "accommodation_review_replies" ADD CONSTRAINT "accommodation_review_replies_review_id_accommodation_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."accommodation_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_review_replies" ADD CONSTRAINT "accommodation_review_replies_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_review_replies" ADD CONSTRAINT "accommodation_review_replies_moderated_by_id_users_id_fk" FOREIGN KEY ("moderated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_review_replies" ADD CONSTRAINT "accommodation_review_replies_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_review_replies" ADD CONSTRAINT "accommodation_review_replies_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_review_replies" ADD CONSTRAINT "accommodation_review_replies_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accommodationReviewReplies_reviewId_live_uniq" ON "accommodation_review_replies" USING btree ("review_id") WHERE "accommodation_review_replies"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "accommodationReviewReplies_moderationState_idx" ON "accommodation_review_replies" USING btree ("moderation_state");