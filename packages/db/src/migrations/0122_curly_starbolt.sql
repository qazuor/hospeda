CREATE TYPE "public"."partner_payment_review_state_enum" AS ENUM('pending_confirmation');--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "payment_review_state" "partner_payment_review_state_enum";--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "payment_confirmed_through" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "partners_paymentReviewState_idx" ON "partners" USING btree ("payment_review_state");