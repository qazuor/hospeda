CREATE TYPE "public"."partner_application_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
ALTER TYPE "public"."role_enum" ADD VALUE 'PARTNER_OWNER' BEFORE 'SPONSOR';--> statement-breakpoint
CREATE TABLE "partner_application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"status" "partner_application_status_enum" DEFAULT 'PENDING' NOT NULL,
	"resolved_at" timestamp with time zone,
	"partner_id" uuid,
	"wait_cancelled_at" timestamp with time zone,
	"wait_cancelled_by" uuid,
	"deadlines_version" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_partner_application_partner_iff_approved" CHECK (("partner_application"."status" = 'APPROVED') = ("partner_application"."partner_id" IS NOT NULL)),
	CONSTRAINT "ck_partner_application_wait_cancel_pair" CHECK ("partner_application"."wait_cancelled_by" IS NULL OR "partner_application"."wait_cancelled_at" IS NOT NULL)
);
--> statement-breakpoint
DROP INDEX "partners_tier_idx";--> statement-breakpoint
DROP INDEX "partners_startsAt_idx";--> statement-breakpoint
DROP INDEX "partners_lifecycleState_endsAt_idx";--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "presence_moderated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "claim_secret_hash" text;--> statement-breakpoint
ALTER TABLE "partner_application" ADD CONSTRAINT "partner_application_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_application" ADD CONSTRAINT "partner_application_wait_cancelled_by_users_id_fk" FOREIGN KEY ("wait_cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_partner_application_pending_email" ON "partner_application" USING btree (lower("email")) WHERE "partner_application"."status" = 'PENDING';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_partners_owner_user_id" ON "partners" USING btree ("owner_user_id") WHERE "partners"."owner_user_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "partners" DROP COLUMN "tier";--> statement-breakpoint
ALTER TABLE "partners" DROP COLUMN "starts_at";--> statement-breakpoint
ALTER TABLE "partners" DROP COLUMN "ends_at";--> statement-breakpoint
DROP TYPE "public"."partner_tier_enum";