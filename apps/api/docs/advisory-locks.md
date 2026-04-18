# Advisory Lock Registry

This document lists all PostgreSQL advisory locks used in the Hospeda API.
All locks use `pg_try_advisory_xact_lock` (transaction-level, non-blocking) unless noted otherwise.

> **Why transaction-level?**
> `pg_try_advisory_xact_lock` auto-releases when the enclosing transaction commits or rolls back.
> This is safe for Neon's transaction-pooling mode, which does not support persistent session-level
> advisory locks across pooled connections.

## Lock Keys

| Key  | File | Purpose | Acquired | Released |
|------|------|---------|----------|----------|
| `1001` | `apps/api/src/cron/jobs/webhook-retry.job.ts` | Prevents concurrent webhook-retry cron runs across multiple API instances | At transaction start inside the cron handler | Automatically on transaction commit/rollback |
| `1002` | `apps/api/src/cron/jobs/notification-schedule.job.ts` | Prevents concurrent notification-schedule cron runs across multiple API instances | At transaction start inside the cron handler | Automatically on transaction commit/rollback |
| `1003` | `apps/api/src/cron/jobs/dunning.job.ts` | Prevents concurrent dunning (failed-payment retry) cron runs across multiple API instances | At transaction start inside the cron handler | Automatically on transaction commit/rollback |
| `1004` | `apps/api/src/services/trial.service.ts` (`BLOCK_EXPIRED_TRIALS_LOCK_KEY`) | Prevents concurrent execution of the block-expired-trials operation | Inside `withServiceTransaction`, at the start of the trial-blocking operation | Automatically on transaction commit/rollback |
| `43001` | `apps/api/src/cron/jobs/addon-expiry.job.ts` | Prevents concurrent addon-expiry cron runs across multiple API instances | At transaction start inside the cron handler | Automatically on transaction commit/rollback |
| `43010` | `apps/api/src/cron/jobs/archive-expired-promotions.job.ts` (`ADVISORY_LOCK_ID`) | Prevents concurrent archive-expired-promotions cron runs across multiple API instances | At transaction start inside the cron handler | Automatically on transaction commit/rollback |
| per-customer hash | `apps/api/src/services/addon-plan-change.service.ts` | Per-customer mutual exclusion during plan-change addon recalculation (GAP-043-035). Key is derived from the customer UUID via `hashCustomerId()` | Inside `withServiceTransaction` in Phase 1 | Automatically on transaction commit/rollback (end of Phase 1) |

## Notes

- All keys use `pg_try_advisory_xact_lock` (non-blocking). If the lock is already held, the call
  returns `false` immediately and the job returns a `skipped` result rather than waiting or throwing.
- The per-customer hash in `addon-plan-change.service.ts` uses `pg_advisory_xact_lock` (blocking),
  not the try-variant, to serialize concurrent plan-change events for the same customer.
- Keys `1001`–`1004` are reserved for cron/service jobs. Keys `43001` and `43010` are reserved for
  addon and promotion lifecycle cron jobs respectively.
- No key is used more than once across all files.

## Reservation Table

| Range | Reserved For |
|-------|-------------|
| `1001–1004` | Core cron jobs and service-level operations |
| `43001–43010` | Addon/promotion lifecycle cron jobs |
| per-customer hash | `addon-plan-change.service.ts` (derived, not a fixed integer) |
