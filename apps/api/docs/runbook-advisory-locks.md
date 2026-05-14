# Runbook: Advisory Locks

Operational runbook for PostgreSQL advisory locks used in the Hospeda API.

**Related documents:**

- [Advisory Lock Registry](advisory-locks.md)
- [ADR-019: Billing Transaction Isolation](../../../docs/decisions/ADR-019-billing-transaction-isolation.md)

---

## Overview

The Hospeda API uses `pg_try_advisory_xact_lock` (transaction-scoped, non-blocking) for two purposes:

1. **Cron job deduplication** — prevents two API instances from running the same job concurrently.
2. **Per-customer mutual exclusion** — serializes plan-change addon recalculations for the same customer.

All locks are automatically released when the enclosing transaction commits or rolls back. No manual
`pg_advisory_unlock` call is ever needed. This is safe for Neon transaction-pooling mode (PgBouncer).

The authoritative list of lock IDs is in [advisory-locks.md](advisory-locks.md).

---

## Diagnostic Queries

### List active advisory locks

```sql
SELECT
    l.locktype,
    l.classid,
    l.objid,
    l.mode,
    l.granted,
    a.pid,
    a.usename,
    a.application_name,
    a.query_start,
    a.state,
    a.wait_event_type,
    a.wait_event,
    left(a.query, 200) AS current_query
FROM pg_locks l
JOIN pg_stat_activity a ON l.pid = a.pid
WHERE l.locktype = 'advisory'
ORDER BY a.query_start;
```

### Identify which cron job holds a specific lock

```sql
-- Replace <LOCK_ID> with the integer lock ID from the registry.
SELECT
    a.pid,
    a.usename,
    a.application_name,
    a.query_start,
    a.state,
    left(a.query, 200) AS current_query
FROM pg_locks l
JOIN pg_stat_activity a ON l.pid = a.pid
WHERE l.locktype = 'advisory'
  AND l.objid = <LOCK_ID>
  AND l.granted = true;
```

### Locks waiting (not yet acquired)

```sql
SELECT
    l.objid AS lock_id,
    a.pid,
    a.query_start,
    a.state,
    left(a.query, 120) AS query
FROM pg_locks l
JOIN pg_stat_activity a ON l.pid = a.pid
WHERE l.locktype = 'advisory'
  AND l.granted = false
ORDER BY a.query_start;
```

### Long-running transactions holding locks

```sql
-- Find transactions open for more than 30 seconds that hold advisory locks.
SELECT
    a.pid,
    a.usename,
    now() - a.xact_start AS duration,
    a.state,
    l.objid AS lock_id,
    left(a.query, 200) AS query
FROM pg_stat_activity a
JOIN pg_locks l ON l.pid = a.pid
WHERE l.locktype = 'advisory'
  AND l.granted = true
  AND a.xact_start < now() - interval '30 seconds'
ORDER BY duration DESC;
```

---

## Recovery Procedures

### Scenario 1: Cron job is stuck and the lock is not releasing

`pg_try_advisory_xact_lock` releases automatically on transaction commit or rollback. A lock that
appears stuck means the transaction is still open. Common causes:

- Long-running query inside the cron job body.
- DB connection leak (client disconnected without closing the transaction).

**Step 1: Confirm the lock is held and identify the PID.**

```sql
SELECT pid, query_start, state, left(query, 200) AS query
FROM pg_locks l
JOIN pg_stat_activity a ON l.pid = a.pid
WHERE l.locktype = 'advisory' AND l.objid = <LOCK_ID> AND l.granted = true;
```

**Step 2: Check if the transaction is genuinely stuck or just slow.**

```sql
SELECT pid, now() - xact_start AS age, state, wait_event_type, wait_event
FROM pg_stat_activity
WHERE pid = <PID>;
```

If `state = 'idle in transaction'` the client is connected but not sending queries — the
transaction is open but idle. If `wait_event = 'Lock'` another lock is blocking it.

**Step 3: Attempt a graceful cancel first.**

```sql
SELECT pg_cancel_backend(<PID>);
```

