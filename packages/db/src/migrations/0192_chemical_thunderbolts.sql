CREATE TYPE "public"."venue_dress_code_enum" AS ENUM('casual', 'smart_casual', 'elegant', 'no_restrictions');--> statement-breakpoint
CREATE TYPE "public"."venue_entry_kind_enum" AS ENUM('free', 'paid', 'varies');--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "entry_kind" "venue_entry_kind_enum";--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "entry_note_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "entry_price_from" integer;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "entry_price_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "min_age" smallint;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "dress_code" "venue_dress_code_enum";--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "dress_code_note_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_entry_price_nonnegative" CHECK ("venues"."entry_price_from" >= 0);--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_entry_price_requires_paid" CHECK ("venues"."entry_price_from" IS NULL OR "venues"."entry_kind" = 'paid');