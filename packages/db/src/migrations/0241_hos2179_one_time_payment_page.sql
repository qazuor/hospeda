ALTER TABLE "billing_deadline_version" DROP CONSTRAINT "ck_billing_deadline_changed_key_range";--> statement-breakpoint
ALTER TABLE "idempotency_key" DROP CONSTRAINT "ck_idempotency_key_operation";--> statement-breakpoint
ALTER TABLE "addon_instance" ADD COLUMN "payment_page_id" varchar(64);--> statement-breakpoint
ALTER TABLE "addon_instance" ADD COLUMN "payment_page_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "addon_instance" ADD CONSTRAINT "uq_addon_instance_payment_page" UNIQUE("payment_page_id");--> statement-breakpoint
ALTER TABLE "addon_instance" ADD CONSTRAINT "ck_addon_instance_payment_page_pair" CHECK (("addon_instance"."payment_page_id" IS NULL) = ("addon_instance"."payment_page_expires_at" IS NULL));--> statement-breakpoint
ALTER TABLE "billing_deadline_version" ADD CONSTRAINT "ck_billing_deadline_changed_key_range" CHECK ("billing_deadline_version"."changed_key" BETWEEN 10 AND 21 OR "billing_deadline_version"."changed_key" IS NULL);--> statement-breakpoint
ALTER TABLE "idempotency_key" ADD CONSTRAINT "ck_idempotency_key_operation" CHECK ("idempotency_key"."operation" IN ('PREAPPROVAL_CREATE', 'ORDER_CREATE', 'REFUND_CREATE', 'PAYMENT_PAGE_CREATE'));--> statement-breakpoint
-- HOS-2179 (P-2, decided): publish the one-time payment page deadline with the structural key range.
-- The page lives 60 minutes and the purchase window closes 60 minutes after it.
INSERT INTO billing_deadline_version (version, "values")
SELECT latest.version + 1,
       jsonb_set(latest."values", '{21}', '{"pageMinutes":60,"windowMarginMinutes":60}'::jsonb, true)
FROM billing_deadline_version AS latest
WHERE latest.version = (SELECT max(version) FROM billing_deadline_version)
  AND NOT latest."values" ? '21';
