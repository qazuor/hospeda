CREATE TABLE "social_post_target_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_post_target_id" uuid NOT NULL,
	"social_post_media_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "social_post_target_media" ADD CONSTRAINT "social_post_target_media_social_post_target_id_social_post_targets_id_fk" FOREIGN KEY ("social_post_target_id") REFERENCES "public"."social_post_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_post_target_media" ADD CONSTRAINT "social_post_target_media_social_post_media_id_social_post_media_id_fk" FOREIGN KEY ("social_post_media_id") REFERENCES "public"."social_post_media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "socialPostTargetMedia_targetId_mediaId_idx" ON "social_post_target_media" USING btree ("social_post_target_id","social_post_media_id");--> statement-breakpoint
CREATE INDEX "socialPostTargetMedia_targetId_idx" ON "social_post_target_media" USING btree ("social_post_target_id");--> statement-breakpoint
CREATE INDEX "socialPostTargetMedia_mediaId_idx" ON "social_post_target_media" USING btree ("social_post_media_id");