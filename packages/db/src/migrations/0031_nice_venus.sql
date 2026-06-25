CREATE TYPE "public"."partner_subscription_status_enum" AS ENUM('pending', 'active', 'past_due', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."partner_tier_enum" AS ENUM('bronze', 'silver', 'gold');--> statement-breakpoint
CREATE TYPE "public"."partner_type_enum" AS ENUM('commerce', 'ngo', 'institution');--> statement-breakpoint
ALTER TYPE "public"."permission_category_enum" ADD VALUE 'PARTNER' BEFORE 'SOCIAL_POST';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'partner.create' BEFORE 'hostTrade.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'partner.update' BEFORE 'hostTrade.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'partner.delete' BEFORE 'hostTrade.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'partner.viewAll' BEFORE 'hostTrade.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'partner.manage' BEFORE 'hostTrade.view';--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "partner_type_enum" NOT NULL,
	"tier" "partner_tier_enum" NOT NULL,
	"logo_url" text,
	"website_url" text,
	"description" text,
	"subscription_status" "partner_subscription_status_enum" DEFAULT 'pending' NOT NULL,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"analytics" jsonb DEFAULT '{}'::jsonb,
	"plan_id" uuid,
	"subscription_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_by_id" uuid,
	CONSTRAINT "partners_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "partner_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"product_domain" varchar(50) DEFAULT 'partner' NOT NULL,
	"partner_id" uuid NOT NULL,
	"status" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_plan_id_billing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_subscriptions" ADD CONSTRAINT "partner_subscriptions_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partners_slug_idx" ON "partners" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "partners_type_idx" ON "partners" USING btree ("type");--> statement-breakpoint
CREATE INDEX "partners_tier_idx" ON "partners" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "partners_subscriptionStatus_idx" ON "partners" USING btree ("subscription_status");--> statement-breakpoint
CREATE INDEX "partners_lifecycleState_idx" ON "partners" USING btree ("lifecycle_state");--> statement-breakpoint
CREATE INDEX "partners_startsAt_idx" ON "partners" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "partners_deletedAt_idx" ON "partners" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "partners_subscriptionStatus_lifecycleState_idx" ON "partners" USING btree ("subscription_status","lifecycle_state");--> statement-breakpoint
CREATE INDEX "partners_lifecycleState_endsAt_idx" ON "partners" USING btree ("lifecycle_state","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_subs_partner_uniq" ON "partner_subscriptions" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "partner_subs_partnerId_idx" ON "partner_subscriptions" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "partner_subs_status_idx" ON "partner_subscriptions" USING btree ("status");
