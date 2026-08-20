-- HOS-710: the polling-job active-uniqueness moves from `subscription_id` to
-- `(provider, provider_resource_id)`. The old scope allowed one active job per
-- SUBSCRIPTION, so the first add-on checkout -- even an abandoned one -- held
-- the only slot and every later purchase got no polling job at all. MP
-- Preferences deliver no Webhooks v2 event, so that job is the only activation
-- path a purchase has: two approved payments were collected and never recorded.
--
-- Mirrors @qazuor/qzpay-drizzle migration 0005 (that package owns this table).
--
-- Hand-edited from the drizzle-kit output for ordering and safety. As generated
-- it was DROP-then-CREATE, which leaves the table with NO uniqueness at all if
-- the CREATE fails. Here the new index is built FIRST and the old one dropped
-- only once it exists, and any row set that would break the build is retired
-- before the attempt.

-- The new index is stricter in exactly one respect: two pending jobs sharing a
-- (provider, provider_resource_id). That should never exist -- the resource id
-- is generated per checkout -- but a historical duplicate would abort the build.
-- Retire any such row first, keeping the oldest of each group.
UPDATE "billing_subscription_polling_jobs" AS j
SET "status" = 'cancelled',
    "completed_at" = NOW(),
    "last_error" = 'superseded_by_one_active_per_resource_migration'
WHERE j."status" = 'pending'
  AND EXISTS (
      SELECT 1
      FROM "billing_subscription_polling_jobs" AS keep
      WHERE keep."status" = 'pending'
        AND keep."provider" = j."provider"
        AND keep."provider_resource_id" = j."provider_resource_id"
        AND (keep."created_at", keep."id") < (j."created_at", j."id")
  );--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_polling_jobs_one_active_per_resource" ON "billing_subscription_polling_jobs" USING btree ("provider","provider_resource_id") WHERE status = 'pending';--> statement-breakpoint
DROP INDEX IF EXISTS "idx_polling_jobs_one_active_per_sub";
