CREATE TYPE "public"."partner_content_review_state_enum" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "pending_logo_url" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "pending_description" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "pending_website_url" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "content_review_state" "partner_content_review_state_enum";--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "content_review_note" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "content_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "content_approved_by_id" uuid;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_content_approved_by_id_users_id_fk" FOREIGN KEY ("content_approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partners_contentReviewState_idx" ON "partners" USING btree ("content_review_state");--> statement-breakpoint
--
-- HOS-278 D2 backfill — hand-added, not drizzle-generated.
--
-- `content_approved_at` is the AC-11 payment gate: NULL means no admin has
-- ever accepted this partner's content, and `send-link` / `manual-payment`
-- refuse to run. Every partner that exists at this point was typed into the
-- admin by a person, so its content HAS already passed the only review AC-11
-- asks for — leaving them NULL would silently break the payment flow for the
-- entire existing directory the moment this migration lands.
--
-- Scoped by "has no alliance lead pointing at it" rather than by date or by
-- `owner_user_id IS NULL`: a partner provisioned from an approved lead (D1)
-- is exactly the one whose content the applicant has not written yet, and it
-- must stay gated. A claimed lead's partner has a non-null owner, so an
-- owner-based predicate would wrongly approve it.
--
UPDATE "partners" p
SET "content_approved_at" = p."created_at"
WHERE p."content_approved_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "alliance_leads" l WHERE l."provisioned_partner_id" = p."id"
  );