CREATE TYPE "public"."host_trade_usage_channel_enum" AS ENUM('QR', 'LINKED_SELECTOR', 'EMAIL_LOOKUP');--> statement-breakpoint
CREATE TYPE "public"."host_trade_usage_declared_by_enum" AS ENUM('PROVIDER', 'HOST');--> statement-breakpoint
CREATE TYPE "public"."host_trade_usage_status_enum" AS ENUM('PENDING', 'CONFIRMED', 'REJECTED', 'EXPIRED');--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'hostTrade.review.create' BEFORE 'socialPost.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'hostTrade.review.viewAll' BEFORE 'socialPost.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'hostTrade.review.moderate' BEFORE 'socialPost.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'hostTrade.usage.viewAll' BEFORE 'socialPost.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'hostTrade.usage.manage' BEFORE 'socialPost.view';--> statement-breakpoint
CREATE TABLE "host_trade_benefit_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_trade_id" uuid NOT NULL,
	"host_user_id" uuid NOT NULL,
	"declared_by" "host_trade_usage_declared_by_enum" NOT NULL,
	"declared_by_id" uuid NOT NULL,
	"creation_channel" "host_trade_usage_channel_enum" NOT NULL,
	"status" "host_trade_usage_status_enum" DEFAULT 'PENDING' NOT NULL,
	"serviced_at" date NOT NULL,
	"note" text,
	"expires_at" timestamp with time zone NOT NULL,
	"reminder_sent_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"confirmed_by_id" uuid,
	"rejected_at" timestamp with time zone,
	"rejected_by_id" uuid,
	"rejection_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "host_trade_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_trade_id" uuid NOT NULL,
	"host_user_id" uuid NOT NULL,
	"overall_rating" integer NOT NULL,
	"rating" jsonb,
	"average_rating" numeric(3, 2),
	"respected_benefit" boolean NOT NULL,
	"content" text,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
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
CREATE TABLE "host_trade_review_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"moderation_state" "moderation_status_enum" DEFAULT 'PENDING' NOT NULL,
	"moderated_by_id" uuid,
	"moderated_at" timestamp with time zone,
	"moderation_reason" text,
	"review_edited_after_reply" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
ALTER TABLE "host_trades" ADD COLUMN "confirmed_uses_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "host_trades" ADD COLUMN "distinct_hosts_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "host_trades" ADD COLUMN "reviews_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "host_trades" ADD COLUMN "average_rating" numeric(3, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "host_trades" ADD COLUMN "benefit_respected_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "host_trades" ADD COLUMN "declaration_suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "host_trades" ADD COLUMN "declaration_suspended_by_id" uuid;--> statement-breakpoint
ALTER TABLE "host_trades" ADD COLUMN "declaration_suspend_reason" text;--> statement-breakpoint
ALTER TABLE "host_trade_benefit_usages" ADD CONSTRAINT "host_trade_benefit_usages_host_trade_id_host_trades_id_fk" FOREIGN KEY ("host_trade_id") REFERENCES "public"."host_trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trade_benefit_usages" ADD CONSTRAINT "host_trade_benefit_usages_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trade_benefit_usages" ADD CONSTRAINT "host_trade_benefit_usages_declared_by_id_users_id_fk" FOREIGN KEY ("declared_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trade_benefit_usages" ADD CONSTRAINT "host_trade_benefit_usages_confirmed_by_id_users_id_fk" FOREIGN KEY ("confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trade_benefit_usages" ADD CONSTRAINT "host_trade_benefit_usages_rejected_by_id_users_id_fk" FOREIGN KEY ("rejected_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trade_benefit_usages" ADD CONSTRAINT "host_trade_benefit_usages_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trade_benefit_usages" ADD CONSTRAINT "host_trade_benefit_usages_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trade_benefit_usages" ADD CONSTRAINT "host_trade_benefit_usages_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trade_reviews" ADD CONSTRAINT "host_trade_reviews_host_trade_id_host_trades_id_fk" FOREIGN KEY ("host_trade_id") REFERENCES "public"."host_trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trade_reviews" ADD CONSTRAINT "host_trade_reviews_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trade_reviews" ADD CONSTRAINT "host_trade_reviews_moderated_by_id_users_id_fk" FOREIGN KEY ("moderated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trade_reviews" ADD CONSTRAINT "host_trade_reviews_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trade_reviews" ADD CONSTRAINT "host_trade_reviews_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trade_reviews" ADD CONSTRAINT "host_trade_reviews_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trade_review_replies" ADD CONSTRAINT "host_trade_review_replies_review_id_host_trade_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."host_trade_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trade_review_replies" ADD CONSTRAINT "host_trade_review_replies_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trade_review_replies" ADD CONSTRAINT "host_trade_review_replies_moderated_by_id_users_id_fk" FOREIGN KEY ("moderated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trade_review_replies" ADD CONSTRAINT "host_trade_review_replies_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trade_review_replies" ADD CONSTRAINT "host_trade_review_replies_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trade_review_replies" ADD CONSTRAINT "host_trade_review_replies_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hostTradeBenefitUsages_hostTradeId_idx" ON "host_trade_benefit_usages" USING btree ("host_trade_id");--> statement-breakpoint
CREATE INDEX "hostTradeBenefitUsages_hostUserId_idx" ON "host_trade_benefit_usages" USING btree ("host_user_id");--> statement-breakpoint
CREATE INDEX "hostTradeBenefitUsages_status_idx" ON "host_trade_benefit_usages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "hostTradeBenefitUsages_hostTradeId_status_idx" ON "host_trade_benefit_usages" USING btree ("host_trade_id","status");--> statement-breakpoint
CREATE INDEX "hostTradeBenefitUsages_hostUserId_status_idx" ON "host_trade_benefit_usages" USING btree ("host_user_id","status");--> statement-breakpoint
CREATE INDEX "hostTradeBenefitUsages_expiresAt_idx" ON "host_trade_benefit_usages" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "hostTradeBenefitUsages_hostTradeId_hostUserId_idx" ON "host_trade_benefit_usages" USING btree ("host_trade_id","host_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hostTradeBenefitUsages_pendingPair_uniq" ON "host_trade_benefit_usages" USING btree ("host_trade_id","host_user_id") WHERE status = 'PENDING' AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "hostTradeReviews_hostTradeId_idx" ON "host_trade_reviews" USING btree ("host_trade_id");--> statement-breakpoint
CREATE INDEX "hostTradeReviews_hostUserId_idx" ON "host_trade_reviews" USING btree ("host_user_id");--> statement-breakpoint
CREATE INDEX "hostTradeReviews_moderationState_idx" ON "host_trade_reviews" USING btree ("moderation_state");--> statement-breakpoint
CREATE INDEX "hostTradeReviews_hostTradeId_moderationState_idx" ON "host_trade_reviews" USING btree ("host_trade_id","moderation_state");--> statement-breakpoint
CREATE UNIQUE INDEX "hostTradeReviews_hostUserId_hostTradeId_uniq" ON "host_trade_reviews" USING btree ("host_user_id","host_trade_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hostTradeReviewReplies_reviewId_uniq" ON "host_trade_review_replies" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "hostTradeReviewReplies_moderationState_idx" ON "host_trade_review_replies" USING btree ("moderation_state");--> statement-breakpoint
ALTER TABLE "host_trades" ADD CONSTRAINT "host_trades_declaration_suspended_by_id_users_id_fk" FOREIGN KEY ("declaration_suspended_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;