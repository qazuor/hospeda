CREATE TABLE "promo_redemption_charge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"redemption_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"charge_created_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_promo_redemption_charge_redemption_payment" UNIQUE("redemption_id","payment_id")
);
--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "promo_charges_recorded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "promo_redemption" ADD COLUMN "initial_charges" integer;--> statement-breakpoint
-- HOS-2352 (hand-edited): the ledger starts empty (no backfill). A redemption that predates it
-- starts the ledger with the charges it has left right now, so every charge it spends from here
-- on is counted against that number. Unlimited redemptions keep NULL.
UPDATE "promo_redemption" SET "initial_charges" = "remaining_charges" WHERE "remaining_charges" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "promo_redemption" ADD COLUMN "ended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "promo_redemption" ADD COLUMN "ended_reason" varchar(32);--> statement-breakpoint
ALTER TABLE "promo_redemption_charge" ADD CONSTRAINT "promo_redemption_charge_redemption_id_promo_redemption_id_fk" FOREIGN KEY ("redemption_id") REFERENCES "public"."promo_redemption"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_redemption_charge" ADD CONSTRAINT "promo_redemption_charge_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_redemption" ADD CONSTRAINT "ck_promo_redemption_initial_charges" CHECK ("promo_redemption"."initial_charges" IS NULL OR "promo_redemption"."initial_charges" >= 0);--> statement-breakpoint
ALTER TABLE "promo_redemption" ADD CONSTRAINT "ck_promo_redemption_ended_together" CHECK (("promo_redemption"."ended_at" IS NULL) = ("promo_redemption"."ended_reason" IS NULL));--> statement-breakpoint
ALTER TABLE "promo_redemption" ADD CONSTRAINT "ck_promo_redemption_ended_reason" CHECK ("promo_redemption"."ended_reason" IS NULL OR "promo_redemption"."ended_reason" IN ('DOWNGRADE', 'PLAN_RETIREMENT'));