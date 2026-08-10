CREATE TYPE "public"."partner_mention_channel_enum" AS ENUM('INSTAGRAM', 'FACEBOOK', 'TWITTER', 'YOUTUBE', 'TIKTOK', 'NEWSLETTER', 'WHATSAPP', 'OTHER');--> statement-breakpoint
CREATE TABLE "partner_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"channel" "partner_mention_channel_enum" NOT NULL,
	"batch_id" uuid,
	"mentioned_at" timestamp with time zone NOT NULL,
	"url" text,
	"internal_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_by_id" uuid
);
--> statement-breakpoint
ALTER TABLE "partner_mentions" ADD CONSTRAINT "partner_mentions_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_mentions" ADD CONSTRAINT "partner_mentions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_mentions" ADD CONSTRAINT "partner_mentions_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_mentions" ADD CONSTRAINT "partner_mentions_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partnerMentions_partnerId_mentionedAt_idx" ON "partner_mentions" USING btree ("partner_id","mentioned_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "partnerMentions_batchId_idx" ON "partner_mentions" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "partnerMentions_partnerId_deletedAt_idx" ON "partner_mentions" USING btree ("partner_id","deleted_at");