`pg_cancel_backend` sends a `SIGINT` to the backend. This cancels the current query but leaves the
connection alive. The transaction will roll back and the advisory lock will be released.

**Step 4: If cancel does not work, terminate the connection.**

```sql
SELECT pg_terminate_backend(<PID>);
```

`pg_terminate_backend` forcefully closes the connection. PostgreSQL automatically rolls back any
open transaction, releasing all held locks (including advisory locks).

> **Warning:** Only use `pg_terminate_backend` after confirming the PID belongs to a cron job or
> known service process. Terminating an application-tier connection mid-request will cause the
> request to fail with a 500 error for that user.

---

### Scenario 2: Multiple cron job invocations are queueing (unexpected blocking)

All cron jobs use the **non-blocking** variant (`pg_try_advisory_xact_lock`). If the lock is
already held, the function returns `false` and the job exits immediately with `status: 'skipped'`.
Blocking behavior is only expected for the per-customer plan-change lock (uses
`pg_advisory_xact_lock`, the blocking variant).

If you observe multiple cron invocations waiting on the same advisory lock, verify which variant
is actually in use:

```sql
-- Look at the query column for the backend holding the lock.
SELECT left(query, 300) AS query
FROM pg_stat_activity a
JOIN pg_locks l ON l.pid = a.pid
WHERE l.locktype = 'advisory' AND l.granted = false;
```

If the query text shows `pg_advisory_xact_lock` (without `_try_`) then blocking is expected and
intentional. If it shows `pg_try_advisory_xact_lock` and is still blocking, the Drizzle `execute`
call may be hanging on a separate DB-level issue unrelated to the advisory lock itself.

---

### Scenario 3: Advisory lock ID collision

Each integer lock ID must be globally unique across the entire codebase. Collisions cause two
unrelated cron jobs to accidentally block each other.

**To verify no collisions exist:**

```bash
grep -rn "pg_try_advisory_xact_lock\|pg_advisory_xact_lock" apps/ packages/ \
  | grep -v ".test.ts" | grep -v ".spec.ts"
```

Cross-reference every integer constant with the registry in [advisory-locks.md](advisory-locks.md).

---

## Alert Thresholds and Monitoring

### Recommended Datadog / Sentry alerts

| Metric | Threshold | Action |
|--------|-----------|--------|
| Advisory lock held > 60 s | Warning | Investigate slow query inside cron body |
| Advisory lock held > 300 s | Critical | Run `pg_cancel_backend`, escalate |
| `skipped` result on cron run > 3 consecutive | Warning | Prior run may be stuck |
| `pg_stat_activity` `idle in transaction` > 60 s | Warning | Possible connection leak |

### Neon dashboard

In the Neon console, navigate to **Monitoring → Connections** to see active connections by state.
A spike in `idle in transaction` connections indicates open transactions that are not progressing.

### Log-based alerting

Cron jobs log a structured message on lock skip:

```json
{ "level": "info", "msg": "... lock not acquired, skipping", "lockId": 1001 }
```

If the same lock ID skips more than 3 consecutive scheduled runs, the prior run is likely stuck.
Set up a log-based alert on the `lock not acquired` message grouped by `lockId`.

---

## Lock Release Verification

After terminating a stuck backend, confirm the lock was released:

```sql
SELECT COUNT(*) FROM pg_locks
WHERE locktype = 'advisory' AND objid = <LOCK_ID> AND granted = true;
-- Expected: 0
```

If the count is still 1, the lock was not released. Check if a second connection holds it:

```sql
SELECT pid, usename, state, left(query, 200) AS query
FROM pg_locks l JOIN pg_stat_activity a ON l.pid = a.pid
WHERE l.locktype = 'advisory' AND l.objid = <LOCK_ID>;
```

---

## Escalation Path

1. **L1 (on-call engineer)**: Run diagnostic queries. Attempt `pg_cancel_backend`.
2. **L2 (senior backend)**: If cancel fails, use `pg_terminate_backend`. Review cron logs for root cause.
3. **L3 (platform/DBA)**: If multiple lock IDs are stuck simultaneously, investigate Neon connection pooler
   health. Consider restarting the API tier.
