DROP INDEX "idx_refunds_provider_id";--> statement-breakpoint
-- Hand-added after `db:generate`: the CREATE UNIQUE INDEX below aborts the
-- whole migration if any duplicate `provider_refund_id` already exists, and a
-- failed migration blocks the deploy. The ledger was never written by core
-- before qzpay-core@4.0.0 (the repository methods existed with zero call
-- sites), so this should match nothing — it is here so that "should" is not
-- what the deploy depends on. Keeps the oldest row per provider refund id,
-- which is the one that actually recorded the event.
DELETE FROM "billing_refunds" a
  USING "billing_refunds" b
  WHERE a."provider_refund_id" IS NOT NULL
    AND a."provider_refund_id" = b."provider_refund_id"
    AND a."created_at" > b."created_at";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_refunds_provider_refund_id_unique" ON "billing_refunds" USING btree ("provider_refund_id") WHERE provider_refund_id IS NOT NULL;