-- HOS-2060 release N+1: 0194 copied these fields into `policies` one release
-- earlier, and no shipped code reads or writes them any more (HOS-601).
UPDATE "accommodations" SET "extra_info" = "extra_info" - 'smokingAllowed' - 'minNights' - 'maxNights' WHERE "extra_info" IS NOT NULL AND "extra_info" ?| array['smokingAllowed', 'minNights', 'maxNights'];--> statement-breakpoint
ALTER TABLE "experiences" DROP COLUMN "cancellation_policy";--> statement-breakpoint
ALTER TABLE "experiences" DROP COLUMN "accepts_private_groups";--> statement-breakpoint
ALTER TABLE "venues" DROP COLUMN "min_age";--> statement-breakpoint
ALTER TABLE "venues" DROP COLUMN "dress_code";--> statement-breakpoint
ALTER TABLE "venues" DROP COLUMN "dress_code_note_i18n";--> statement-breakpoint
DROP TYPE "public"."venue_dress_code_enum";