DO $$ BEGIN
 CREATE TYPE "billing_interval_enum" AS ENUM('monthly', 'quarterly', 'semi_annual', 'annual', 'one_time');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "invoice_status_enum" AS ENUM('draft', 'issued', 'sent', 'paid', 'partial_paid', 'overdue', 'cancelled', 'voided');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "owner_promotion_discount_type_enum" AS ENUM('percentage', 'fixed', 'free_night');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "payment_status_enum" AS ENUM('pending', 'authorized', 'captured', 'declined', 'failed', 'cancelled', 'refunded', 'partially_refunded');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "refund_status_enum" AS ENUM('pending', 'approved', 'processing', 'completed', 'failed', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "sponsorship_status_enum" AS ENUM('pending', 'active', 'expired', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "sponsorship_target_type_enum" AS ENUM('event', 'post');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "sponsorship_tier_enum" AS ENUM('bronze', 'silver', 'gold', 'standard', 'premium');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "subscription_status_enum" AS ENUM('active', 'trialing', 'past_due', 'paused', 'cancelled', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "permission_category_enum" ADD VALUE 'SPONSORSHIP';--> statement-breakpoint
ALTER TYPE "permission_category_enum" ADD VALUE 'OWNER_PROMOTION';--> statement-breakpoint
ALTER TYPE "permission_category_enum" ADD VALUE 'FEATURED_ACCOMMODATION';--> statement-breakpoint
ALTER TYPE "permission_enum" ADD VALUE 'ownerPromotion.create';--> statement-breakpoint
ALTER TYPE "permission_enum" ADD VALUE 'ownerPromotion.update';--> statement-breakpoint
ALTER TYPE "permission_enum" ADD VALUE 'ownerPromotion.delete';--> statement-breakpoint
ALTER TYPE "permission_enum" ADD VALUE 'ownerPromotion.view';--> statement-breakpoint
ALTER TYPE "permission_enum" ADD VALUE 'ownerPromotion.restore';--> statement-breakpoint
ALTER TYPE "permission_enum" ADD VALUE 'ownerPromotion.hardDelete';--> statement-breakpoint
ALTER TYPE "permission_enum" ADD VALUE 'ownerPromotion.status.manage';--> statement-breakpoint
ALTER TYPE "role_enum" ADD VALUE 'SPONSOR';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "owner_promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"accommodation_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"discount_type" "owner_promotion_discount_type_enum" NOT NULL,
	"discount_value" numeric NOT NULL,
	"min_nights" integer,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone,
	"max_redemptions" integer,
	"current_redemptions" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_by_id" uuid,
	CONSTRAINT "owner_promotions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sponsorships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"sponsor_user_id" uuid NOT NULL,
	"target_type" "sponsorship_target_type_enum" NOT NULL,
	"target_id" uuid NOT NULL,
	"level_id" uuid NOT NULL,
	"package_id" uuid,
	"status" "sponsorship_status_enum" DEFAULT 'pending' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"payment_id" text,
	"logo_url" text,
	"link_url" text,
	"coupon_code" text,
	"coupon_discount_percent" integer,
	"analytics" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_by_id" uuid,
	CONSTRAINT "sponsorships_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sponsorship_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"target_type" "sponsorship_target_type_enum" NOT NULL,
	"tier" "sponsorship_tier_enum" NOT NULL,
	"price_amount" integer NOT NULL,
	"price_currency" "price_currency_enum" DEFAULT 'ARS' NOT NULL,
	"benefits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_by_id" uuid,
	CONSTRAINT "sponsorship_levels_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sponsorship_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_amount" integer NOT NULL,
	"price_currency" "price_currency_enum" DEFAULT 'ARS' NOT NULL,
	"included_posts" integer NOT NULL,
	"included_events" integer NOT NULL,
	"event_level_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_by_id" uuid,
	CONSTRAINT "sponsorship_packages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_addons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"unit_amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"billing_interval" varchar(50) NOT NULL,
	"billing_interval_count" integer DEFAULT 1 NOT NULL,
	"compatible_plan_ids" text[] DEFAULT '{}' NOT NULL,
	"allow_multiple" boolean DEFAULT false NOT NULL,
	"max_quantity" integer,
	"entitlements" text[] DEFAULT '{}' NOT NULL,
	"limits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"livemode" boolean DEFAULT true NOT NULL,
	"version" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"actor_type" varchar(50) NOT NULL,
	"actor_id" varchar(255),
	"changes" jsonb,
	"previous_values" jsonb,
	"ip_address" "inet",
	"user_agent" text,
	"livemode" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_customer_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"entitlement_key" varchar(100) NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"source" varchar(50) NOT NULL,
	"source_id" uuid,
	"livemode" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_customer_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"limit_key" varchar(100) NOT NULL,
	"max_value" integer NOT NULL,
	"current_value" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone,
	"source" varchar(50) NOT NULL,
	"source_id" uuid,
	"livemode" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"phone" varchar(20),
	"stripe_customer_id" varchar(255),
	"mp_customer_id" varchar(255),
	"preferred_language" varchar(10) DEFAULT 'en',
	"segment" varchar(50),
	"tier" varchar(20),
	"billing_address" jsonb,
	"shipping_address" jsonb,
	"tax_id" varchar(50),
	"tax_id_type" varchar(20),
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"version" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_entitlements_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(255) NOT NULL,
	"operation" varchar(100) NOT NULL,
	"request_params" jsonb,
	"response_body" jsonb,
	"status_code" varchar(10),
	"livemode" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_idempotency_keys_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" varchar(500) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_amount" integer NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"price_id" varchar(255),
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"proration" boolean DEFAULT false,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_invoice_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount_applied" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"livemode" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"subscription_id" uuid,
	"number" varchar(50) NOT NULL,
	"status" varchar(50) NOT NULL,
	"subtotal" integer NOT NULL,
	"discount" integer DEFAULT 0,
	"tax" integer DEFAULT 0,
	"total" integer NOT NULL,
	"amount_paid" integer DEFAULT 0,
	"amount_remaining" integer,
	"currency" varchar(3) NOT NULL,
	"due_date" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"stripe_invoice_id" varchar(255),
	"mp_invoice_id" varchar(255),
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"version" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(1000),
	"default_value" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_payment_method_id" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"last_four" varchar(4),
	"brand" varchar(50),
	"exp_month" integer,
	"exp_year" integer,
	"is_default" boolean DEFAULT false,
	"billing_details" jsonb,
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"subscription_id" uuid,
	"invoice_id" uuid,
	"amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"base_amount" integer,
	"base_currency" varchar(3),
	"exchange_rate" numeric(18, 8),
	"status" varchar(50) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_payment_ids" jsonb DEFAULT '{}'::jsonb,
	"payment_method_id" uuid,
	"refunded_amount" integer DEFAULT 0,
	"failure_code" varchar(100),
	"failure_message" text,
	"idempotency_key" varchar(255),
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"version" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"entitlements" text[] DEFAULT '{}' NOT NULL,
	"limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"livemode" boolean DEFAULT true NOT NULL,
	"version" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"nickname" varchar(255),
	"currency" varchar(3) NOT NULL,
	"unit_amount" integer NOT NULL,
	"billing_interval" varchar(50) NOT NULL,
	"interval_count" integer DEFAULT 1 NOT NULL,
	"trial_days" integer,
	"active" boolean DEFAULT true NOT NULL,
	"stripe_price_id" varchar(255),
	"mp_price_id" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"livemode" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_promo_code_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promo_code_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"subscription_id" uuid,
	"discount_amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"livemode" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_promo_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"type" varchar(50) NOT NULL,
	"value" integer NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"max_uses" integer,
	"used_count" integer DEFAULT 0,
	"max_per_customer" integer DEFAULT 1,
	"valid_plans" text[],
	"new_customers_only" boolean DEFAULT false,
	"existing_customers_only" boolean DEFAULT false,
	"starts_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"combinable" boolean DEFAULT false,
	"active" boolean DEFAULT true,
	"livemode" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_promo_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" varchar(50) NOT NULL,
	"reason" varchar(100),
	"provider_refund_id" varchar(255),
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_subscription_addons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"addon_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"canceled_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"plan_id" varchar(255) NOT NULL,
	"status" varchar(50) NOT NULL,
	"billing_interval" varchar(50) NOT NULL,
	"interval_count" integer DEFAULT 1,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"trial_start" timestamp with time zone,
	"trial_end" timestamp with time zone,
	"trial_converted" boolean DEFAULT false,
	"trial_converted_at" timestamp with time zone,
	"cancel_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false,
	"ended_at" timestamp with time zone,
	"promo_code_id" uuid,
	"default_payment_method_id" uuid,
	"grace_period_ends_at" timestamp with time zone,
	"retry_count" integer DEFAULT 0,
	"next_retry_at" timestamp with time zone,
	"stripe_subscription_id" varchar(255),
	"mp_subscription_id" varchar(255),
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"version" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"metric_name" varchar(100) NOT NULL,
	"quantity" integer NOT NULL,
	"action" varchar(20) DEFAULT 'increment' NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"idempotency_key" varchar(255),
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_vendor_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" varchar(50) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_payout_id" varchar(255),
	"failure_code" varchar(100),
	"failure_message" varchar(500),
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"commission_rate" numeric(5, 2) NOT NULL,
	"payout_schedule" jsonb,
	"payment_mode" varchar(50) DEFAULT 'automatic',
	"stripe_account_id" varchar(255),
	"mp_merchant_id" varchar(255),
	"onboarding_status" varchar(50) DEFAULT 'pending',
	"can_receive_payments" boolean DEFAULT false,
	"pending_balance" integer DEFAULT 0,
	"livemode" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"version" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "billing_vendors_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_webhook_dead_letter" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_event_id" varchar(255) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"error" text NOT NULL,
	"attempts" integer NOT NULL,
	"resolved_at" timestamp with time zone,
	"livemode" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_event_id" varchar(255) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"type" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"attempts" integer DEFAULT 0,
	"livemode" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_locations" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ownerPromotions_ownerId_idx" ON "owner_promotions" ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ownerPromotions_accommodationId_idx" ON "owner_promotions" ("accommodation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ownerPromotions_isActive_idx" ON "owner_promotions" ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ownerPromotions_validFrom_idx" ON "owner_promotions" ("valid_from");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ownerPromotions_deletedAt_idx" ON "owner_promotions" ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ownerPromotions_ownerId_isActive_idx" ON "owner_promotions" ("owner_id","is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsorships_sponsorUserId_idx" ON "sponsorships" ("sponsor_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsorships_targetType_idx" ON "sponsorships" ("target_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsorships_targetId_idx" ON "sponsorships" ("target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsorships_status_idx" ON "sponsorships" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsorships_startsAt_idx" ON "sponsorships" ("starts_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsorships_deletedAt_idx" ON "sponsorships" ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsorships_targetType_targetId_idx" ON "sponsorships" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsorshipLevels_targetType_idx" ON "sponsorship_levels" ("target_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsorshipLevels_tier_idx" ON "sponsorship_levels" ("tier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsorshipLevels_isActive_idx" ON "sponsorship_levels" ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsorshipLevels_deletedAt_idx" ON "sponsorship_levels" ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsorshipPackages_isActive_idx" ON "sponsorship_packages" ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsorshipPackages_deletedAt_idx" ON "sponsorship_packages" ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_addons_active" ON "billing_addons" ("active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_addons_livemode" ON "billing_addons" ("livemode");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_addons_billing_interval" ON "billing_addons" ("billing_interval");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_entity" ON "billing_audit_logs" ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_action" ON "billing_audit_logs" ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_actor" ON "billing_audit_logs" ("actor_type","actor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_created" ON "billing_audit_logs" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customer_entitlements_customer_id" ON "billing_customer_entitlements" ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customer_entitlements_key" ON "billing_customer_entitlements" ("entitlement_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customer_entitlements_customer_key" ON "billing_customer_entitlements" ("customer_id","entitlement_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customer_entitlements_expires_at" ON "billing_customer_entitlements" ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customer_limits_customer_id" ON "billing_customer_limits" ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customer_limits_key" ON "billing_customer_limits" ("limit_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customer_limits_customer_key" ON "billing_customer_limits" ("customer_id","limit_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customer_limits_reset_at" ON "billing_customer_limits" ("reset_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customers_external_id" ON "billing_customers" ("external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customers_email" ON "billing_customers" ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customers_stripe_id" ON "billing_customers" ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customers_mp_id" ON "billing_customers" ("mp_customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_entitlements_key" ON "billing_entitlements" ("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_idempotency_key" ON "billing_idempotency_keys" ("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_idempotency_expires" ON "billing_idempotency_keys" ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoice_lines_invoice" ON "billing_invoice_lines" ("invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoice_payments_invoice" ON "billing_invoice_payments" ("invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoice_payments_payment" ON "billing_invoice_payments" ("payment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoices_customer" ON "billing_invoices" ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoices_subscription" ON "billing_invoices" ("subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoices_status" ON "billing_invoices" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoices_number" ON "billing_invoices" ("number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoices_due_date" ON "billing_invoices" ("due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_limits_key" ON "billing_limits" ("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payment_methods_customer" ON "billing_payment_methods" ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payment_methods_provider_id" ON "billing_payment_methods" ("provider_payment_method_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payments_customer" ON "billing_payments" ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payments_subscription" ON "billing_payments" ("subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payments_status" ON "billing_payments" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payments_idempotency" ON "billing_payments" ("idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_plans_active" ON "billing_plans" ("active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_plans_livemode" ON "billing_plans" ("livemode");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_prices_plan_id" ON "billing_prices" ("plan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_prices_active" ON "billing_prices" ("active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_prices_stripe_price_id" ON "billing_prices" ("stripe_price_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_prices_mp_price_id" ON "billing_prices" ("mp_price_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_prices_currency_interval" ON "billing_prices" ("currency","billing_interval");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_promo_usage_code" ON "billing_promo_code_usage" ("promo_code_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_promo_usage_customer" ON "billing_promo_code_usage" ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_promo_codes_code" ON "billing_promo_codes" ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_promo_codes_active" ON "billing_promo_codes" ("active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_refunds_payment" ON "billing_refunds" ("payment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_refunds_provider_id" ON "billing_refunds" ("provider_refund_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscription_addons_subscription" ON "billing_subscription_addons" ("subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscription_addons_addon" ON "billing_subscription_addons" ("addon_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscription_addons_status" ON "billing_subscription_addons" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscription_addons_composite" ON "billing_subscription_addons" ("subscription_id","addon_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_customer" ON "billing_subscriptions" ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_status" ON "billing_subscriptions" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_customer_status" ON "billing_subscriptions" ("customer_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_stripe_id" ON "billing_subscriptions" ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_mp_id" ON "billing_subscriptions" ("mp_subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_renewal" ON "billing_subscriptions" ("current_period_end");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_lifecycle_renewal" ON "billing_subscriptions" ("status","livemode","current_period_end","cancel_at_period_end");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_lifecycle_retry" ON "billing_subscriptions" ("status","next_retry_at","grace_period_ends_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_lifecycle_grace" ON "billing_subscriptions" ("status","grace_period_ends_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_lifecycle_trial" ON "billing_subscriptions" ("status","trial_end");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_lifecycle_cancel" ON "billing_subscriptions" ("cancel_at_period_end","status","current_period_end");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_usage_records_subscription" ON "billing_usage_records" ("subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_usage_records_metric" ON "billing_usage_records" ("metric_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_usage_records_timestamp" ON "billing_usage_records" ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_usage_records_idempotency" ON "billing_usage_records" ("idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendor_payouts_vendor" ON "billing_vendor_payouts" ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendor_payouts_status" ON "billing_vendor_payouts" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendor_payouts_provider_id" ON "billing_vendor_payouts" ("provider_payout_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendors_external_id" ON "billing_vendors" ("external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendors_stripe_account" ON "billing_vendors" ("stripe_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendors_mp_merchant" ON "billing_vendors" ("mp_merchant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dead_letter_provider_id" ON "billing_webhook_dead_letter" ("provider_event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dead_letter_resolved" ON "billing_webhook_dead_letter" ("resolved_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_events_provider_id" ON "billing_webhook_events" ("provider_event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_events_type" ON "billing_webhook_events" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_events_status" ON "billing_webhook_events" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accommodations_deletedAt_idx" ON "accommodations" ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accommodations_moderationState_idx" ON "accommodations" ("moderation_state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "destinations_createdById_idx" ON "destinations" ("created_by_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "destinations_deletedAt_idx" ON "destinations" ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "destinations_moderationState_idx" ON "destinations" ("moderation_state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_deletedAt_idx" ON "events" ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_moderationState_idx" ON "events" ("moderation_state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_authorId_idx" ON "events" ("author_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eventLocations_slug_idx" ON "event_locations" ("slug");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "owner_promotions" ADD CONSTRAINT "owner_promotions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "owner_promotions" ADD CONSTRAINT "owner_promotions_accommodation_id_accommodations_id_fk" FOREIGN KEY ("accommodation_id") REFERENCES "accommodations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "owner_promotions" ADD CONSTRAINT "owner_promotions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "owner_promotions" ADD CONSTRAINT "owner_promotions_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "owner_promotions" ADD CONSTRAINT "owner_promotions_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_sponsor_user_id_users_id_fk" FOREIGN KEY ("sponsor_user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_level_id_sponsorship_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "sponsorship_levels"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_package_id_sponsorship_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "sponsorship_packages"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsorship_levels" ADD CONSTRAINT "sponsorship_levels_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsorship_levels" ADD CONSTRAINT "sponsorship_levels_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsorship_levels" ADD CONSTRAINT "sponsorship_levels_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsorship_packages" ADD CONSTRAINT "sponsorship_packages_event_level_id_sponsorship_levels_id_fk" FOREIGN KEY ("event_level_id") REFERENCES "sponsorship_levels"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsorship_packages" ADD CONSTRAINT "sponsorship_packages_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsorship_packages" ADD CONSTRAINT "sponsorship_packages_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsorship_packages" ADD CONSTRAINT "sponsorship_packages_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_customer_entitlements" ADD CONSTRAINT "billing_customer_entitlements_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing_customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_customer_limits" ADD CONSTRAINT "billing_customer_limits_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing_customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_invoice_lines" ADD CONSTRAINT "billing_invoice_lines_invoice_id_billing_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "billing_invoices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_invoice_payments" ADD CONSTRAINT "billing_invoice_payments_invoice_id_billing_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "billing_invoices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing_customers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "billing_subscriptions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_payment_methods" ADD CONSTRAINT "billing_payment_methods_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing_customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing_customers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "billing_subscriptions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_prices" ADD CONSTRAINT "billing_prices_plan_id_billing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "billing_plans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_promo_code_usage" ADD CONSTRAINT "billing_promo_code_usage_promo_code_id_billing_promo_codes_id_fk" FOREIGN KEY ("promo_code_id") REFERENCES "billing_promo_codes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_refunds" ADD CONSTRAINT "billing_refunds_payment_id_billing_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "billing_payments"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_subscription_addons" ADD CONSTRAINT "billing_subscription_addons_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "billing_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_subscription_addons" ADD CONSTRAINT "billing_subscription_addons_addon_id_billing_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "billing_addons"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing_customers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_promo_code_id_billing_promo_codes_id_fk" FOREIGN KEY ("promo_code_id") REFERENCES "billing_promo_codes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_usage_records" ADD CONSTRAINT "billing_usage_records_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "billing_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_vendor_payouts" ADD CONSTRAINT "billing_vendor_payouts_vendor_id_billing_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "billing_vendors"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "event_locations" ADD CONSTRAINT "event_locations_slug_unique" UNIQUE("slug");