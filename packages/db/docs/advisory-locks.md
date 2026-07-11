# Advisory Lock Registry

All PostgreSQL advisory locks used in the Hospeda platform. Lock IDs must be unique across the entire codebase to prevent collisions.

## Active Locks

| Lock ID | Owner File | Purpose | Type | Spec |
|---------|-----------|---------|------|------|
| 1001 | `apps/api/src/cron/jobs/webhook-retry.job.ts` | Prevent overlapping webhook retry cron executions | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-009 |
| 1002 | `apps/api/src/cron/jobs/notification-schedule.job.ts` | Prevent overlapping notification schedule cron executions | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-034 |
| 1003 | `apps/api/src/cron/jobs/dunning.job.ts` | Prevent overlapping dunning cron executions | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-021 |
| 1004 | `apps/api/src/services/trial.service.ts` | Prevent overlapping `blockExpiredTrials` batch runs | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-064 |
| 1005 | _(free — retired)_ | Formerly `trial-pre-end-notif.job.ts`; that duplicate cron was deleted (HOS-121) after its robustness was ported into `notification-schedule.job.ts` (lock 1002). Key 1005 is available for reuse. | — | SPEC-064 / HOS-121 |
| 1006 | `apps/api/src/cron/jobs/abandoned-pending-subs.job.ts` | Prevent overlapping abandoned pending subscriptions cron executions | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-143 |
| 1007 | `apps/api/src/cron/jobs/subscription-poll.job.ts` | Prevent overlapping subscription poll cron executions | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-143 |
| 1008 | `apps/api/src/cron/jobs/exchange-rate-fetch.job.ts` | Prevent overlapping exchange rate fetch cron executions | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-194 |
| 43001 | `apps/api/src/cron/jobs/addon-expiry.job.ts` | Prevent overlapping addon expiry cron executions | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-064 |
| hash-derived | `apps/api/src/services/addon-plan-change.service.ts` | Per-customer addon recalculation serialization | `pg_advisory_xact_lock` (blocking) | SPEC-064 |
| 43010 | `apps/api/src/cron/jobs/archive-expired-promotions.job.ts` | Prevent overlapping promotion archive cron executions | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-063 |
| 43020 | _(retired — id reserved, not reused)_ | RETIRED (HOS-112): `conversation-notification.job.ts` no longer acquires an advisory lock. The atomic Redis dispatch claim (`SET conv:notif:{scheduleId} 1 NX EX 600`) serializes per-schedule ownership across overlapping runs, and `NotificationScheduleService.advanceSchedule`'s double-advance guard is the DB-level safety net — the lock added no closed gap beyond those two, and holding it across a batched persist step was actively harmful (dropped an entire batch of streak advances on lock contention after the emails were already sent, causing duplicates). | — | SPEC-085 / HOS-112 |
| 43021 | _(retired — id reserved, not reused)_ | RETIRED (HOS-129): `conversation-token-reminder.job.ts` no longer acquires an advisory lock. The `*_reminder_sent_at` DB columns (`day15ReminderSentAt` / `day25ReminderSentAt`, checked via `findDueReminders`'s `IS NULL` filter) are the durable dedup guard — the lock added serialization overhead without closing a gap worth the tradeoff of holding it across the batched `sendEmail` HTTP calls it used to wrap. | — | SPEC-085 / HOS-129 |
| 43022 | `apps/api/src/cron/jobs/conversation-token-cleanup.job.ts` | Prevent overlapping expired conversation access token cleanup (daily cron) | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-085 |
| 43031 | `apps/api/src/cron/jobs/destination-weather-fetch.job.ts` | Prevent overlapping destination weather fetch cron executions (12h cron) | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-215 |

## Rules

1. All advisory locks MUST be transaction-level (`_xact_` variants). Session-level locks are forbidden due to Neon connection pooling.
2. New lock IDs must be registered in this file before use.
3. Hash-derived lock IDs use `hashCustomerId()` from `@repo/service-core` to generate deterministic bigint from UUID.
4. Use `pg_try_advisory_xact_lock` (non-blocking) for cron jobs and background tasks.
5. Use `pg_advisory_xact_lock` (blocking) only when waiting is acceptable and a timeout is set via `SET LOCAL statement_timeout`.
