ALTER TABLE "promo_code" DROP CONSTRAINT "ck_promo_code_discount_kind";--> statement-breakpoint
ALTER TABLE "promo_code" DROP CONSTRAINT "ck_promo_code_value";--> statement-breakpoint
ALTER TABLE "promo_code" DROP CONSTRAINT "ck_promo_code_duration_kind";--> statement-breakpoint
ALTER TABLE "promo_code" ALTER COLUMN "discount_kind" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "promo_code" ALTER COLUMN "value" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "promo_code" ALTER COLUMN "duration_kind" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "promo_redemption" ALTER COLUMN "subscription_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "promo_code" ADD COLUMN "effect_kind" varchar(16) DEFAULT 'DISCOUNT' NOT NULL;--> statement-breakpoint
ALTER TABLE "promo_code" ADD COLUMN "extension_days" integer;--> statement-breakpoint
ALTER TABLE "promo_code" ADD CONSTRAINT "ck_promo_code_effect_kind" CHECK ("promo_code"."effect_kind" IN ('DISCOUNT', 'TRIAL_EXTENSION'));--> statement-breakpoint
ALTER TABLE "promo_code" ADD CONSTRAINT "ck_promo_code_effect_shape" CHECK (("promo_code"."effect_kind" = 'DISCOUNT' AND "promo_code"."discount_kind" IS NOT NULL AND "promo_code"."value" IS NOT NULL AND "promo_code"."duration_kind" IS NOT NULL AND "promo_code"."extension_days" IS NULL) OR ("promo_code"."effect_kind" = 'TRIAL_EXTENSION' AND "promo_code"."discount_kind" IS NULL AND "promo_code"."value" IS NULL AND "promo_code"."duration_kind" IS NULL AND "promo_code"."duration_charges" IS NULL AND "promo_code"."extension_days" IS NOT NULL AND "promo_code"."extension_days" > 0));--> statement-breakpoint
ALTER TABLE "promo_code" ADD CONSTRAINT "ck_promo_code_discount_kind" CHECK ("promo_code"."discount_kind" IS NULL OR "promo_code"."discount_kind" IN ('PERCENTAGE', 'FIXED'));--> statement-breakpoint
ALTER TABLE "promo_code" ADD CONSTRAINT "ck_promo_code_value" CHECK ("promo_code"."value" IS NULL OR ("promo_code"."value" > 0 AND ("promo_code"."discount_kind" IS NULL OR "promo_code"."discount_kind" <> 'PERCENTAGE' OR "promo_code"."value" <= 100)));--> statement-breakpoint
ALTER TABLE "promo_code" ADD CONSTRAINT "ck_promo_code_duration_kind" CHECK ("promo_code"."duration_kind" IS NULL OR "promo_code"."duration_kind" IN ('FIRST_CHARGE', 'N_CHARGES', 'FOREVER'));--> statement-breakpoint
ALTER TABLE "promo_redemption" ADD CONSTRAINT "ck_promo_redemption_subscription_or_unlimited" CHECK ("promo_redemption"."subscription_id" IS NOT NULL OR "promo_redemption"."remaining_charges" IS NULL);