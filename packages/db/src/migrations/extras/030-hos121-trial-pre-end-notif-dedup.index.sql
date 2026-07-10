-- =============================================================================
-- 030-hos121-trial-pre-end-notif-dedup.index.sql
-- Partial UNIQUE index enforcing "at most one trial pre-end reminder event per
-- (subscription, variant)" for the two trial-reminder variants (HOS-121).
--
-- Why this file exists:
--   `sendTrialReminderDurable()`
--   (apps/api/src/cron/jobs/notification-schedule.job.ts) dedups trial-ending
--   reminders with a check-then-insert: SELECT for an existing
--   `billing_subscription_events` row keyed on
--   `(subscription_id, event_type)` for event_type in
--   ('TRIAL_PRE_END_NOTIF_D3','TRIAL_PRE_END_NOTIF_D1'), then INSERT if none
--   exists. Cron runs are serialized by advisory lock 1002, so today that guard
--   is race-free — but the guarantee is application-level only. This partial
--   UNIQUE index makes the invariant a DB-level fact and backs the
--   `.onConflictDoNothing()` on the insert, so a duplicate can never be written
--   even if a second, un-lock-coordinated writer of these event types is ever
--   added (the just-deleted trial-pre-end-notif cron was one such writer).
--
--   The index MUST be partial: `billing_subscription_events` is a general audit
--   table where other event types (e.g. USER_CANCELED, ADDON_*) may legitimately
--   repeat per subscription, so a full UNIQUE on (subscription_id, event_type)
--   would be wrong. A partial UNIQUE index cannot be declared in the Drizzle TS
--   schema, so per the Carril 2 golden rule (packages/db/CLAUDE.md "Migrations")
--   it lives here, not in `src/migrations/`.
--
-- Predicate and columns MUST match what the app writes: the event_type strings
-- come from BILLING_EVENT_TYPES.TRIAL_PRE_END_NOTIF_D3 / _D1
-- (packages/service-core/src/services/billing/constants.ts), and the pairing is
-- `(subscription_id, event_type)` — the same pair the SELECT guard filters on.
--
-- Defensive dedup before the index:
--   The deleted trial-pre-end-notif cron already dedup'd on exactly these
--   columns, so a live environment should carry at most one row per pairing.
--   The DELETE below is a belt-and-suspenders that removes any pre-existing
--   duplicates (keeping the earliest row per pairing, tie-broken by id) so the
--   UNIQUE index can be created on live data without failing. It is a no-op on
--   any environment that never accumulated duplicates.
--
-- Idempotency:
--   The DELETE is naturally idempotent (no duplicates remain after the first
--   run). CREATE UNIQUE INDEX IF NOT EXISTS is itself idempotent.
-- =============================================================================

DELETE FROM billing_subscription_events
WHERE id IN (
    SELECT id
    FROM (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY subscription_id, event_type
                ORDER BY created_at, id
            ) AS rn
        FROM billing_subscription_events
        WHERE event_type IN ('TRIAL_PRE_END_NOTIF_D3', 'TRIAL_PRE_END_NOTIF_D1')
    ) ranked
    WHERE ranked.rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_subscription_events_trial_pre_end
    ON billing_subscription_events (subscription_id, event_type)
    WHERE event_type IN ('TRIAL_PRE_END_NOTIF_D3', 'TRIAL_PRE_END_NOTIF_D1');
