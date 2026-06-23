CREATE TYPE "public"."social_approval_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED');--> statement-breakpoint
CREATE TYPE "public"."social_asset_source_enum" AS ENUM('CHATGPT_FILE', 'CLOUDINARY', 'MANUAL_UPLOAD', 'EXTERNAL_URL');--> statement-breakpoint
CREATE TYPE "public"."social_media_type_enum" AS ENUM('IMAGE', 'VIDEO', 'NONE');--> statement-breakpoint
CREATE TYPE "public"."social_platform_enum" AS ENUM('INSTAGRAM', 'FACEBOOK', 'X');--> statement-breakpoint
CREATE TYPE "public"."social_post_status_enum" AS ENUM('DRAFT', 'NEEDS_REVIEW', 'APPROVED', 'SCHEDULED', 'READY_TO_PUBLISH', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'PAUSED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."social_publish_format_enum" AS ENUM('FEED_POST', 'PHOTO_POST', 'TEXT_POST', 'IMAGE_POST', 'VIDEO_POST', 'REEL', 'STORY', 'CAROUSEL');--> statement-breakpoint
CREATE TYPE "public"."social_publish_result_status_enum" AS ENUM('SUCCESS', 'FAILED', 'SKIPPED', 'RETRYING');--> statement-breakpoint
CREATE TYPE "public"."social_recurrence_type_enum" AS ENUM('ONCE', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');--> statement-breakpoint
CREATE TYPE "public"."social_source_enum" AS ENUM('CHATGPT', 'ADMIN', 'IMPORT', 'SYSTEM');--> statement-breakpoint
ALTER TYPE "public"."permission_category_enum" ADD VALUE 'SOCIAL_POST';--> statement-breakpoint
ALTER TYPE "public"."permission_category_enum" ADD VALUE 'SOCIAL_HASHTAG';--> statement-breakpoint
ALTER TYPE "public"."permission_category_enum" ADD VALUE 'SOCIAL_CAMPAIGN';--> statement-breakpoint
ALTER TYPE "public"."permission_category_enum" ADD VALUE 'SOCIAL_BATCH';--> statement-breakpoint
ALTER TYPE "public"."permission_category_enum" ADD VALUE 'SOCIAL_AUDIENCE';--> statement-breakpoint
ALTER TYPE "public"."permission_category_enum" ADD VALUE 'SOCIAL_PLATFORM';--> statement-breakpoint
ALTER TYPE "public"."permission_category_enum" ADD VALUE 'SOCIAL_FOOTER';--> statement-breakpoint
ALTER TYPE "public"."permission_category_enum" ADD VALUE 'SOCIAL_SETTINGS';--> statement-breakpoint
ALTER TYPE "public"."permission_category_enum" ADD VALUE 'SOCIAL_AUDIT';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'socialPost.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'socialPost.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'socialPost.update';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'socialPost.approve';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'socialPost.schedule';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'socialPost.pause';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'socialPost.archive';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'socialPost.hardDelete';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'socialPost.viewLogs';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'socialHashtag.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'socialHashtag.manage';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'socialHashtagSet.manage';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'socialFooter.manage';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'socialCampaign.manage';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'socialBatch.manage';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'socialAudience.manage';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'socialPlatform.manage';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'socialPlatformFormat.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'socialAsset.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'socialAsset.manage';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'socialSettings.manage';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'socialPublishLog.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'socialAuditLog.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'socialDispatch.manage';--> statement-breakpoint
CREATE TABLE "social_ai_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" text NOT NULL,
	"source" "social_source_enum" NOT NULL,
	"topic" text,
	"user_idea" text,
	"pillar" text,
	"audience_id" uuid,
	"suggested_platforms_json" jsonb,
	"suggested_format" text,
	"generated_caption_base" text,
	"raw_request_json" jsonb,
	"raw_response_json" jsonb,
	"status" text NOT NULL,
	"error_message" text,
	"suggested_platform" "social_platform_enum",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "social_asset_source_enum" NOT NULL,
	"cloudinary_url" text,
	"cloudinary_public_id" text,
	"original_url" text,
	"openai_file_ref" text,
	"mime_type" text,
	"media_type" "social_media_type_enum" NOT NULL,
	"width" integer,
	"height" integer,
	"duration_seconds" integer,
	"alt_text" text,
	"caption" text,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "social_audiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	CONSTRAINT "social_audiences_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "social_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"old_value_json" jsonb,
	"new_value_json" jsonb,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	CONSTRAINT "social_campaigns_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "social_content_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	CONSTRAINT "social_content_batches_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "social_hashtag_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"platform" "social_platform_enum",
	"hashtags_text" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	CONSTRAINT "social_hashtag_sets_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "social_hashtags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hashtag" text NOT NULL,
	"normalized_hashtag" text NOT NULL,
	"category" text NOT NULL,
	"platform" "social_platform_enum",
	"audience_id" uuid,
	"priority" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	CONSTRAINT "social_hashtags_normalized_hashtag_unique" UNIQUE("normalized_hashtag")
);
--> statement-breakpoint
CREATE TABLE "social_platform_formats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" "social_platform_enum" NOT NULL,
	"publish_format" "social_publish_format_enum" NOT NULL,
	"media_type" "social_media_type_enum" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"mvp_enabled" boolean DEFAULT false NOT NULL,
	"recommended_ratio" text,
	"recommended_size" text,
	"max_caption_length" integer,
	"requires_public_url" boolean DEFAULT false NOT NULL,
	"requires_media" boolean DEFAULT false NOT NULL,
	"make_channel_key" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "social_platforms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" "social_platform_enum" NOT NULL,
	"label" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "social_post_footers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"content" text NOT NULL,
	"platform" "social_platform_enum",
	"active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	CONSTRAINT "social_post_footers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "social_post_hashtags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_post_id" uuid NOT NULL,
	"hashtag_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_post_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_post_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_post_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_post_id" uuid NOT NULL,
	"platform_format_id" uuid NOT NULL,
	"platform" "social_platform_enum" NOT NULL,
	"publish_format" "social_publish_format_enum" NOT NULL,
	"media_type" "social_media_type_enum" NOT NULL,
	"caption_override" text,
	"hashtags_override_text" text,
	"footer_override" text,
	"status" "social_post_status_enum" DEFAULT 'NEEDS_REVIEW' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"external_post_id" text,
	"external_post_url" text,
	"make_scenario_key" text,
	"make_last_run_id" text,
	"make_payload_json" jsonb,
	"last_error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"source" "social_source_enum" NOT NULL,
	"pillar" text,
	"campaign_id" uuid,
	"batch_id" uuid,
	"batch_position" integer,
	"audience_id" uuid,
	"footer_id" uuid,
	"base_hashtag_set_id" uuid,
	"caption_base" text NOT NULL,
	"final_caption" text,
	"final_hashtags_text" text,
	"status" "social_post_status_enum" DEFAULT 'NEEDS_REVIEW' NOT NULL,
	"approval_status" "social_approval_status_enum" DEFAULT 'PENDING' NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"scheduled_at" timestamp with time zone,
	"timezone" text DEFAULT 'America/Argentina/Buenos_Aires' NOT NULL,
	"recurrence_type" "social_recurrence_type_enum" DEFAULT 'ONCE' NOT NULL,
	"recurrence_params_json" jsonb,
	"next_run_at" timestamp with time zone,
	"notes" text,
	"internal_notes" text,
	"gpt_hashtag_payload_json" jsonb,
	"metadata_json" jsonb,
	"approved_by_id" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	CONSTRAINT "social_posts_draft_id_unique" UNIQUE("draft_id"),
	CONSTRAINT "social_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "social_publish_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_post_id" uuid NOT NULL,
	"social_post_target_id" uuid,
	"platform" "social_platform_enum",
	"publish_format" "social_publish_format_enum",
	"status" "social_publish_result_status_enum" NOT NULL,
	"message" text,
	"request_payload_json" jsonb,
	"response_payload_json" jsonb,
	"external_post_id" text,
	"external_post_url" text,
	"make_run_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"type" text DEFAULT 'string' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "social_ai_requests" ADD CONSTRAINT "social_ai_requests_audience_id_social_audiences_id_fk" FOREIGN KEY ("audience_id") REFERENCES "public"."social_audiences"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_assets" ADD CONSTRAINT "social_assets_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_assets" ADD CONSTRAINT "social_assets_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_assets" ADD CONSTRAINT "social_assets_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_audiences" ADD CONSTRAINT "social_audiences_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_audiences" ADD CONSTRAINT "social_audiences_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_audiences" ADD CONSTRAINT "social_audiences_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_campaigns" ADD CONSTRAINT "social_campaigns_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_campaigns" ADD CONSTRAINT "social_campaigns_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_campaigns" ADD CONSTRAINT "social_campaigns_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_content_batches" ADD CONSTRAINT "social_content_batches_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_content_batches" ADD CONSTRAINT "social_content_batches_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_content_batches" ADD CONSTRAINT "social_content_batches_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_hashtag_sets" ADD CONSTRAINT "social_hashtag_sets_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_hashtag_sets" ADD CONSTRAINT "social_hashtag_sets_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_hashtag_sets" ADD CONSTRAINT "social_hashtag_sets_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_hashtags" ADD CONSTRAINT "social_hashtags_audience_id_social_audiences_id_fk" FOREIGN KEY ("audience_id") REFERENCES "public"."social_audiences"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_hashtags" ADD CONSTRAINT "social_hashtags_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_hashtags" ADD CONSTRAINT "social_hashtags_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_hashtags" ADD CONSTRAINT "social_hashtags_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_platform_formats" ADD CONSTRAINT "social_platform_formats_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_platform_formats" ADD CONSTRAINT "social_platform_formats_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_platform_formats" ADD CONSTRAINT "social_platform_formats_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_platforms" ADD CONSTRAINT "social_platforms_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_platforms" ADD CONSTRAINT "social_platforms_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_platforms" ADD CONSTRAINT "social_platforms_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_post_footers" ADD CONSTRAINT "social_post_footers_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_post_footers" ADD CONSTRAINT "social_post_footers_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_post_footers" ADD CONSTRAINT "social_post_footers_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_post_hashtags" ADD CONSTRAINT "social_post_hashtags_social_post_id_social_posts_id_fk" FOREIGN KEY ("social_post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_post_hashtags" ADD CONSTRAINT "social_post_hashtags_hashtag_id_social_hashtags_id_fk" FOREIGN KEY ("hashtag_id") REFERENCES "public"."social_hashtags"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_post_media" ADD CONSTRAINT "social_post_media_social_post_id_social_posts_id_fk" FOREIGN KEY ("social_post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_post_media" ADD CONSTRAINT "social_post_media_asset_id_social_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."social_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_post_targets" ADD CONSTRAINT "social_post_targets_social_post_id_social_posts_id_fk" FOREIGN KEY ("social_post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_post_targets" ADD CONSTRAINT "social_post_targets_platform_format_id_social_platform_formats_id_fk" FOREIGN KEY ("platform_format_id") REFERENCES "public"."social_platform_formats"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_campaign_id_social_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."social_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_batch_id_social_content_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."social_content_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_audience_id_social_audiences_id_fk" FOREIGN KEY ("audience_id") REFERENCES "public"."social_audiences"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_footer_id_social_post_footers_id_fk" FOREIGN KEY ("footer_id") REFERENCES "public"."social_post_footers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_base_hashtag_set_id_social_hashtag_sets_id_fk" FOREIGN KEY ("base_hashtag_set_id") REFERENCES "public"."social_hashtag_sets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_publish_logs" ADD CONSTRAINT "social_publish_logs_social_post_id_social_posts_id_fk" FOREIGN KEY ("social_post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_publish_logs" ADD CONSTRAINT "social_publish_logs_social_post_target_id_social_post_targets_id_fk" FOREIGN KEY ("social_post_target_id") REFERENCES "public"."social_post_targets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "socialAiRequests_requestId_idx" ON "social_ai_requests" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "socialAiRequests_source_idx" ON "social_ai_requests" USING btree ("source");--> statement-breakpoint
CREATE INDEX "socialAiRequests_audienceId_idx" ON "social_ai_requests" USING btree ("audience_id");--> statement-breakpoint
CREATE INDEX "socialAiRequests_createdAt_idx" ON "social_ai_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "socialAssets_source_idx" ON "social_assets" USING btree ("source");--> statement-breakpoint
CREATE INDEX "socialAssets_mediaType_idx" ON "social_assets" USING btree ("media_type");--> statement-breakpoint
CREATE INDEX "socialAssets_cloudinaryPublicId_idx" ON "social_assets" USING btree ("cloudinary_public_id");--> statement-breakpoint
CREATE INDEX "socialAssets_deletedAt_idx" ON "social_assets" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "socialAudiences_slug_idx" ON "social_audiences" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "socialAudiences_active_idx" ON "social_audiences" USING btree ("active");--> statement-breakpoint
CREATE INDEX "socialAudiences_deletedAt_idx" ON "social_audiences" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "socialAuditLog_entityType_entityId_idx" ON "social_audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "socialAuditLog_actorId_idx" ON "social_audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "socialAuditLog_eventType_idx" ON "social_audit_log" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "socialAuditLog_createdAt_idx" ON "social_audit_log" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "socialCampaigns_slug_idx" ON "social_campaigns" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "socialCampaigns_active_idx" ON "social_campaigns" USING btree ("active");--> statement-breakpoint
CREATE INDEX "socialCampaigns_deletedAt_idx" ON "social_campaigns" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "socialContentBatches_slug_idx" ON "social_content_batches" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "socialContentBatches_active_idx" ON "social_content_batches" USING btree ("active");--> statement-breakpoint
CREATE INDEX "socialContentBatches_deletedAt_idx" ON "social_content_batches" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "socialHashtagSets_slug_idx" ON "social_hashtag_sets" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "socialHashtagSets_platform_idx" ON "social_hashtag_sets" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "socialHashtagSets_active_idx" ON "social_hashtag_sets" USING btree ("active");--> statement-breakpoint
CREATE INDEX "socialHashtagSets_deletedAt_idx" ON "social_hashtag_sets" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "socialHashtags_normalizedHashtag_idx" ON "social_hashtags" USING btree ("normalized_hashtag");--> statement-breakpoint
CREATE INDEX "socialHashtags_platform_idx" ON "social_hashtags" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "socialHashtags_audienceId_idx" ON "social_hashtags" USING btree ("audience_id");--> statement-breakpoint
CREATE INDEX "socialHashtags_active_idx" ON "social_hashtags" USING btree ("active");--> statement-breakpoint
CREATE INDEX "socialHashtags_deletedAt_idx" ON "social_hashtags" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "socialPlatformFormats_platform_publishFormat_idx" ON "social_platform_formats" USING btree ("platform","publish_format");--> statement-breakpoint
CREATE INDEX "socialPlatformFormats_enabled_idx" ON "social_platform_formats" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "socialPlatformFormats_mvpEnabled_idx" ON "social_platform_formats" USING btree ("mvp_enabled");--> statement-breakpoint
CREATE INDEX "socialPlatformFormats_deletedAt_idx" ON "social_platform_formats" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "socialPlatforms_platform_idx" ON "social_platforms" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "socialPlatforms_enabled_idx" ON "social_platforms" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "socialPlatforms_deletedAt_idx" ON "social_platforms" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "socialPostFooters_slug_idx" ON "social_post_footers" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "socialPostFooters_platform_idx" ON "social_post_footers" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "socialPostFooters_active_idx" ON "social_post_footers" USING btree ("active");--> statement-breakpoint
CREATE INDEX "socialPostFooters_deletedAt_idx" ON "social_post_footers" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "socialPostHashtags_postId_hashtagId_idx" ON "social_post_hashtags" USING btree ("social_post_id","hashtag_id");--> statement-breakpoint
CREATE INDEX "socialPostHashtags_postId_idx" ON "social_post_hashtags" USING btree ("social_post_id");--> statement-breakpoint
CREATE INDEX "socialPostHashtags_hashtagId_idx" ON "social_post_hashtags" USING btree ("hashtag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "socialPostMedia_postId_position_idx" ON "social_post_media" USING btree ("social_post_id","position");--> statement-breakpoint
CREATE INDEX "socialPostMedia_postId_idx" ON "social_post_media" USING btree ("social_post_id");--> statement-breakpoint
CREATE INDEX "socialPostMedia_assetId_idx" ON "social_post_media" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "socialPostTargets_socialPostId_idx" ON "social_post_targets" USING btree ("social_post_id");--> statement-breakpoint
CREATE INDEX "socialPostTargets_platformFormatId_idx" ON "social_post_targets" USING btree ("platform_format_id");--> statement-breakpoint
CREATE INDEX "socialPostTargets_status_idx" ON "social_post_targets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "socialPostTargets_platform_idx" ON "social_post_targets" USING btree ("platform");--> statement-breakpoint
CREATE UNIQUE INDEX "socialPosts_draftId_idx" ON "social_posts" USING btree ("draft_id");--> statement-breakpoint
CREATE UNIQUE INDEX "socialPosts_slug_idx" ON "social_posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "socialPosts_status_idx" ON "social_posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "socialPosts_approvalStatus_idx" ON "social_posts" USING btree ("approval_status");--> statement-breakpoint
CREATE INDEX "socialPosts_campaignId_idx" ON "social_posts" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "socialPosts_batchId_idx" ON "social_posts" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "socialPosts_audienceId_idx" ON "social_posts" USING btree ("audience_id");--> statement-breakpoint
CREATE INDEX "socialPosts_nextRunAt_idx" ON "social_posts" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "socialPosts_deletedAt_idx" ON "social_posts" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "socialPublishLogs_postId_createdAt_idx" ON "social_publish_logs" USING btree ("social_post_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "socialPublishLogs_targetId_idx" ON "social_publish_logs" USING btree ("social_post_target_id");--> statement-breakpoint
CREATE INDEX "socialPublishLogs_status_idx" ON "social_publish_logs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "socialSettings_key_idx" ON "social_settings" USING btree ("key");--> statement-breakpoint
CREATE INDEX "socialSettings_active_idx" ON "social_settings" USING btree ("active");