# Advisory Lock Registry

All PostgreSQL advisory locks used in the Hospeda platform. Lock IDs must be unique across the entire codebase to prevent collisions.

## Active Locks

| Lock ID | Owner File | Purpose | Type | Spec |
|---------|-----------|---------|------|------|
| 1001 | `apps/api/src/cron/jobs/webhook-retry.job.ts` | Prevent overlapping webhook retry cron executions | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-009 |
| 1002 | `apps/api/src/cron/jobs/notification-schedule.job.ts` | Prevent overlapping notification schedule cron executions | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-034 |
| 1003 | `apps/api/src/cron/jobs/dunning.job.ts` | Prevent overlapping dunning cron executions | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-021 |
| 1004 | `apps/api/src/services/trial.service.ts` | Prevent overlapping `blockExpiredTrials` batch runs | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-064 |
| 1005 | `apps/api/src/cron/jobs/trial-pre-end-notif.job.ts` | Prevent overlapping trial pre-end notification cron executions | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-064 |
| 1006 | `apps/api/src/cron/jobs/abandoned-pending-subs.job.ts` | Prevent overlapping abandoned pending subscriptions cron executions | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-143 |
| 1007 | `apps/api/src/cron/jobs/subscription-poll.job.ts` | Prevent overlapping subscription poll cron executions | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-143 |
| 1008 | `apps/api/src/cron/jobs/exchange-rate-fetch.job.ts` | Prevent overlapping exchange rate fetch cron executions | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-194 |
| 43001 | `apps/api/src/cron/jobs/addon-expiry.job.ts` | Prevent overlapping addon expiry cron executions | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-064 |
| hash-derived | `apps/api/src/services/addon-plan-change.service.ts` | Per-customer addon recalculation serialization | `pg_advisory_xact_lock` (blocking) | SPEC-064 |
| 43010 | `apps/api/src/cron/jobs/archive-expired-promotions.job.ts` | Prevent overlapping promotion archive cron executions | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-063 |
| 43020 | `apps/api/src/cron/jobs/conversation-notification-dispatch.job.ts` | Prevent overlapping conversation notification dispatch (5-min cron) | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-085 |
| 43021 | `apps/api/src/cron/jobs/conversation-token-reminder.job.ts` | Prevent overlapping conversation token reminder dispatch (day15/day25, daily cron) | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-085 |
| 43022 | `apps/api/src/cron/jobs/conversation-token-cleanup.job.ts` | Prevent overlapping expired conversation access token cleanup (daily cron) | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-085 |
| 43031 | `apps/api/src/cron/jobs/destination-weather-fetch.job.ts` | Prevent overlapping destination weather fetch cron executions (12h cron) | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-215 |

## Rules

1. All advisory locks MUST be transaction-level (`_xact_` variants). Session-level locks are forbidden due to Neon connection pooling.
2. New lock IDs must be registered in this file before use.
3. Hash-derived lock IDs use `hashCustomerId()` from `@repo/service-core` to generate deterministic bigint from UUID.
4. Use `pg_try_advisory_xact_lock` (non-blocking) for cron jobs and background tasks.
5. Use `pg_advisory_xact_lock` (blocking) only when waiting is acceptable and a timeout is set via `SET LOCAL statement_timeout`.
