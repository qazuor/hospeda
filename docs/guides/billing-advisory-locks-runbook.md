# Billing Advisory Locks — Operational Runbook

This runbook covers how to inspect and release the PostgreSQL advisory locks used by Hospeda
cron jobs and the trial/publication/quota services, and what to do when something goes wrong.
The billing model itself no longer takes advisory locks of its own for crons: the legacy
billing crons (webhook retry, dunning, addon expiry, trial reconcile) were deleted by HOS-1352.
See [Billing and verticals](../../CLAUDE.md#billing-and-verticals-hos-1352).

Advisory locks are the mechanism used to guarantee mutual exclusion for cron jobs and per-key
serialization across multiple API instances. See
[ADR-019](../decisions/ADR-019-billing-transaction-isolation.md) for the design rationale.

---

## Lock Registry

The canonical registry is maintained at `packages/db/docs/advisory-locks.md`. The table below
is a quick operational reference. **Always check the registry for the authoritative list.**

| Lock key | Variant | Owner | Purpose |
|---------|---------|-------|---------|
| `1008` | `pg_try_advisory_xact_lock` (non-blocking) | `apps/api/src/cron/jobs/exchange-rate-fetch.job.ts` | Prevent overlapping exchange rate fetch runs |
| `43010` | `pg_try_advisory_xact_lock` (non-blocking) | `apps/api/src/cron/jobs/archive-expired-promotions.job.ts` | Prevent overlapping promotion archive runs |
| `43022` | `pg_try_advisory_xact_lock` (non-blocking) | `apps/api/src/cron/jobs/conversation-token-cleanup.job.ts` | Prevent overlapping token cleanup runs |
| `43031` | `pg_try_advisory_xact_lock` (non-blocking) | `apps/api/src/cron/jobs/destination-weather-fetch.job.ts` | Prevent overlapping weather fetch runs |
| `43032` | `pg_try_advisory_xact_lock` (non-blocking) | `apps/api/src/cron/jobs/social-publish-dispatch.job.ts` | Prevent overlapping social publish dispatch runs |
| `(1479, 22)` | `pg_advisory_xact_lock` (blocking) | `packages/service-core/src/services/vertical-deadlines/vertical-deadlines.service.ts` | Serialize publishing vertical deadline versions |
| `(1516, 22)` | `pg_advisory_xact_lock` (blocking) | `packages/service-core/src/services/billing/deadlines/billing-deadlines.service.ts` | Serialize publishing billing deadline versions |
| hash-derived | `pg_advisory_xact_lock` (blocking) | `apps/api/src/utils/trial/trial-machine-ports.ts`, `apps/api/src/utils/listing-publication/ports.ts` | Trial machine / publication transitions per user + vertical |
| hash-derived | `pg_advisory_xact_lock` (blocking) | `packages/db/src/models/listing/listing-publication.model.ts` (`lock()`) | Listing publication row per key |
| hash-derived | `pg_advisory_xact_lock` (blocking) | `packages/db/src/models/quota-window/quota-window.model.ts` (+ trigger `048`) | Quota window per user + vertical + key |
| hash-derived | `pg_advisory_xact_lock` (blocking) | `packages/service-core/src/services/tag/tag.service.ts` | USER tag quota per owner |

Hash-derived keys are computed in SQL with `hashtextextended(<string>, 0)` (the tag quota uses
`hashtext`) from stable ids such as the user id and vertical, so unrelated users do not block
each other. They are 64-bit (or 32-bit) hashes, not small integers: to find one in `pg_locks`,
compute the same hash in SQL, for example
`SELECT hashtextextended('trial-start:<userId>:<vertical>', 0)`, and split it into
`classid = k >> 32` and `objid = k & 0xFFFFFFFF`.

---

## Lock Variants

| Function | Blocking | Scope | Returns |
|----------|----------|-------|---------|
| `pg_advisory_xact_lock(key)` | Yes (waits) | Transaction | `void` — raises on timeout |
| `pg_try_advisory_xact_lock(key)` | No (returns immediately) | Transaction | `boolean` — `true` if acquired |

All locks in this system use **transaction-scoped** variants (`_xact_`). Session-level variants
(`pg_advisory_lock`) are **forbidden** because Neon PgBouncer uses transaction-mode connection
pooling — a session lock may never be released if the connection is recycled before the explicit
unlock call. See ADR-019 for details.

---

## When Locks Auto-Release

Transaction-scoped locks release automatically when the enclosing transaction ends:

- **On `COMMIT`**: all `_xact_` locks held in that transaction are released.
- **On `ROLLBACK`**: all `_xact_` locks held in that transaction are released.
- **On connection drop**: PostgreSQL rolls back open transactions and releases their locks.

No manual `pg_advisory_unlock` call is needed or expected for `_xact_` locks. If you see a
`pg_advisory_unlock` call in code that uses `_xact_` locks, that is a bug.

---

## Inspecting Active Locks

### List all advisory locks currently held

```sql
SELECT
    pid,
    locktype,
    classid,
    objid,
    mode,
    granted,
    query_start,
    state
FROM pg_locks
JOIN pg_stat_activity USING (pid)
WHERE locktype = 'advisory';
```

`classid` and `objid` together represent the 64-bit lock key. For a single `bigint` key `k`,
PostgreSQL splits it as `classid = k >> 32` and `objid = k & 0xFFFFFFFF`.

For a known integer key like `43010`:

```sql
SELECT *
FROM pg_locks
WHERE locktype = 'advisory'
  AND classid = 0
  AND objid = 43010;
```

### List all locks with associated query text

```sql
SELECT
    l.pid,
    l.classid,
    l.objid,
    l.granted,
    a.query,
    a.query_start,
    a.state,
    now() - a.query_start AS duration
FROM pg_locks l
JOIN pg_stat_activity a ON l.pid = a.pid
WHERE l.locktype = 'advisory'
ORDER BY a.query_start;
```

### Check if a specific cron lock is held

```sql
-- archive-expired-promotions lock (43010)
SELECT pid, granted, now() - query_start AS held_for
FROM pg_locks
JOIN pg_stat_activity USING (pid)
WHERE locktype = 'advisory'
  AND classid = 0
  AND objid = 43010;
```

---

## Releasing Stuck Locks

Transaction-scoped locks cannot get permanently stuck under normal operation: they release when
the transaction ends. However, long-running transactions can hold a lock for minutes if a query
hangs or an external API call inside a transaction does not time out.

### Step 1 — Identify the blocking process

```sql
SELECT pid, query_start, state, query
FROM pg_stat_activity
WHERE pid IN (
    SELECT pid
    FROM pg_locks
    WHERE locktype = 'advisory'
      AND classid = 0
      AND objid = <LOCK_ID>
);
```

### Step 2 — Cancel the query (soft kill)

```sql
SELECT pg_cancel_backend(<pid>);
```

`pg_cancel_backend` sends `SIGINT` to the backend. The query is cancelled and the transaction
is rolled back, releasing the advisory lock automatically.

### Step 3 — Terminate the connection (hard kill, last resort)

If `pg_cancel_backend` does not work within 10-15 seconds:

```sql
SELECT pg_terminate_backend(<pid>);
```

This sends `SIGTERM`, forcibly closing the connection. PostgreSQL rolls back any open transaction,
releasing all held locks.

### Step 4 — Verify the lock is gone

```sql
SELECT COUNT(*) FROM pg_locks
WHERE locktype = 'advisory'
  AND classid = 0
  AND objid = <LOCK_ID>;
-- Expected: 0
```

> Note: `pg_advisory_unlock(key)` can release session-level advisory locks explicitly. However,
> this function does NOT work for transaction-scoped (`_xact_`) locks. Calling it on an xact
> lock will return `false` without releasing anything. Always use `pg_cancel_backend` or
> `pg_terminate_backend` for xact locks.

---

## Troubleshooting

### Cron job logs "skipped: lock not acquired"

This is **expected behavior** when a previous run of the same job is still in progress (or when
the scheduler fires two invocations close together). The non-blocking variant
(`pg_try_advisory_xact_lock`) returns `false` immediately rather than queuing.

**Action**: No action needed if this is occasional. Investigate if it happens on every invocation,
which would indicate the previous run is hanging.

To check if a prior run is genuinely stuck:

```sql
SELECT pid, now() - query_start AS running_for, state, query
FROM pg_stat_activity
WHERE pid IN (
    SELECT pid FROM pg_locks
    WHERE locktype = 'advisory'
      AND classid = 0
      AND objid = <LOCK_ID>
);
```

If `running_for` exceeds the expected cron job duration (typically < 60 seconds), the job has
likely hung. Follow the "Releasing Stuck Locks" procedure above.

### Cron job never acquires lock (stuck for > 5 minutes)

1. Identify the blocking PID using the queries above.
2. Check whether the blocking query is waiting on an external resource (network, MercadoPago API,
   Neon cold start).
3. If the cause is a slow external API call inside a transaction, that is a code bug. External
   API calls MUST NOT be made inside a `withTransaction` callback. File an incident.
4. Cancel or terminate the blocking backend using `pg_cancel_backend` or `pg_terminate_backend`.

### A blocking lock waits for too long

The blocking variant (`pg_advisory_xact_lock`) used for trial machine, publication, quota and
deadline serialization waits until the lock is available. A `SET LOCAL statement_timeout` should
be set at the start of the transaction to cap the wait. If the operation times out, PostgreSQL
rolls back and returns an error.

If a user is seeing repeated timeouts on trial or publication transitions:

1. Check whether a prior transaction for that user and vertical is genuinely in progress or hung.
2. Compute the hash-derived key as shown in the registry section and find the blocking PID.
3. Cancel with `pg_cancel_backend` if the prior run is hung.

### No advisory locks showing in pg_locks

If you expect a lock to be held but `pg_locks` shows nothing, confirm:

- The lock was acquired using the `_xact_` variant (not session-level).
- The transaction is still open (not yet committed or rolled back).
- You are querying the correct database (Neon may have multiple branches).

---

## Adding a New Advisory Lock

1. Choose an integer lock ID that does not appear in `packages/db/docs/advisory-locks.md`.
2. Register the new lock in `packages/db/docs/advisory-locks.md` before writing any code.
3. Prefer `pg_try_advisory_xact_lock` (non-blocking) for background jobs.
4. Use `pg_advisory_xact_lock` (blocking) only when waiting is acceptable and a statement timeout
   is set via `SET LOCAL statement_timeout = '5s'`.
5. Never use session-level variants (`pg_advisory_lock` / `pg_advisory_unlock`).

---

## Related Resources

- [ADR-019: Billing Transaction Isolation](../decisions/ADR-019-billing-transaction-isolation.md)
- [Advisory Lock Registry](../../packages/db/docs/advisory-locks.md)
- [ADR-017: PostgreSQL-Specific Features](../decisions/ADR-017-postgres-specific-features.md)
- [Triggers and Constraints Manifest](../../packages/db/docs/triggers-manifest.md)
