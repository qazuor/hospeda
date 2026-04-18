# Advisory Lock Registry

All PostgreSQL advisory locks used in the Hospeda platform. Lock IDs must be unique across the entire codebase to prevent collisions.

## Active Locks

| Lock ID | Owner File | Purpose | Type | Spec |
|---------|-----------|---------|------|------|
| 43001 | `apps/api/src/cron/jobs/addon-expiry.job.ts` | Prevent overlapping addon expiry cron executions | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-064 |
| hash-derived | `apps/api/src/services/addon-plan-change.service.ts` | Per-customer addon recalculation serialization | `pg_advisory_xact_lock` (blocking) | SPEC-064 |
| 43010 | `apps/api/src/cron/jobs/archive-expired-promotions.job.ts` | Prevent overlapping promotion archive cron executions | `pg_try_advisory_xact_lock` (non-blocking) | SPEC-063 |

## Rules

1. All advisory locks MUST be transaction-level (`_xact_` variants). Session-level locks are forbidden due to Neon connection pooling.
2. New lock IDs must be registered in this file before use.
3. Hash-derived lock IDs use `hashCustomerId()` from `@repo/service-core` to generate deterministic bigint from UUID.
4. Use `pg_try_advisory_xact_lock` (non-blocking) for cron jobs and background tasks.
5. Use `pg_advisory_xact_lock` (blocking) only when waiting is acceptable and a timeout is set via `SET LOCAL statement_timeout`.
