# Advisory Lock Registry

This document lists the PostgreSQL advisory locks used in the Hospeda codebase (`apps/api/src`,
`packages/*/src`, and the DB extras). Cron locks use `pg_try_advisory_xact_lock` (transaction-level,
non-blocking). Serialization locks use `pg_advisory_xact_lock` (transaction-level, blocking).

> **Why transaction-level?**
> `pg_try_advisory_xact_lock` auto-releases when the enclosing transaction commits or rolls back.
> This is safe for pooled connections, which do not support persistent session-level advisory locks.

## Cron lock keys (fixed integers, non-blocking)

| Key  | File | Purpose |
|------|------|---------|
| `1008` | `apps/api/src/cron/jobs/exchange-rate-fetch.job.ts` (`ADVISORY_LOCK_KEY`) | Prevents concurrent exchange-rate-fetch runs |
| `43010` | `apps/api/src/cron/jobs/archive-expired-promotions.job.ts` (`ADVISORY_LOCK_ID`) | Prevents concurrent archive-expired-promotions runs |
| `43022` | `apps/api/src/cron/jobs/conversation-token-cleanup.job.ts` (`ADVISORY_LOCK_ID`) | Prevents concurrent conversation-token-cleanup runs |
| `43031` | `apps/api/src/cron/jobs/destination-weather-fetch.job.ts` (`ADVISORY_LOCK_KEY`) | Prevents overlapping write phases of destination-weather-fetch across replicas |
| `43032` | `apps/api/src/cron/jobs/social-publish-dispatch.job.ts` (`ADVISORY_LOCK_KEY`) | Prevents overlapping social-publish-dispatch runs |

Keys `43020` (conversation-notification) and `43021` (conversation-token-reminder) are retired: the
lock was removed from both jobs. Do not reuse them. The billing and listing cron jobs
(`trial-machine-expiry`, `subscription-*`, `billing-*`, `listing-*`) take no advisory lock of their
own; they serialize per subject through the locks below.

## Serialization locks (blocking, `pg_advisory_xact_lock`)

| Key | File | Purpose |
|-----|------|---------|
| `hashtextextended('trial-start:<userId>:<vertical>', 0)` | `apps/api/src/utils/trial/trial-machine-ports.ts`, `apps/api/src/utils/listing-publication/ports.ts` (key from `trialMachineLockKey()` in `packages/verticals/src/trial/trial-lock-key.ts`) | One trial-machine / publication transition at a time per user and vertical |
| `hashtextextended(<caller key>, 0)` | `packages/db/src/models/listing/listing-publication.model.ts` (`lock()`) | Serializes every listing publication transition for one owner and vertical |
| `hashtextextended('<userId>:<vertical>:<key>', 0)` | `packages/db/src/models/quota-window/quota-window.model.ts` (`withWindowLock()`) | Serializes quota-window reads and writes per user, vertical and key |
| `hashtextextended(...)` | `packages/db/src/migrations/extras/048-cuota-ventana-one-open.trigger.sql` | Same serialization, taken inside the one-open-window trigger |
| `(1516, 22)` | `packages/service-core/src/services/billing/deadlines/billing-deadlines.service.ts` | Serializes updates of the billing deadlines settings |
| `(1479, 22)` | `packages/service-core/src/services/vertical-deadlines/vertical-deadlines.service.ts` | Serializes updates of the vertical deadlines settings |
| `hashtext(<ownerId>)` | `packages/service-core/src/services/tag/tag.service.ts` | Serializes USER tag quota checks per owner |

## Notes

- Cron keys: if the lock is already held, `pg_try_advisory_xact_lock` returns `false` immediately and
  the job returns a `skipped` result rather than waiting or throwing.
- The two-integer form `(1516, 22)` / `(1479, 22)` is a different key space from the single-integer
  cron keys, so those cannot collide with `1008` or `43xxx`.
- Fixed cron integers are unique across all files. Before adding one, grep for it (see the collision
  check in the [runbook](runbook-advisory-locks.md)).
- `packages/db/docs/advisory-locks.md` documents the project policy on advisory locks.

## Reservation Table

| Range | Reserved For |
|-------|-------------|
| `1008` | exchange-rate-fetch cron |
| `43010` | archive-expired-promotions cron |
| `43020–43022` | Conversation crons (`43020`, `43021` retired; `43022` in use) |
| `43031–43032` | Content/social crons (weather, social publish) |
| hash-derived | Per-subject serialization locks (not fixed integers) |
