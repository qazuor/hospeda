# ADR-019: Billing Transaction Isolation — READ COMMITTED + FOR UPDATE

## Status

Accepted (2026-04-18)

## Context

The Hospeda billing system handles real money: subscription creation, addon purchases, promo code
redemptions, plan changes, and trial conversions. These operations require strong atomicity and
mutual exclusion guarantees to prevent:

- **Double redemptions**: two concurrent requests spending the same promo code or provisioning the
  same addon twice.
- **Lost updates**: two concurrent plan-change requests reading the same subscription state and
  writing conflicting results.
- **Partial failures**: a QZPay webhook recorded without the matching local DB write, or a local DB
  write that succeeds while the downstream notification fails.
- **Concurrent cron overlap**: two instances of the same background job (e.g., addon expiry, dunning)
  running simultaneously in a multi-instance Vercel deployment and processing the same records twice.

PostgreSQL offers several transaction isolation levels. The choice of isolation strategy has
significant impact on throughput, deadlock frequency, and developer ergonomics.

The platform uses Neon (serverless PostgreSQL) with connection pooling in **transaction mode** via
PgBouncer. This constraint rules out session-level advisory locks (`pg_advisory_lock`) because
Neon recycles connections between transactions; a session-level lock acquired on connection A may
never be released if connection A is returned to the pool before the release call.

## Decision

Use **READ COMMITTED isolation + explicit `SELECT FOR UPDATE` row-level locking** as the
transaction safety strategy for all billing mutations.

For cron jobs and background tasks that must not run concurrently, use
**`pg_try_advisory_xact_lock`** (transaction-scoped advisory locks) to provide a single-writer
guarantee across instances.

All billing mutations MUST be wrapped in `withTransaction` (or `withServiceTransaction`). Critical
reads that drive write decisions MUST use `FOR UPDATE` to prevent phantom reads and lost updates
within a single transaction.

## Rationale

### Why not SERIALIZABLE isolation?

| Property | SERIALIZABLE | READ COMMITTED + FOR UPDATE |
|----------|--------------|-----------------------------|
| Isolation guarantee | Full serializability | Per-row locking on explicitly locked rows |
| Throughput | Lower (more aborts under contention) | Higher |
| Deadlock risk | Higher (PostgreSQL uses SSI predicate locks that can deadlock even on disjoint rows under certain patterns) | Lower (only rows you lock can deadlock, and you control which rows you lock) |
| Retry requirement | Application must retry on `serialization_failure` (SQLSTATE 40001) | Retry only needed for explicit lock timeouts |
| Debuggability | Harder (why did this transaction abort?) | Easier (which row was locked and by whom?) |
| Connection pooling compatibility | Compatible | Compatible |

For the billing workload (subscription writes, addon purchases, promo redemptions), the critical
invariants are per-row: "was this promo code already used?", "is this customer's subscription
still in the same state as when we read it?". These questions are answered correctly by locking
the relevant row with `FOR UPDATE` and reading it inside the transaction. SERIALIZABLE provides
stronger guarantees than needed and at a higher cost.

### Why `pg_try_advisory_xact_lock` over session-level locks?

Session-level advisory locks (`pg_advisory_lock`) are **incompatible with Neon transaction
pooling**. PgBouncer in transaction mode reassigns connections after each transaction commit; a
session lock acquired in transaction T1 may never be released if the connection is pooled before
the explicit `pg_advisory_unlock` call is issued.

`pg_try_advisory_xact_lock` is automatically released at transaction commit or rollback, making
it safe with transaction-mode connection pooling. The lock is held for exactly the duration of the
enclosing transaction — no manual release required.

The non-blocking variant (`pg_try_advisory_xact_lock`, returns `false` instead of waiting) is
preferred for cron jobs and background tasks because a second invocation should skip rather than
queue, preventing a backlog of waiting workers.

The blocking variant (`pg_advisory_xact_lock`, waits until the lock is available) is acceptable
only in interactive user-facing paths where waiting is preferable to failing, and only when a
`SET LOCAL statement_timeout` is in place to cap the wait time.

## Implementation

### Billing mutations

All multi-step billing mutations use `withTransaction` or `withServiceTransaction`:

```typescript
await withServiceTransaction(async (ctx) => {
    // Step 1: Read and lock the relevant row
    const subscription = await tx.execute(
        sql`SELECT * FROM billing_subscriptions WHERE id = ${subscriptionId} FOR UPDATE`
    );

    // Step 2: Validate business rules against the locked snapshot
    if (subscription.status !== 'active') {
        throw new BillingError('Subscription is not active');
    }

    // Step 3: Write
    await subscriptionModel.update(subscriptionId, { ... }, ctx.tx);
});
```

### Cron jobs

All cron jobs that must not overlap acquire an advisory lock as the first operation inside a
wrapping transaction:

```typescript
await withTransaction(async (tx) => {
    const result = await tx.execute(
        sql`SELECT pg_try_advisory_xact_lock(${LOCK_ID}) as acquired`
    );
    if (!result.rows[0]?.acquired) {
        return { status: 'skipped', reason: 'lock_not_acquired' };
    }

    // ... cron body — lock auto-releases on tx commit or rollback
});
```

### Promo code redemptions

Promo code validation outside a transaction is **best-effort** and subject to TOCTOU races.
The authoritative redemption path is `redeemAndRecordUsage`, which re-validates the code inside
a `FOR UPDATE` lock:

```typescript
// Usage count checked under FOR UPDATE — race-safe
await tx.execute(sql`SELECT * FROM billing_promo_codes WHERE code = ${code} FOR UPDATE`);
```

## Consequences

### Positive

- No application-level retry logic needed for serialization failures.
- Lock scope is explicit and visible in code — reviewers can trace exactly which rows are locked.
- Advisory locks are automatically released on transaction end; no `finally` blocks required.
- Compatible with Neon transaction-mode connection pooling.
- Deadlocks are theoretically possible but rare because the lock acquisition order is consistent
  (lock the subscription row, then the promo row — not the reverse).

### Negative

- Developers must remember to add `FOR UPDATE` to reads that drive write decisions. This is not
  enforced by the type system; it requires code review discipline.
- Calling `withTransaction` with external API calls (QZPay, MercadoPago) inside the callback is
  forbidden — external calls are not rollback-able. The discipline is: external call first, then
  transaction. This is documented but not enforced by the compiler.
- Advisory lock IDs must be unique across the entire codebase. The registry at
  `packages/db/docs/advisory-locks.md` is the authoritative source; new lock IDs must be
  registered there before use.

### Neutral

- READ COMMITTED is PostgreSQL's default isolation level. No connection-level or session-level
  pragma is needed.
- The advisory lock registry (`packages/db/docs/advisory-locks.md`) serves as a single source
  of truth for all lock IDs.

## Related

- [ADR-006: Integer Monetary Values](ADR-006-integer-monetary-values.md) — why billing stores
  cents in integers.
- [ADR-017: PostgreSQL-Specific Features](ADR-017-postgres-specific-features.md) — advisory locks
  belong to the class of PostgreSQL-specific features that must be explicitly managed.
- [ADR-018: Transaction Propagation Pattern](ADR-018-transaction-propagation-pattern.md) — the
  `ctx.tx` threading model used to propagate transactions through services.
- [packages/db/docs/advisory-locks.md](../../packages/db/docs/advisory-locks.md) — active advisory
  lock registry.
- [docs/guides/billing-advisory-locks-runbook.md](../guides/billing-advisory-locks-runbook.md) —
  operational runbook for managing advisory locks in production.
- SPEC-064: Billing Transaction Safety — the spec that drove this decision.
