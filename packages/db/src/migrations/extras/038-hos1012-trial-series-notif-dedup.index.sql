-- =============================================================================
-- 038-hos1012-trial-series-notif-dedup.index.sql
-- Partial UNIQUE index enforcing "at most one email per (subscription, send)"
-- for the nine sends of the Hospeda-owned trial email series (HOS-1012 §4).
--
-- Why this file exists:
--   `dispatchOne()` (apps/api/src/cron/jobs/trial-series-dispatch.ts) dedups
--   each send with a check-then-insert: SELECT for an existing
--   `billing_subscription_events` row keyed on `(subscription_id, event_type)`
--   for the nine `TRIAL_SERIES_NOTIF_*` types, then INSERT if none exists. Cron
--   runs are serialized by advisory lock 1002, so today that guard is race-free
--   — but the guarantee is application-level only. This partial UNIQUE index
--   makes the invariant a DB-level fact and backs the `.onConflictDoNothing()`
--   on the insert.
--
--   This is the direct successor of `030-hos121-trial-pre-end-notif-dedup`,
--   which covers the two-variant `TRIAL_PRE_END_NOTIF_D3/_D1` scheme HOS-1012
--   replaced. That index is deliberately LEFT IN PLACE: its rows still exist on
--   staging and production and the invariant it enforces is still true of them.
--   The two indexes cover disjoint sets of event_type values, so they cannot
--   conflict.
--
--   The index MUST be partial: `billing_subscription_events` is a general audit
--   table where other event types (e.g. USER_CANCELED, ADDON_*) may legitimately
--   repeat per subscription, so a full UNIQUE on (subscription_id, event_type)
--   would be wrong. A partial UNIQUE index cannot be declared in the Drizzle TS
--   schema, so per the Carril 2 golden rule (packages/db/CLAUDE.md
--   "Migrations") it lives here, not in `src/migrations/`.
--
-- Why nine event types and not one with the offset in `metadata`:
--   an offset stored in JSONB could not be part of this index, so the atomic
--   backstop would collapse to "at most one email of the whole series per
--   subscription" and the ledger would silently swallow eight of the nine
--   sends. The strings come from BILLING_EVENT_TYPES.TRIAL_SERIES_NOTIF_*
--   (packages/service-core/src/services/billing/constants.ts) and MUST stay in
--   sync with the list below.
--
-- Idempotency:
--   No rows carrying these event types can exist before this migration (the
--   types are introduced by the same change), so no defensive de-duplication
--   pass is needed — unlike 030, which had to clean up after a pre-existing
--   writer. CREATE UNIQUE INDEX IF NOT EXISTS is itself idempotent.
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_subscription_events_trial_series
    ON billing_subscription_events (subscription_id, event_type)
    WHERE event_type IN (
        'TRIAL_SERIES_NOTIF_PRE_10D',
        'TRIAL_SERIES_NOTIF_PRE_5D',
        'TRIAL_SERIES_NOTIF_PRE_1D',
        'TRIAL_SERIES_NOTIF_EXPIRY',
        'TRIAL_SERIES_NOTIF_POST_1D',
        'TRIAL_SERIES_NOTIF_POST_5D',
        'TRIAL_SERIES_NOTIF_POST_10D',
        'TRIAL_SERIES_NOTIF_POST_30D',
        'TRIAL_SERIES_NOTIF_POST_60D'
    );
