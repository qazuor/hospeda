CREATE TYPE "public"."event_media_state_enum" AS ENUM('visible', 'archived');--> statement-breakpoint
CREATE TYPE "public"."post_media_state_enum" AS ENUM('visible', 'archived');--> statement-breakpoint
CREATE TABLE "event_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"url" text NOT NULL,
	"caption" text,
	"description" text,
	"alt" text,
	"public_id" text,
	"attribution" jsonb,
	"moderation_state" "moderation_status_enum" DEFAULT 'PENDING' NOT NULL,
	"state" "event_media_state_enum" DEFAULT 'visible' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "post_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"url" text NOT NULL,
	"caption" text,
	"description" text,
	"alt" text,
	"public_id" text,
	"attribution" jsonb,
	"moderation_state" "moderation_status_enum" DEFAULT 'PENDING' NOT NULL,
	"state" "post_media_state_enum" DEFAULT 'visible' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "event_media" ADD CONSTRAINT "event_media_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "eventMedia_eventId_idx" ON "event_media" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "eventMedia_state_idx" ON "event_media" USING btree ("state");--> statement-breakpoint
CREATE INDEX "eventMedia_isFeatured_idx" ON "event_media" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "eventMedia_eventId_state_sortOrder_idx" ON "event_media" USING btree ("event_id","state","sort_order");--> statement-breakpoint
CREATE INDEX "eventMedia_deletedAt_idx" ON "event_media" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "postMedia_postId_idx" ON "post_media" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "postMedia_state_idx" ON "post_media" USING btree ("state");--> statement-breakpoint
CREATE INDEX "postMedia_isFeatured_idx" ON "post_media" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "postMedia_postId_state_sortOrder_idx" ON "post_media" USING btree ("post_id","state","sort_order");--> statement-breakpoint
CREATE INDEX "postMedia_deletedAt_idx" ON "post_media" USING btree ("deleted_at");