ALTER TYPE "public"."permission_category_enum" ADD VALUE 'MODERATION';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'moderation.term.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'moderation.term.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'moderation.term.update';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'moderation.term.delete';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'moderation.term.restore';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'moderation.term.hardDelete';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'moderation.threshold.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'moderation.threshold.update';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'moderation.threshold.restore';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'moderation.threshold.hardDelete';--> statement-breakpoint
CREATE TABLE "content_moderation_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term" varchar(255) NOT NULL,
	"kind" varchar(16) NOT NULL,
	"category" varchar(32) NOT NULL,
	"severity" numeric(4, 3) DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	CONSTRAINT "ck_content_moderation_terms_kind" CHECK ("content_moderation_terms"."kind" IN ('word', 'domain')),
	CONSTRAINT "ck_content_moderation_terms_severity_range" CHECK ("content_moderation_terms"."severity" >= 0 AND "content_moderation_terms"."severity" <= 1)
);
--> statement-breakpoint
CREATE TABLE "content_moderation_thresholds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"context" text NOT NULL,
	"pending" numeric(4, 3) DEFAULT 0.5 NOT NULL,
	"reject" numeric(4, 3) DEFAULT 0.85 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by_id" uuid,
	"updated_by_id" uuid
);
--> statement-breakpoint
ALTER TABLE "content_moderation_terms" ADD CONSTRAINT "content_moderation_terms_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_moderation_terms" ADD CONSTRAINT "content_moderation_terms_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_moderation_thresholds" ADD CONSTRAINT "content_moderation_thresholds_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_moderation_thresholds" ADD CONSTRAINT "content_moderation_thresholds_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_content_moderation_terms_kind_term" ON "content_moderation_terms" USING btree ("kind","term") WHERE "content_moderation_terms"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_content_moderation_terms_enabled" ON "content_moderation_terms" USING btree ("enabled") WHERE "content_moderation_terms"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_content_moderation_terms_created_by" ON "content_moderation_terms" USING btree ("created_by_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_content_moderation_thresholds_context" ON "content_moderation_thresholds" USING btree ("context") WHERE "content_moderation_thresholds"."deleted_at" IS NULL;