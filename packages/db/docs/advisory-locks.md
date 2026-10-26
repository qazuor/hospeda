# Advisory Lock Registry

All PostgreSQL advisory locks used in the Hospeda platform. Lock IDs must be unique across the entire codebase to prevent collisions.

## Active Locks

Re-derived from code (`pg_(try_)?advisory(_xact)?_lock` outside tests). Fixed integer IDs must stay unique across the codebase. The hash-derived keys cannot collide with them in practice.

### Cron jobs (fixed ID, non-blocking)

| Lock ID | Owner File | Purpose | Type | Spec |
|---------|-----------|---------|------|------|
| 1008 | `apps/api/src/cron/jobs/exchange-rate-fetch.job.ts` | Prevent overlapping exchange rate fetch cron executions | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-194 |
| 43010 | `apps/api/src/cron/jobs/archive-expired-promotions.job.ts` | Prevent overlapping promotion archive cron executions | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-063 |
| 43022 | `apps/api/src/cron/jobs/conversation-token-cleanup.job.ts` | Prevent overlapping expired conversation access token cleanup (daily cron) | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-085 |
| 43031 | `apps/api/src/cron/jobs/destination-weather-fetch.job.ts` | Prevent overlapping destination weather fetch cron executions (12h cron) | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-215 |
| 43032 | `apps/api/src/cron/jobs/social-publish-dispatch.job.ts` | Prevent overlapping social publish dispatch cron executions | `pg_try_advisory_xact_lock` (non-blocking) | |

### Service and model locks (blocking)

| Lock key | Owner File | Purpose | Type | Spec |
|---------|-----------|---------|------|------|
| `(1479, 22)` | `packages/service-core/src/services/vertical-deadlines/vertical-deadlines.service.ts` | Action 22, vertical half: serialize publishing `vertical_deadline_version` versions | `pg_advisory_xact_lock` (blocking) | HOS-1479 |
| `(1516, 22)` | `packages/service-core/src/services/billing/deadlines/billing-deadlines.service.ts` | Action 22, billing half: serialize publishing billing deadline versions | `pg_advisory_xact_lock` (blocking) | |
| hash of `trial-start:<userId>:<vertical>` | `apps/api/src/utils/trial/trial-machine-ports.ts`, `apps/api/src/utils/listing-publication/ports.ts` | The trial machine lock per user + vertical (`runLocked`). Key comes from `trialMachineLockKey()` in `@repo/verticals`; the listing publication unit of work reuses the same key so publication and trial transitions serialize together | `pg_advisory_xact_lock(hashtextextended(key, 0))` (blocking) | HOS-1445 |
| hash of caller-supplied key | `packages/db/src/models/listing/listing-publication.model.ts` (`lock()`) | Serializes every listing publication transition for one owner and vertical; the caller supplies the key | `pg_advisory_xact_lock(hashtextextended(key, 0))` (blocking) | |
| hash of `<userId>:<vertical>:<key>` | `packages/db/src/models/quota-window/quota-window.model.ts` and trigger `check_cuota_ventana_one_open` in `packages/db/src/migrations/extras/048-cuota-ventana-one-open.trigger.sql` | Serializes quota window reads/writes so windows for one user, vertical and key never overlap. The model and the trigger MUST build the identical string | `pg_advisory_xact_lock(hashtextextended(key, 0))` (blocking) | HOS-1442 |
| `hashtext(ownerId)` | `packages/service-core/src/services/tag/tag.service.ts` | Serializes USER tag quota enforcement per owner | `pg_advisory_xact_lock` (blocking) | D-010 |

### Retired IDs (reserved, do not reuse)

| Lock ID | Former owner | Status |
|---------|--------------|--------|
| 1001, 1003, 1004, 1005, 1006, 1007, 43001 | Pre-HOS-1352 billing crons and services (owners per git history) | Retired. No code acquires them. |
| 1002 | `notification-schedule.job.ts` | Retired. The job no longer takes an advisory lock. |
| 43020 | `conversation-notification.job.ts` | Retired (HOS-112). The atomic Redis dispatch claim plus the schedule double-advance guard replace it. Holding it across a batched persist step dropped streak advances after emails were sent. |
| 43021 | `conversation-token-reminder.job.ts` | Retired (HOS-129). The `*_reminder_sent_at` columns are the durable dedup guard. |

## Rules

1. All advisory locks MUST be transaction-level (`_xact_` variants). Session-level locks are forbidden due to Neon connection pooling.
2. New lock IDs must be registered in this file before use.
3. Hash-derived keys are built in SQL with `hashtextextended(<string key>, 0)` (or `hashtext` for the tag quota). Build the string from stable identifiers (user id, vertical), never from mutable data.
4. Use `pg_try_advisory_xact_lock` (non-blocking) for cron jobs and background tasks.
5. Use `pg_advisory_xact_lock` (blocking) only when waiting is acceptable and a timeout is set via `SET LOCAL statement_timeout`.
