# SPEC-064: Billing Transaction Safety

> **Status**: draft
> **Priority**: P1
> **Complexity**: High
> **Origin**: SPEC-053 gaps (GAP-066)
> **Created**: 2026-04-01
> **Updated**: 2026-04-04 (revision 6: exhaustive external verification pass; see Revision History)
> **Depends on**: SPEC-058 (DrizzleClient type, QueryContext), SPEC-059 Phases 1-3 (ServiceContext, withServiceTransaction patterns), SPEC-061 (integration testing infrastructure)
> **Risk**: HIGH (financial-critical code)

---

## Revision History

| Date | Rev | Changes |
|------|-----|---------|
| 2026-04-01 | 0 | Initial draft: 74 lines, 3 phases, 5 affected files |
| 2026-04-03 | 1 | **Exhaustive rewrite**: (1) Removed Phase 1 (ctx threading) -- delegated to SPEC-059 Phase 4 to eliminate duplication; (2) Expanded affected files from 5 to 22 with exact `getDb()` line numbers; (3) Added 7 multi-step operations inventory with current transaction status; (4) Documented advisory lock bug (no-op outside transaction) with fix; (5) Added cron job lock migration (session-level to transaction-level); (6) Added compensating transaction patterns for external QZPay operations; (7) Added connection pooling considerations (Vercel + Neon); (8) Added dedup guard persistence requirements; (9) Replaced vague acceptance criteria with 18 testable conditions; (10) Added detailed testing strategy with 8 test scenarios; (11) Added error handling within transactions section; (12) Corrected estimated effort from 5-7 to 8-12 days; (13) Fixed out-of-scope: webhooks need own spec, not "external integration"; (14) Added dependency graph and implementation order |
| 2026-04-03 | 2 | **Cross-spec boundary fix + detail pass**: (1) **CRITICAL**: Added Phase 0 (billing ctx threading) -- SPEC-059 explicitly puts billing Out of Scope (line 1243), so SPEC-064 must own ctx threading for the 7 billing files in service-core; (2) Fixed "Depends on" to reference SPEC-059 Phases 1-3 (not Phase 4 which does not cover billing); (3) Fixed addon-expiry.job.ts lock line numbers from 146-147 to 146-148; (4) Replaced vague `// ...` in OP-3 code pattern with concrete audit record INSERT; (5) Made compensating events table concrete: use existing `billing_subscription_events` (not new table); (6) Added justification for Schema Option A (dedup via existing table); (7) Added concrete batching guidance for cron job (50 items per batch, re-acquire lock per batch); (8) Standardized all code patterns to use `withTransaction` from `@repo/db`; (9) Added Drizzle ORM version verification note (^0.44.7 confirmed in project); (10) Updated estimated effort from 8-12 to 10-15 days (Phase 0 adds ~2 days); (11) Added Phase 0 acceptance criteria (7 files threaded, all existing tests pass); (12) Updated dependency graph to show Phase 0 as first step; (13) Verified all PostgreSQL claims against official docs (advisory locks, SET LOCAL, transaction pooling) -- all correct |
| 2026-04-03 | 3 | **Exhaustive review pass**: (1) **CRITICAL**: `billing_subscription_events` table lacks `eventType` column -- added Phase 3.5 migration to add `event_type` column (required for dedup and compensating records); (2) Fixed promo-code function names: `getPromoCode()` → `getPromoCodeByCode()` + `getPromoCodeById()`, added missing `bulkCreatePromoCodes()`; (3) Standardized import path from `@repo/db/client` to `@repo/db` (matches codebase convention); (4) Added note about `withTransaction` not supporting isolation level options; (5) Fixed cron batching pattern: replaced offset-based pagination with cursor-based to prevent item skipping during mutations; (6) Defined `DEDUP_WINDOW_MS = 5 * 60 * 1000` (5 minutes) as explicit requirement; (7) Updated SPEC-066 webhook reference (066 is taken by getbyid-relation-loading); (8) All 13 source files and 30+ line references verified correct against codebase; (9) All cross-spec dependencies (058, 059, 060, 061, 063) verified -- no overlaps or contradictions found; (10) Drizzle ORM transaction API verified against official docs (isolation levels, savepoints, rollback behavior all confirmed); (11) PostgreSQL claims (advisory locks, SET LOCAL, transaction pooling) re-verified against official docs |
| 2026-04-03 | 4 | **Completeness & precision pass**: (1) **CRITICAL**: Phase 3.5 was missing Zod schema update -- added requirement to update `SubscriptionEventSchema` in `packages/schemas/src/api/billing/subscription-event.schema.ts` (make `previousStatus`/`newStatus` optional+nullable, add `eventType` field); (2) Added `BILLING_EVENT_TYPES` TypeScript const object for type-safe event type values (prevents string typos); (3) Added concrete recovery mechanism for compensating events (admin query for orphaned events, automated recovery deferred to webhook spec); (4) Added Drizzle savepoint/nested transaction FYI in Error Handling section; (5) Added note about `withTransaction` type lie (`NodePgDatabase` vs runtime `NodePgTransaction`) covered by SPEC-058; (6) Clarified "silent no-op" wording -- technically the lock acquires and auto-releases, not literally a no-op; (7) Verified `bulkCreatePromoCodes` reference in rev 3 is incorrect (function does not exist in codebase) -- documented as errata; (8) All PostgreSQL advisory lock claims re-verified against official docs + Neon pooling docs + pgPedia; (9) Drizzle transaction types verified against installed v0.44.7 type declarations; (10) Cross-spec analysis (SPEC-050 through SPEC-065) confirmed zero overlaps or contradictions |
| 2026-04-03 | 5 | **Function name accuracy pass**: (1) Fixed 4 files with incorrect function names in Affected Files and Phase 0 tables: `promo-code.redemption.ts` (`getRedemptionHistory/getPromoCodeUsageStats` → `incrementPromoCodeUsage/recordPromoCodeUsage`), `addon-expiration.queries.ts` (`getExpiringPurchases/getExpiredPurchases` → `findExpiredAddons/findExpiringAddons`), `addon-user-addons.ts` (`getUserActiveAddons/getAddonPurchaseHistory/getAddonUsageSummary` → `queryUserAddons/queryActiveAddonPurchases/cancelAddonPurchaseRecord`), `notification-retention.service.ts` (`cleanOldNotifications/getRetentionStats` → `markExpired/purgeExpired`); (2) Fixed `notification-retention.service.ts` pattern from "Standalone functions" to "Class (NotificationRetentionService)" with note on class method ctx threading; (3) Added `SET` rollback caveat in Connection Pooling table (SET inside rolled-back tx does NOT persist); (4) Added `validatePromoCode()` clarification: getDb() is in internal helper `checkUserHasPromoUsage()`; (5) Fixed `addon-user-addons.ts` (service-core) multi-step writes column: has UPDATE in `cancelAddonPurchaseRecord`; (6) Added explicit `tryRedeemAtomically`/`applyPromoCode` function names to withTransaction exclusion note; (7) All 15 PostgreSQL/Drizzle/Neon technical claims verified against official docs (14 correct, 1 SET caveat added); (8) Cross-spec analysis (SPEC-050 through SPEC-065) re-confirmed zero overlaps or contradictions; (9) 66/69 code references verified correct, 3 function name errors now fixed |
| 2026-04-04 | 6 | **Exhaustive external verification pass**: (1) Fixed pg_advisory_xact_lock autocommit description: was "acquires and immediately releases" → now "effectively a no-op, no lock visible in pg_locks" (verified against pgPedia + official PostgreSQL docs); (2) Fixed OP-2 step reference: was "Step 12 (lines 225-249)" → "Step 11 (lines 222-249)" (verified against plan-change.ts source); (3) Added Drizzle nested transaction caveat: error is re-thrown to outer scope, outer tx rolls back without try/catch (verified against drizzle-orm@0.44.7 source code); (4) Verified all 15 code references against codebase -- 15/15 correct (including addon-expiry.job.ts 1320 lines with unlock at line 1317); (5) Verified all 11 external technical claims against official docs: 9 fully correct, 2 partially correct (now fixed); (6) Cross-spec analysis (SPEC-050 through SPEC-065) re-confirmed zero overlaps or contradictions; (7) Verified Drizzle ORM v0.44.7 transaction API directly from installed source code (not just docs) |

---

## Problem Statement

Billing services across `packages/service-core/src/services/billing/` and `apps/api/src/services/` have multiple transaction safety gaps that can leave financial data in an inconsistent state:

### 1. Multi-step operations without atomicity

Several billing flows perform multiple database writes in sequence without wrapping them in a transaction. If any step fails mid-way, earlier writes persist while later ones don't, leaving orphaned or inconsistent records.

### 2. Advisory lock executed outside transaction (silent no-op)

`addon-plan-change.service.ts:210` calls `pg_advisory_xact_lock()` but the call is NOT inside a `db.transaction()` block. Per PostgreSQL documentation, `pg_advisory_xact_lock` in autocommit mode is effectively a no-op: the lock is never visibly acquired (no advisory lock row appears in `pg_locks`). **This means the lock provides zero protection** -- it produces no lock at all in autocommit mode, offering no mutual exclusion.

### 3. In-memory dedup guard insufficient for production

`addon-plan-change.service.ts:43-56` uses a `Map<string, number>` for dedup. This guard:
- Does NOT survive server restarts
- Does NOT work across multiple Vercel serverless instances
- Can allow duplicate recalculations in production

### 4. Session-level advisory lock in cron incompatible with connection pooling

`addon-expiry.job.ts:146-148` uses `pg_try_advisory_lock(43001)` (session-level). With Vercel + Neon transaction pooling (the default), session-level locks can "leak" to other requests that receive the same pooled connection. Only `pg_advisory_xact_lock` / `pg_try_advisory_xact_lock` are safe with transaction pooling.

### 5. No compensating transactions for external operations

Plan changes and subscription cancellations involve external QZPay API calls that cannot be rolled back. When the external call succeeds but subsequent DB writes fail, the system enters an inconsistent state with no automated recovery.

### 6. Billing functions lack transaction context parameter

The 7 standalone billing files in `packages/service-core/src/services/billing/` call `getDb()` directly (19 total call sites). Without a `ctx?: QueryContext` parameter, callers cannot pass a transaction object, making it impossible to compose these functions into larger atomic operations.

**Note on SPEC-059 boundary**: SPEC-059 (service-layer transaction support) explicitly declares billing services Out of Scope (line 1243). SPEC-059 Phase 4 covers ONLY the 6 `BaseCrudService` hook migrations (AccommodationService, AccommodationReviewService, DestinationReviewService, DestinationService, EventService, PostService). **SPEC-064 Phase 0 is the sole owner** of `ctx?: QueryContext` threading for all 7 billing files in `packages/service-core/src/services/billing/` (19 `getDb()` call sites). This boundary is explicitly agreed upon by both specs. **Verification**: After SPEC-064 Phase 0 is complete, all 7 billing files will have `ctx?: QueryContext` on exported functions. After SPEC-059 Phase 4 is complete, all 6 CRUD services will have `_ctx: ServiceContext` on hooks. There is zero overlap between these two sets of files.

---

## Affected Files -- Complete Inventory

### service-core billing functions (Phase 0 of THIS SPEC handles ctx threading)

| File | Pattern | getDb() lines | Multi-step writes | Current tx |
|------|---------|---------------|-------------------|------------|
| `packages/service-core/.../billing/settings/billing-settings.service.ts` | Class, no BaseCrudService | 117, 169, 214 | No | None |
| `packages/service-core/.../billing/promo-code/promo-code.crud.ts` | Standalone functions | 82, 143, 184, 228, 301, 347 | Yes (bulk creates/updates) | None |
| `packages/service-core/.../billing/promo-code/promo-code.redemption.ts` | Standalone functions | 144, 193 | Yes (SELECT FOR UPDATE + UPDATE + INSERT) | **withTransaction at lines 71, 301** |
| `packages/service-core/.../billing/promo-code/promo-code.validation.ts` | Standalone functions | 155 | No | None |
| `packages/service-core/.../billing/addon/addon-expiration.queries.ts` | Standalone functions | 174, 251 | No | None |
| `packages/service-core/.../billing/addon/addon-user-addons.ts` | Standalone functions | 247, 328, 359 | Yes (UPDATE in cancelAddonPurchaseRecord) | None |
| `packages/service-core/.../billing/notification/notification-retention.service.ts` | Class (NotificationRetentionService) | 69, 102 | No | None |

### API layer billing services (THIS SPEC handles transaction wrapping)

| File | Pattern | getDb() lines | Multi-step writes | Current tx | Risk |
|------|---------|---------------|-------------------|------------|------|
| `apps/api/src/services/addon-plan-change.service.ts` | Standalone function | None (uses `db` param) | Yes (multi-limit updates) | **Advisory lock (broken)** | **CRITICAL** |
| `apps/api/src/services/addon.user-addons.ts` | Service functions | 96 | Yes (UPDATE + nested recalc) | **db.transaction at 150** | HIGH |
| `apps/api/src/services/addon.checkout.ts` | Service functions | 449 | Yes (single INSERT) | **db.transaction at 475** | LOW |
| `apps/api/src/services/addon-plan-change.helpers.ts` | Pure helpers | None | No | N/A | NONE |
| `apps/api/src/services/addon-downgrade-detection.service.ts` | Service function | None | No (fire-and-forget notifications) | N/A | LOW |
| `apps/api/src/services/addon-entitlement.service.ts` | Service function | 527 | No | None | LOW |
| `apps/api/src/services/billing-usage.service.ts` | Service functions | 80, 182 | No | None | LOW |
| `apps/api/src/services/billing-metrics.service.ts` | Service functions | 166, 314, 377, 434 | No | None | LOW |
| `apps/api/src/services/trial.service.ts` | Service functions | 559, 697 | No | None | LOW |
| `apps/api/src/services/notification-retry.service.ts` | Service function | 90 | No | None | LOW |
| `apps/api/src/services/addon.admin.ts` | Service functions | 108, 273, 412 | No | None | LOW |

### API layer billing routes (THIS SPEC handles transaction wrapping)

| File | Multi-step writes | Current tx | Risk |
|------|-------------------|------------|------|
| `apps/api/src/routes/billing/admin/subscription-cancel.ts` | Yes (Phase 1: QZPay revocations + Phase 2: DB updates) | **db.transaction at 332 (Phase 2 only)** | MEDIUM |
| `apps/api/src/routes/billing/plan-change.ts` | Yes (QZPay change + addon recalc) | None | **HIGH** |

### Cron jobs (THIS SPEC fixes advisory lock pattern)

| File | Advisory lock | Lock type | Risk |
|------|--------------|-----------|------|
| `apps/api/src/cron/jobs/addon-expiry.job.ts` | Lines 146-148 (acquire), 1317 (release) | `pg_try_advisory_lock(43001)` / `pg_advisory_unlock(43001)` -- **session-level** | **HIGH with connection pooling** |

---

## Multi-Step Operations Inventory

These are all billing operations that perform multiple writes and need transaction safety analysis:

### OP-1: Subscription cancellation (subscription-cancel.ts)

**Current state**: Two-phase pattern.
- Phase 1 (lines 183-324): Iterates active addon purchases, calls `billing.addons.revoke()` on QZPay for each. **No transaction** (external calls).
- Phase 2 (lines 332-400): Wraps DB updates in `db.transaction()`. Includes race-condition guard (re-checks subscription status). Updates `billing_addon_purchases` to 'canceled', updates `billing_subscriptions` to 'cancelled', inserts audit event.

**Gap**: If Phase 1 partially succeeds (2 of 3 addons revoked in QZPay) but Phase 2 fails, the subscription remains active in the DB while some addon limits are already revoked in QZPay. No compensating transaction exists.

**Fix**: Add compensating transaction record. After Phase 1, persist the list of successfully revoked addons. If Phase 2 fails, a recovery job can read this record and either retry Phase 2 or re-grant the revoked addons.

### OP-2: Plan change with addon recalculation (plan-change.ts)

**Current state**: Steps 1-10 validate and call `billing.subscriptions.changePlan()` on QZPay. Step 11 (lines 222-249) calls `handlePlanChangeAddonRecalculation()` in a try/catch that logs errors but does NOT fail the response.

**Gap**: If QZPay plan change succeeds but addon recalculation fails:
- User's subscription plan is updated in QZPay
- Addon limits remain at old plan's values
- Mismatch persists until manual intervention or webhook safety net fires

**Fix**: Wrap the entire local DB portion (subscription status update + addon recalculation) in a single transaction. The QZPay call remains outside (external, can't rollback). If the local transaction fails, log a compensating event for manual review. The webhook safety net in `subscription-logic.ts` already provides eventual consistency, but document this as an explicit design decision.

### OP-3: Addon plan-change recalculation (addon-plan-change.service.ts)

**Current state**: Processes each `limitKey` sequentially, calling `billing.limits.set()` per limit. Advisory lock at line 210 is a **no-op** (outside transaction).

**Gap**: If 1 of 3 limit updates fails, the other 2 are already committed. Limits are partially updated.

**Fix**:
1. Wrap the entire function body (from advisory lock acquisition through all limit updates) in `withTransaction()`.
2. Move `pg_advisory_xact_lock` inside the transaction so it actually works.
3. Batch all limit updates within the same transaction.

**Code pattern**:
```typescript
// BEFORE (broken):
const lockId = hashCustomerId(customerId);
await db.execute(sql`SELECT pg_advisory_xact_lock(${lockId})`); // NO-OP!
// ... limit updates outside transaction ...

// AFTER (correct):
const result = await withTransaction(async (tx) => {
    // Set timeout to prevent indefinite hangs
    await tx.execute(sql`SET LOCAL statement_timeout = '30000'`);

    // Advisory lock is now inside a real transaction
    const lockId = hashCustomerId(customerId);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockId})`);

> **Advisory lock timeout guidance (added 2026-04-04, cross-spec conflict resolution HIGH-007)**: `pg_advisory_xact_lock()` blocks indefinitely if another session holds the lock. To prevent hanging:
> 1. The `SET LOCAL statement_timeout = '30000'` (already shown above) applies to ALL statements including lock acquisition
> 2. If the lock cannot be acquired within the statement timeout, PostgreSQL raises `ERROR: canceling statement due to statement timeout`
> 3. This error propagates through Drizzle and triggers transaction rollback automatically
> 4. **Alternative (non-blocking)**: Consider using `pg_try_advisory_xact_lock(lockId)` which returns `false` immediately if the lock is held, combined with retry logic:
>    ```typescript
>    const lockResult = await tx.execute(sql`SELECT pg_try_advisory_xact_lock(${lockId}) as acquired`);
>    if (!lockResult.rows[0]?.acquired) {
>      throw new ServiceError('LOCK_UNAVAILABLE', 'Another recalculation is in progress for this customer');
>    }
>    ```
> 5. The non-blocking approach is recommended for user-facing endpoints. The blocking approach is acceptable for cron/background jobs where waiting is tolerable.

    const recalcResults: RecalcResult[] = [];

    // All limit updates within the same transaction
    for (const [limitKey, purchases] of groupedByLimit) {
        const newMax = newPlanBase + sumIncrements(purchases);
        await billing.limits.set({ limitKey, value: newMax }); // QZPay call (external, not rolled back)

        // Record each limit update as audit trail within the transaction
        recalcResults.push({ limitKey, oldValue, newValue: newMax });
    }

    // Write dedup record + audit event atomically with the recalculation
    await tx.insert(billingSubscriptionEvents).values({
        subscriptionId,
        eventType: 'ADDON_RECALC_COMPLETED',
        metadata: { oldPlanId, newPlanId, limits: recalcResults },
    });

    return recalcResults;
});
```

**Important**: `billing.limits.set()` is an external QZPay API call. It cannot participate in the DB transaction. The transaction protects the LOCAL DB state (audit logs, dedup records). If a QZPay call fails mid-loop, the transaction rolls back the local state, and the entire operation can be retried safely.

### OP-4: Promo code redemption (promo-code.redemption.ts)

**Current state**: Already uses `withTransaction()` at lines 71 and 301 with `SELECT ... FOR UPDATE` row locking. This is the CORRECT pattern.

**Gap**: None. This is a reference implementation.

**Action**: Preserve as-is. Use as reference for other billing operations.

### OP-5: Addon cancellation with limit recalculation (addon.user-addons.ts)

**Current state**: Uses `db.transaction()` at line 150 wrapping both the purchase status UPDATE and the `recalculateAddonLimitsForCustomer()` call.

**Gap**: The nested `recalculateAddonLimitsForCustomer()` call may perform its own external QZPay calls within the transaction scope. If the external call is slow, the transaction holds open longer than necessary.

**Action**: Verify that the transaction scope is correct. If `recalculateAddonLimitsForCustomer` makes external calls, consider splitting: DB writes in transaction, external calls outside.

### OP-6: Addon expiry cron job (addon-expiry.job.ts)

**Current state**: Uses session-level `pg_try_advisory_lock(43001)` at line 146, manually released at line 1317 in `finally` block.

**Gap**: Session-level locks are unsafe with Neon transaction pooling (Vercel default). The lock can leak to a different request's connection.

**Fix**: Wrap the cron execution in a `withTransaction()` block and use `pg_try_advisory_xact_lock(43001)` instead. The lock auto-releases on transaction end. Remove the manual `pg_advisory_unlock` call.

**Code pattern**:
```typescript
// BEFORE (session-level, unsafe with pooling):
const lockResult = await lockDb.execute(
    sql`SELECT pg_try_advisory_lock(43001) as acquired`
);
// ... work ...
// finally:
await lockDb.execute(sql`SELECT pg_advisory_unlock(43001)`);

// AFTER (transaction-level, safe with pooling):
const result = await withTransaction(async (tx) => {
    const lockResult = await tx.execute(
        sql`SELECT pg_try_advisory_xact_lock(43001) as acquired`
    );
    const acquired = (lockResult.rows?.[0] as Record<string, unknown>)?.acquired;
    if (!acquired) {
        return { skipped: true, reason: 'lock_not_acquired' };
    }

    await tx.execute(sql`SET LOCAL statement_timeout = '120000'`); // 2 min for cron

    // ... all cron work using tx ...

    return { skipped: false, processed, errors };
});
// Lock auto-released on transaction commit/rollback. No manual unlock needed.
```

**Caveat**: The cron job is long-running (processes multiple purchases). A long-held transaction may hit `idle_in_transaction_session_timeout` (Neon default: 300s). Two approaches:

**Option A (recommended for < 100 purchases): Single transaction with timeout guard**
```typescript
await tx.execute(sql`SET LOCAL statement_timeout = '120000'`); // 2 minutes
```

**Option B (recommended for >= 100 purchases): Batched transactions with cursor-based pagination**
Process purchases in batches of 50. Each batch gets its own transaction + advisory lock. **IMPORTANT**: Use cursor-based pagination (last seen ID), NOT offset-based, because items are being mutated (expired) during processing -- offset-based pagination would skip items.
```typescript
const BATCH_SIZE = 50;
let lastSeenId: string | null = null;
let hasMore = true;

while (hasMore) {
    const batchResult = await withTransaction(async (tx) => {
        const lockResult = await tx.execute(
            sql`SELECT pg_try_advisory_xact_lock(43001) as acquired`
        );
        if (!lockResult.rows?.[0]?.acquired) {
            return { skipped: true, lastId: null, count: 0 };
        }
        await tx.execute(sql`SET LOCAL statement_timeout = '30000'`);

        const conditions = [/* expiry conditions */];
        if (lastSeenId) {
            conditions.push(gt(billingAddonPurchases.id, lastSeenId));
        }

        const batch = await tx.select().from(billingAddonPurchases)
            .where(and(...conditions))
            .orderBy(asc(billingAddonPurchases.id))
            .limit(BATCH_SIZE);

        for (const purchase of batch) {
            // Process individual purchase within this batch transaction
        }

        return {
            skipped: false,
            lastId: batch.length > 0 ? batch[batch.length - 1].id : null,
            count: batch.length,
        };
    });

    if (batchResult.skipped) break;
    lastSeenId = batchResult.lastId;
    hasMore = batchResult.count === BATCH_SIZE;
}
```
Each batch transaction holds the advisory lock for at most 30 seconds. Between batches, the lock is released and re-acquired, allowing other cron instances to detect that work is in progress.

### OP-7: Webhook event processing (event-handler.ts) -- OUT OF SCOPE

**Current state**: Status checks happen outside transactions. Race condition exists between SELECT (check if event already processed) and the processing itself.

**Why out of scope**: Webhook processing has its own idempotency model (optimistic INSERT, retry job, dead letter queue) that deserves a dedicated spec. The patterns needed (idempotent event processing, exactly-once delivery guarantees, dead letter retry) are substantially different from billing transaction safety.

**Recommendation**: Create a dedicated spec (SPEC-067 or later, since SPEC-066 is taken by getbyid-relation-loading) for webhook transaction safety.

---

## Proposed Solution

### Prerequisite: SPEC-058 (QueryContext type)

SPEC-058 defines the `QueryContext` interface (containing `tx?: DrizzleClient`) and `DrizzleClient` type. These types MUST exist before Phase 0 begins. SPEC-059 Phases 1-3 (ServiceContext, withServiceTransaction, hookState isolation) are independent of billing work and do NOT need to be completed first.

### Phase 0: Billing ctx threading

**Scope**: All 7 files in `packages/service-core/src/services/billing/` listed in the Affected Files inventory above.

**Why this is here (not in SPEC-059)**: SPEC-059 explicitly declares billing services Out of Scope (line 1243). SPEC-059 Phase 4 only covers `BaseCrudService` hooks. Billing services are standalone functions that do not extend `BaseCrudService`, so their ctx threading belongs in SPEC-064.

**Changes per file**:

For each of the 19 `getDb()` call sites across the 7 files:

1. Add `ctx?: QueryContext` as the last parameter to each exported function
2. Replace `getDb()` with `ctx?.tx ?? getDb()`
3. When a function calls another billing function internally, propagate `ctx` to the inner call
4. Update JSDoc to document the new `ctx` parameter
5. Update corresponding unit tests to verify `ctx` propagation (mock `ctx.tx` and verify it is used instead of `getDb()`)

**File-by-file changes**:

| File | getDb() sites | Functions to update |
|------|--------------|---------------------|
| `billing-settings.service.ts` | 3 (lines 117, 169, 214) | `getSettings()`, `updateSettings()`, `resetSettings()` |
| `promo-code.crud.ts` | 6 (lines 82, 143, 184, 228, 301, 347) | `createPromoCode()`, `getPromoCodeByCode()`, `getPromoCodeById()`, `updatePromoCode()`, `deletePromoCode()`, `listPromoCodes()` |
| `promo-code.redemption.ts` | 2 (lines 144, 193) | `incrementPromoCodeUsage()`, `recordPromoCodeUsage()` (note: `withTransaction` calls at lines 71/301 in `tryRedeemAtomically()`/`applyPromoCode()` already manage their own tx -- do NOT wrap those in `ctx.tx`) |
| `promo-code.validation.ts` | 1 (line 155) | `validatePromoCode()` (via internal helper `checkUserHasPromoUsage()`) |
| `addon-expiration.queries.ts` | 2 (lines 174, 251) | `findExpiredAddons()`, `findExpiringAddons()` |
| `addon-user-addons.ts` | 3 (lines 247, 328, 359) | `queryUserAddons()`, `queryActiveAddonPurchases()`, `cancelAddonPurchaseRecord()` |
| `notification-retention.service.ts` | 2 (lines 69, 102) | `markExpired()`, `purgeExpired()` (methods of `NotificationRetentionService` class) |

**Important**: Functions that already use `withTransaction()` internally (like `tryRedeemAtomically` at line 71 and `applyPromoCode` at line 301 in `promo-code.redemption.ts`) should NOT receive `ctx`. These functions own their transaction lifecycle. Only add `ctx` to functions that perform standalone queries via `getDb()`.

**Note on `notification-retention.service.ts`**: This file uses a class pattern (`NotificationRetentionService`), not standalone functions. Add `ctx?: QueryContext` as an optional parameter to the `markExpired()` and `purgeExpired()` methods. The `runRetentionPolicy()` method delegates to both and should propagate `ctx`.

**Pattern**:
```typescript
import type { QueryContext } from '@repo/db';

// BEFORE:
export async function listPromoCodes({ filters }: ListPromoCodesParams) {
    const db = getDb();
    return db.select().from(billingPromoCodes).where(...);
}

// AFTER:
export async function listPromoCodes({ filters, ctx }: ListPromoCodesParams & { ctx?: QueryContext }) {
    const db = ctx?.tx ?? getDb();
    return db.select().from(billingPromoCodes).where(...);
}
```

### Phase 1: Fix advisory lock in addon-plan-change.service.ts

**Scope**: `apps/api/src/services/addon-plan-change.service.ts`

**Changes**:
1. Wrap the function body (from step 0b onwards) in `withTransaction(async (tx) => { ... })`
2. Move `pg_advisory_xact_lock` call inside the transaction (use `tx.execute()` instead of `db.execute()`)
3. Pass `tx` to all DB queries inside the function (purchases SELECT, any audit writes)
4. Keep external `billing.limits.set()` calls as-is (they're QZPay API calls, not DB)
5. On any failure inside the transaction, all local DB changes rollback. The function can be retried.

**Note on `billing.limits.set()` inside transaction**: These are external HTTP calls to QZPay. They do NOT participate in the DB transaction. If limit 2 of 3 fails, the DB transaction rolls back local audit state. The 2 already-set limits in QZPay remain. This is acceptable because:
- The entire function is idempotent (re-running sets all limits to the correct values)
- The webhook safety net in `subscription-logic.ts` provides eventual consistency
- Advisory lock prevents concurrent partial updates for the same customer

### Phase 2: Migrate cron advisory lock to transaction-level

**Scope**: `apps/api/src/cron/jobs/addon-expiry.job.ts`

**Changes**:
1. Replace `pg_try_advisory_lock(43001)` with `pg_try_advisory_xact_lock(43001)` inside a transaction
2. Remove manual `pg_advisory_unlock(43001)` from `finally` block (auto-released)
3. Use `tx` for all DB operations inside the cron job
4. Consider batching: if the cron job processes many items, use smaller transactions per batch with the advisory lock re-acquired per batch to avoid long-held transactions

**Lock ID convention**: Use namespace `43001` (already established). Document the full namespace registry:

| Lock ID | Owner | Purpose |
|---------|-------|---------|
| 43001 | addon-expiry.job.ts | Prevent overlapping cron executions |
| `hashCustomerId(id)` | addon-plan-change.service.ts | Per-customer recalculation serialization |

> **Advisory Lock Registry**: Lock ID `43001` (addon-expiry) and hash-derived per-customer lock IDs must be documented in `packages/db/docs/advisory-locks.md` (create if not exists). See also: `43010` (OwnerPromotion archive cron, SPEC-063). A centralized registry prevents lock ID collisions across specs.

### Phase 3: Wrap multi-step billing operations in transactions

For each operation listed in the inventory above:

**OP-1 (subscription-cancel.ts)**: Add compensating transaction logging. **Requires Phase 3.5** (the `eventType` column must exist).
- After Phase 1 QZPay revocations succeed, write a `billing_subscription_events` record with `eventType = 'ADDON_REVOCATIONS_PENDING'` and `metadata` containing the list of successfully revoked addon purchase IDs.
- This INSERT happens BEFORE Phase 2 `db.transaction()`, so it persists even if Phase 2 fails.
- If Phase 2 DB transaction fails, the compensating record enables manual or automated recovery (a recovery job queries for `ADDON_REVOCATIONS_PENDING` events without a corresponding `SUBSCRIPTION_CANCELLED` event).
- On Phase 2 success, the `ADDON_REVOCATIONS_PENDING` event remains as an audit trail (no cleanup needed).
- Phase 2 transaction remains as-is (already correct).

**Compensating record schema** (uses existing `billing_subscription_events` table):
```typescript
await db.insert(billingSubscriptionEvents).values({
    subscriptionId,
    eventType: 'ADDON_REVOCATIONS_PENDING',
    metadata: {
        revokedAddonPurchaseIds: ['purchase-1', 'purchase-2'],
        failedAddonPurchaseIds: [],  // If Phase 1 had partial failures
        timestamp: new Date().toISOString(),
    },
});
```

**OP-2 (plan-change.ts)**: Wrap local DB updates in transaction. **Requires Phase 3.5** (the `eventType` column must exist for compensating events).
- The QZPay `billing.subscriptions.changePlan()` call stays outside (external).
- After QZPay succeeds, open a `withTransaction()` for: local subscription status update + addon recalculation DB writes.
- If the local transaction fails, log a compensating event with `eventType = 'PLAN_CHANGE_LOCAL_FAILED'`. The webhook safety net provides eventual consistency.

**OP-3 (addon-plan-change.service.ts)**: Handled in Phase 1 above.

**Compensating event recovery mechanism**:

Compensating events (`ADDON_REVOCATIONS_PENDING`, `PLAN_CHANGE_LOCAL_FAILED`) are recovery signals. The recovery strategy for this spec is:

1. **Immediate**: The existing webhook safety net in `subscription-logic.ts` provides eventual consistency. When QZPay sends subsequent webhooks (e.g., subscription status change, payment events), the handlers reconcile local DB state with QZPay state.
2. **Manual (Phase 3 scope)**: Admin can query orphaned compensating events via the existing admin billing endpoints. An orphaned event is one where:
   - `ADDON_REVOCATIONS_PENDING` exists without a corresponding `SUBSCRIPTION_CANCELLED` state transition event for the same `subscriptionId` created after it.
   - `PLAN_CHANGE_LOCAL_FAILED` exists without a corresponding successful plan change event.
3. **Automated (deferred)**: A dedicated recovery cron job that periodically scans for orphaned compensating events older than N minutes and retries the failed local operations. This is OUT OF SCOPE for this spec -- defer to the webhook transaction safety spec (SPEC-067 or later).

The key guarantee: **no data is silently lost**. If something fails, there's always a record that can be acted upon.

**OP-5 (addon.user-addons.ts)**: Review the existing transaction at line 150.
- Verify `recalculateAddonLimitsForCustomer()` does not hold the transaction open during external calls.
- If it does, split: DB writes in transaction, external QZPay calls outside.

**OP-6 (addon-expiry.job.ts)**: Handled in Phase 2 above.

### Phase 3.5: Add `event_type` column to `billing_subscription_events`

**Scope**: `packages/db/src/schemas/billing/billing_subscription_event.dbschema.ts` + migration

**Why**: The current `billing_subscription_events` table has columns `previousStatus`, `newStatus`, `triggerSource`, `providerEventId`, `metadata`, `createdAt` -- but NO `eventType` column. Phases 3 and 4 need to store operational event types like `'ADDON_RECALC_COMPLETED'` and `'ADDON_REVOCATIONS_PENDING'` that are NOT subscription state transitions. The existing `triggerSource` column has a different semantic purpose (values like `'webhook'`, `'admin'`, `'system'`).

**Changes**:
1. Add `eventType` column to schema: `eventType: varchar('event_type', { length: 100 })`
   - **Nullable** (existing rows have no event_type; they represent state transitions)
   - Add index: `idx_subscription_events_event_type` on `(eventType, subscriptionId, createdAt)`
2. Generate Drizzle migration via `pnpm db:generate`
3. Make `previousStatus` and `newStatus` nullable (they are NOT applicable to operational events like dedup records)
4. Update the `BillingSubscriptionEventModel` in `packages/db/src/models/billing/` to include the new column

**Schema change**:
```typescript
// ADD to existing pgTable definition:
eventType: varchar('event_type', { length: 100 }),

// CHANGE existing columns to nullable:
previousStatus: varchar('previous_status', { length: 50 }),  // was .notNull()
newStatus: varchar('new_status', { length: 50 }),            // was .notNull()
```

**Event type constant** (define in `packages/service-core/src/services/billing/constants.ts` or co-located):
```typescript
/**
 * Valid event types for billing_subscription_events.event_type column.
 * Use this constant instead of raw strings to prevent typos.
 */
export const BILLING_EVENT_TYPES = {
    /** Marks a completed addon limit recalculation (Phase 4 dedup) */
    ADDON_RECALC_COMPLETED: 'ADDON_RECALC_COMPLETED',
    /** Marks pending QZPay revocations awaiting local DB confirmation (Phase 3 OP-1) */
    ADDON_REVOCATIONS_PENDING: 'ADDON_REVOCATIONS_PENDING',
    /** Marks QZPay plan change succeeded but local transaction failed (Phase 3 OP-2) */
    PLAN_CHANGE_LOCAL_FAILED: 'PLAN_CHANGE_LOCAL_FAILED',
} as const;

export type BillingEventType = (typeof BILLING_EVENT_TYPES)[keyof typeof BILLING_EVENT_TYPES];
```

**Event type values** (document for implementors):

| eventType | Used by | Purpose |
|-----------|---------|---------|
| `null` | Existing state transitions | Legacy rows with previousStatus/newStatus |
| `'ADDON_RECALC_COMPLETED'` | Phase 4 (dedup) | Marks a completed addon limit recalculation |
| `'ADDON_REVOCATIONS_PENDING'` | Phase 3 (OP-1 compensating) | Marks pending QZPay revocations for recovery |
| `'PLAN_CHANGE_LOCAL_FAILED'` | Phase 3 (OP-2 compensating) | Marks QZPay plan change succeeded but local tx failed |

**Zod schema update** (MUST be done alongside DB schema change):

Update `packages/schemas/src/api/billing/subscription-event.schema.ts`:

```typescript
// ADD to SubscriptionEventSchema:
eventType: z
    .string({ message: 'zodError.billing.subscriptionEvent.eventType.invalidType' })
    .max(100, { message: 'zodError.billing.subscriptionEvent.eventType.max' })
    .nullable()
    .optional(),

// CHANGE previousStatus and newStatus to optional + nullable:
previousStatus: z
    .string({ message: 'zodError.billing.subscriptionEvent.previousStatus.invalidType' })
    .max(50, { message: 'zodError.billing.subscriptionEvent.previousStatus.max' })
    .nullable()
    .optional(),
newStatus: z
    .string({ message: 'zodError.billing.subscriptionEvent.newStatus.invalidType' })
    .max(50, { message: 'zodError.billing.subscriptionEvent.newStatus.max' })
    .nullable()
    .optional(),
```

**Why**: The Zod schema in `@repo/schemas` is the source of truth for types. If the DB schema makes `previousStatus`/`newStatus` nullable but the Zod schema keeps them required, API responses for operational events (dedup records, compensating events) will fail runtime validation.

**Backward compatibility**: Existing code that creates state transition events MUST continue providing `previousStatus` and `newStatus` values. The `.nullable().optional()` only allows operational events to omit these fields. Add a JSDoc comment on the schema to document this convention.

**i18n keys**: Add the following error message keys to `@repo/i18n` locale files:
- `zodError.billing.subscriptionEvent.eventType.invalidType`
- `zodError.billing.subscriptionEvent.eventType.max`

### Phase 4: Persist dedup guard to database

**Scope**: `apps/api/src/services/addon-plan-change.service.ts`

**Current**: In-memory `Map<string, number>` (lines 43-56).

**Change**: Replace with a DB-backed dedup check:
1. Before recalculation, query `billing_subscription_events` for a recent recalculation event for this customer within the dedup window.
2. If found, skip. If not, proceed and write the dedup record within the main transaction.
3. Keep the in-memory Map as a **fast-path optimization** (avoid DB round-trip for rapid duplicates), but the DB check is the authoritative guard.

**Schema decision: Reuse `billing_subscription_events`** with the new `event_type` column added in Phase 3.5.

Justification:
- After Phase 3.5, the table has `event_type`, `subscription_id`, `metadata` JSONB, `created_at` -- all needed fields
- A dedicated `billing_dedup_log` table would add a new model and table to maintain for a single use case
- The dedup check is a simple query: "does an `ADDON_RECALC_COMPLETED` event exist for this subscription within the last 5 minutes?"
- Using the existing table means the dedup record doubles as an audit trail (zero extra cost)

**Dedup window**: `DEDUP_WINDOW_MS = 5 * 60 * 1000` (5 minutes). This matches the current in-memory Map window at line 55 of `addon-plan-change.service.ts`. Define as a named constant at module level.

**Dedup check query**:
```typescript
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

const recentRecalc = await tx.select({ id: billingSubscriptionEvents.id })
    .from(billingSubscriptionEvents)
    .where(and(
        eq(billingSubscriptionEvents.subscriptionId, subscriptionId),
        eq(billingSubscriptionEvents.eventType, 'ADDON_RECALC_COMPLETED'),
        gte(billingSubscriptionEvents.createdAt, new Date(Date.now() - DEDUP_WINDOW_MS)),
    ))
    .limit(1);

if (recentRecalc.length > 0) {
    return { skipped: true, reason: 'dedup' };
}
```

**Dedup record** (written atomically within the main transaction -- see OP-3 code pattern):
```typescript
await tx.insert(billingSubscriptionEvents).values({
    subscriptionId,
    eventType: 'ADDON_RECALC_COMPLETED',
    metadata: { oldPlanId, newPlanId, limits: recalcResults },
});
```

### Phase 5: Evaluate BaseCrudService alignment (analysis only)

**Scope**: Analysis document, no code changes.

Evaluate whether any billing services should extend `BaseCrudService`:

| Service | Recommendation | Reason |
|---------|---------------|--------|
| `BillingSettingsService` | Keep standalone | Single-entity CRUD on settings table, no lifecycle hooks needed |
| `promo-code.crud.ts` | Keep standalone | Functions with `SELECT FOR UPDATE` need fine-grained tx control that BaseCrudService doesn't provide |
| `addon-expiration.queries.ts` | Keep standalone | Pure query functions, no CRUD lifecycle |
| `addon-user-addons.ts` | Keep standalone | Orchestration functions, not entity CRUD |

Document findings in an ADR or append to this spec. No refactoring in this spec's scope.

---

## Connection Pooling Considerations (Vercel + Neon)

Hospeda deploys to Vercel with Neon PostgreSQL. Neon defaults to **transaction-mode connection pooling** (PgBouncer). This has critical implications:

### Safe patterns with transaction pooling

| Pattern | Safe? | Why |
|---------|-------|-----|
| `pg_advisory_xact_lock` inside `db.transaction()` | **Yes** | Lock acquired and released within single transaction. Connection returned to pool clean. |
| `pg_try_advisory_xact_lock` inside `db.transaction()` | **Yes** | Same as above, non-blocking variant. |
| `SET LOCAL ...` inside transaction | **Yes** | `SET LOCAL` is scoped to the transaction and auto-reverts. |

### Unsafe patterns with transaction pooling (MUST NOT USE)

| Pattern | Why unsafe |
|---------|-----------|
| `pg_advisory_lock` (session-level) | Lock survives transaction end. Pooler may assign connection to another request, which inherits the lock. |
| `pg_advisory_unlock` (explicit release) | If code fails before reaching unlock, lock leaks to pooled connection. |
| `SET` (without `LOCAL`) | Session-level SET persists across transactions on the same pooled connection. **Caveat**: `SET` inside a transaction that is rolled back does NOT persist -- only committed `SET` changes survive. |

### Action items

1. `addon-expiry.job.ts`: Migrate from `pg_try_advisory_lock` to `pg_try_advisory_xact_lock` (Phase 2)
2. `addon-plan-change.service.ts`: Fix `pg_advisory_xact_lock` to be inside transaction (Phase 1)
3. Audit all `db.execute(sql\`SET ...\`)` calls in billing code to ensure they use `SET LOCAL` if inside transactions

---

## Error Handling Within Transactions

### Drizzle ORM transaction behavior (verified against v0.44.7 docs and source code)

> **Version verification**: Project uses `drizzle-orm: ^0.44.7` (confirmed in `packages/db/package.json`, `apps/api/package.json`, `packages/service-core/package.json`). All claims below were verified against the Drizzle ORM GitHub source (`drizzle-orm/src/node-postgres/session.ts` and `drizzle-orm/src/pg-core/session.ts`) and official documentation.

- `db.transaction(callback)` auto-commits on successful return, auto-rollbacks on thrown exception
- `db.transaction(callback, config)` accepts an optional config with `isolationLevel`, `accessMode`, and `deferrable` options (PostgreSQL-specific)
- Nested transactions are supported via savepoints: `tx.transaction(callback)` creates a SAVEPOINT. If the inner callback throws, the savepoint is rolled back -- but **the error is re-thrown** to the outer scope. Without a try/catch around the inner `tx.transaction()` call, the error bubbles up and causes the outer transaction to roll back as well. To isolate only the inner savepoint, wrap the call in try/catch. **Not needed for this spec's scope** but documented for future reference.
- `tx.rollback()` is typed as `never` -- it throws internally, causing immediate rollback
- The `tx` object extends `PgDatabase` and has the same API as `db`

### `withTransaction` limitation: no isolation level support

The project's `withTransaction()` wrapper (`packages/db/src/client.ts:108-113`) is a simple pass-through that does NOT expose Drizzle's `isolationLevel` option:

```typescript
// Current signature (no config parameter):
export async function withTransaction<T>(
    callback: (tx: NodePgDatabase<typeof schema>) => Promise<T>
): Promise<T>
```

**Known type lie**: The callback parameter is typed as `NodePgDatabase<typeof schema>` but at runtime Drizzle passes `NodePgTransaction<typeof schema>`. These are sibling types (both extend `PgDatabase`), not parent-child. This works via structural typing (duck typing) but is technically incorrect. SPEC-058 (GAP-018) addresses this by introducing `DrizzleClient` as the common base type. **No action needed in this spec** -- `withTransaction` consumers are unaffected because the surface API is identical.

For this spec's billing transactions, the default PostgreSQL isolation level (`read committed`) is sufficient. However, if a future operation requires `serializable` or `repeatable read`, use `db.transaction()` directly with the config parameter:

```typescript
import { getDb } from '@repo/db';
const db = getDb();
await db.transaction(async (tx) => {
    // ...
}, { isolationLevel: 'serializable' });
```

**Decision**: Do NOT extend `withTransaction` in this spec. All billing operations here are safe under `read committed` because they use advisory locks for serialization (not isolation levels). Document this for future reference.

### Error handling rules for this spec

1. **Never catch-and-swallow inside a transaction**. If an error occurs, let it propagate to trigger rollback.
2. **External API calls inside transactions**: If a QZPay call fails, throw to rollback local state. The operation can be retried.
3. **Partial external success**: If 2 of 3 QZPay limit.set() calls succeed and the 3rd fails, the transaction rollback only affects local DB state. The 2 QZPay changes persist. This is acceptable because the operation is idempotent (re-running sets all limits correctly).
4. **Transaction timeout**: Use `SET LOCAL statement_timeout = '30000'` (30s) at the start of long-running billing transactions to prevent indefinite hangs.

### Canonical pattern for billing transactions

All billing transactions in this spec MUST use `withTransaction` from `@repo/db` (a thin wrapper around `db.transaction()`). Do NOT use `db.transaction()` directly in new code -- `withTransaction` ensures the DB is initialized and provides a consistent API.

```typescript
import { withTransaction } from '@repo/db';
import { sql } from 'drizzle-orm';

const result = await withTransaction(async (tx) => {
    // 1. Set timeout to prevent indefinite hangs (ALWAYS first)
    await tx.execute(sql`SET LOCAL statement_timeout = '30000'`);

    // 2. Acquire per-customer advisory lock (when needed)
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockId})`);

    // 3. DB reads using tx
    const purchases = await tx.select().from(billingAddonPurchases).where(...);

    // 4. External API calls (NOT rolled back on failure, but operation is idempotent)
    //    If this throws, the transaction rolls back LOCAL state. QZPay changes persist.
    //    Re-running the operation is safe because QZPay calls are idempotent.
    await billing.limits.set({ limitKey, value: newMax });

    // 5. DB writes using tx (audit trail, dedup records, status updates)
    await tx.insert(billingSubscriptionEvents).values({
        subscriptionId,
        eventType: 'ADDON_RECALC_COMPLETED',
        metadata: { oldPlanId, newPlanId, limits: recalcResults },
    });

    return { success: true, data };
});
// Transaction auto-commits on return, auto-rollbacks on throw.
// Advisory lock auto-releases on commit/rollback.
```

**Import note**: Use `import { withTransaction } from '@repo/db'` (re-exported from `packages/db/src/index.ts`). The implementation lives in `packages/db/src/client.ts` (lines 108-113). The subpath `@repo/db/client` also works but is not used in existing code.

**Reuse of SPEC-059 infrastructure**: Billing transaction operations SHOULD use `withServiceTransaction()` from SPEC-059 as the base transaction wrapper, extending it with advisory lock acquisition as the first operation inside the transaction callback. Do NOT duplicate the `SET LOCAL statement_timeout` logic -- `withServiceTransaction()` already handles this. The billing-specific pattern adds advisory locks on top of the base pattern:

```typescript
await withServiceTransaction(db, async (ctx) => {
  // 1. Acquire advisory lock (billing-specific)
  await ctx.tx.execute(sql`SELECT pg_advisory_xact_lock(${lockId})`);
  // 2. Business logic using ctx.tx
  // ...
});
```

If SPEC-059 is not yet implemented when SPEC-064 work begins, implement the inline pattern as documented and refactor to use `withServiceTransaction()` when SPEC-059 lands.

---

## Testing Strategy

### Integration tests (require SPEC-061 infrastructure)

All tests below require a real PostgreSQL database. Use the test infrastructure from SPEC-061.

**IT-1: Advisory lock prevents concurrent recalculation**
- Start two concurrent `handlePlanChangeAddonRecalculation` calls for the same customer
- Verify the second call blocks until the first completes (or use `pg_try_advisory_xact_lock` and verify it returns false)
- Verify both calls produce correct final state (idempotency)

**IT-2: Transaction rollback on failure**
- Mock a QZPay `billing.limits.set()` call to fail on the 2nd of 3 limits
- Verify the transaction rolls back all local DB changes
- Verify re-running the operation succeeds and sets all 3 limits

**IT-3: Subscription cancellation compensating record**
- Execute subscription cancellation where Phase 1 succeeds but Phase 2 transaction is forced to fail
- Verify compensating event record exists in `billing_subscription_events`
- Verify the compensating record contains the list of revoked addons

**IT-4: Cron job advisory lock prevents overlap**
- Start two concurrent addon-expiry cron executions
- Verify only one acquires the lock; the other returns `skipped: true`

**IT-5: Dedup guard with DB persistence**
- Call `handlePlanChangeAddonRecalculation` twice for the same customer within 5 minutes
- Verify the second call is skipped (dedup)
- Simulate server restart (clear in-memory Map) and call again
- Verify the DB-backed dedup still prevents the duplicate

**IT-6: Plan change with transaction wrapping**
- Execute a plan change where the QZPay call succeeds
- Force the local DB transaction to fail
- Verify a compensating event is logged
- Verify the webhook safety net can recover the state

**IT-7: Promo code redemption under concurrency (regression)**
- Run 10 concurrent redemptions for the same promo code with `maxUsages: 5`
- Verify exactly 5 succeed and 5 fail
- Verify `usageCount` is exactly 5 (no over-redemption)

**IT-8: Long-running transaction timeout**
- Create a transaction with `SET LOCAL statement_timeout = '1000'` (1s)
- Perform a query that takes longer than 1s (e.g., `pg_sleep(2)`)
- Verify the transaction is aborted with a timeout error

### Unit tests (mock DB)

- Verify dedup guard logic (in-memory fast-path + DB fallback)
- Verify `hashCustomerId` produces consistent, non-colliding lock IDs
- Verify compensating event record shape matches expected schema

---

## Acceptance Criteria

### Phase 0: Billing ctx threading
- [ ] All 7 billing files in `packages/service-core/src/services/billing/` have `ctx?: QueryContext` parameter on exported functions that call `getDb()`
- [ ] All 19 `getDb()` call sites replaced with `ctx?.tx ?? getDb()`
- [ ] Functions that already use `withTransaction()` internally (promo-code.redemption.ts lines 71, 301) do NOT receive `ctx`
- [ ] Internal calls between billing functions propagate `ctx`
- [ ] All existing billing unit tests pass without modification (ctx is optional, so existing callers work as before)
- [ ] New unit tests verify `ctx.tx` is used when provided (mock `ctx.tx` and assert queries go through it)
- [ ] `pnpm typecheck` passes across the monorepo

### Phase 1: Advisory lock fix
- [ ] `pg_advisory_xact_lock` in `addon-plan-change.service.ts` is inside a `withTransaction()` block
- [ ] All DB queries inside the function use `tx` (the transaction object), not `db`
- [ ] IT-1 passes: concurrent calls for same customer are serialized
- [ ] IT-2 passes: transaction rollback on partial failure works correctly

### Phase 2: Cron advisory lock migration
- [ ] `addon-expiry.job.ts` uses `pg_try_advisory_xact_lock(43001)` instead of `pg_try_advisory_lock(43001)`
- [ ] Manual `pg_advisory_unlock(43001)` call removed from `finally` block
- [ ] All DB operations inside the cron job use `tx`
- [ ] IT-4 passes: concurrent cron executions are properly serialized

### Phase 3: Multi-step transaction wrapping
- [ ] `subscription-cancel.ts`: Compensating event logged after Phase 1 QZPay revocations
- [ ] `plan-change.ts`: Local DB updates (subscription status + addon recalc) wrapped in single transaction
- [ ] `addon.user-addons.ts`: Verified that existing transaction at line 150 does not hold open during external calls
- [ ] Compensating events use `BILLING_EVENT_TYPES` constant (not raw strings)
- [ ] Orphaned compensating events are queryable via admin billing endpoints (e.g., filter by `eventType`)
- [ ] IT-3 passes: compensating record exists on Phase 2 failure
- [ ] IT-6 passes: plan change compensating event logged on local tx failure

### Phase 3.5: `billing_subscription_events` schema migration
- [ ] `event_type` column added (varchar(100), nullable) to `billing_subscription_events`
- [ ] `previous_status` and `new_status` columns changed to nullable (to support operational events that are not state transitions)
- [ ] Index `idx_subscription_events_event_type` created on `(event_type, subscription_id, created_at)`
- [ ] Drizzle migration generated and applied successfully
- [ ] `BillingSubscriptionEventModel` updated to include `eventType` field
- [ ] `SubscriptionEventSchema` in `packages/schemas/src/api/billing/subscription-event.schema.ts` updated: `eventType` added (nullable, optional), `previousStatus` and `newStatus` changed to `.nullable().optional()`
- [ ] i18n keys added for `eventType` validation messages (`zodError.billing.subscriptionEvent.eventType.*`)
- [ ] `BILLING_EVENT_TYPES` constant defined with all valid event type values
- [ ] Existing records (with null `eventType`) continue to work without issues
- [ ] Existing code creating state transition events still provides `previousStatus`/`newStatus` (backward compatible)
- [ ] All numeric columns in `billing_subscription_events` use `mode: 'number'` with numeric defaults per SPEC-056 pattern (not string defaults)
- [ ] `pnpm typecheck` passes across the monorepo

### Phase 4: Dedup guard persistence
- [ ] DB-backed dedup check queries `billing_subscription_events` for recent `ADDON_RECALC_COMPLETED` events (using new `eventType` column) within 5-minute dedup window **per subscription** (not global)
- [ ] `DEDUP_WINDOW_MS` defined as named constant: `5 * 60 * 1000` (5 minutes). Dedup is per-subscription: within this window, the SAME subscription cannot trigger two concurrent recalculations. Different subscriptions recalculate independently.
- [ ] In-memory Map retained as fast-path optimization (checked first, before DB query)
- [ ] Dedup record (`ADDON_RECALC_COMPLETED` event) written within the main transaction (atomic with the recalculation)
- [ ] IT-5 passes: dedup survives server restart

### Phase 5: BaseCrudService evaluation
- [ ] Analysis document produced with recommendation per billing service
- [ ] No code changes (analysis only)

### Cross-cutting
- [ ] All existing billing tests pass (`pnpm test` in affected packages)
- [ ] `pnpm typecheck` passes across the monorepo
- [ ] `pnpm lint` passes (Biome)
- [ ] IT-7 passes: promo code concurrency regression test
- [ ] No session-level advisory locks remain in billing code

---

## Estimated Effort

11-16 days (increased from 10-15 due to Phase 3.5 migration)

| Phase | Effort | Notes |
|-------|--------|-------|
| Phase 0: Billing ctx threading | 2-3 days | 7 files, 19 call sites, mechanical but must update tests |
| Phase 1: Advisory lock fix | 1-2 days | Straightforward refactor, but needs careful testing |
| Phase 2: Cron lock migration | 1 day | Small change, but cron job is 1321 lines and needs review |
| Phase 3: Multi-step transactions | 3-4 days | Multiple files, compensating transaction patterns |
| Phase 3.5: Schema migration | 0.5-1 day | Add `event_type` column, make status columns nullable, generate migration |
| Phase 4: Dedup persistence | 1-2 days | Uses existing table with new `event_type` column |
| Phase 5: BaseCrudService eval | 0.5 day | Analysis only |
| Integration tests | 2-3 days | 8 test scenarios, require SPEC-061 infrastructure |

---

## Risks

- **Financial impact**: Any regression in billing code affects revenue. Every change needs review by a second engineer.
- **Existing SELECT FOR UPDATE**: `promo-code.redemption.ts` already has correct locking (lines 71, 301). Changes MUST preserve this pattern. IT-7 is the regression guard.
- **Integration test dependency**: Billing tx tests need real DB (SPEC-061). If SPEC-061 is not ready, Phase testing is blocked.
- **Long-held transactions**: Wrapping the cron job in a transaction may hit `idle_in_transaction_session_timeout`. Use batched transactions or `SET LOCAL statement_timeout`.
- **External API calls in transactions**: QZPay calls inside `db.transaction()` cannot be rolled back. This is by design (idempotent operations + webhook safety net), but must be clearly understood by the implementor.
- **Vercel cold starts**: Serverless cold starts may interact with advisory locks if a function times out mid-transaction. PostgreSQL will auto-release `xact`-level locks on connection close.

---

## Out of Scope

- **Ctx threading for non-billing BaseCrudService hooks**: Handled by SPEC-059 Phase 4 (DestinationService, AccommodationReviewService, DestinationReviewService). Billing ctx threading is Phase 0 of THIS spec.
- **Refactoring billing to extend BaseCrudService**: Phase 5 evaluates but does not implement.
- **Webhook event handler transaction safety**: The webhook processing pipeline (`event-handler.ts`, `webhook-retry.job.ts`, `subscription-logic.ts`) has its own idempotency model (optimistic INSERT, retry job, dead letter queue). This deserves a dedicated spec (SPEC-067 or later, since SPEC-066 is taken by getbyid-relation-loading) because the patterns (exactly-once event processing, dead letter retry, idempotent handlers) are fundamentally different from billing CRUD transaction safety.
- **Billing UI changes**: No frontend changes.
- **New billing features**: This spec only hardens existing operations.

---

## Execution Order & Agent Safety Guide

> **For agents**: Read this section before implementing. If prerequisites are not met, STOP and report to the user. This is FINANCIAL-CRITICAL code. Extra caution required.

### Prerequisites (ALL must be merged to `main`)

- [ ] **SPEC-058** (BaseModel Interface Alignment): Provides `DrizzleClient` type and `QueryContext` interface
- [ ] **SPEC-059 Phases 1-3** (Service Context Threading): Provides `ServiceContext`, `withServiceTransaction()` utility
- [ ] **SPEC-061 Phase A** (Integration Test Infrastructure): Provides `withTestTransaction()`, `testData` factories, test DB setup

### Pre-Conditions (MUST verify before starting)

- [ ] SPEC-058 is **merged to `main`**
- [ ] SPEC-059 Phases 1-3 are **merged to `main`**
- [ ] SPEC-061 Phase A is **merged to `main`** (test infrastructure available)
- [ ] `DrizzleClient` is exported from `@repo/db`
- [ ] `withServiceTransaction()` is exported from `@repo/service-core`
- [ ] `withTestTransaction()` is exported from `@repo/db` test helpers
- [ ] `pnpm typecheck` passes on clean `main`

**If ANY of these fail: STOP. Do not start SPEC-064. Report which prerequisite is missing.**

### Position in the Dependency Graph

```
SPEC-058 ── provides DrizzleClient, QueryContext
    │
    ├──► SPEC-059 Phases 1-3 ── provides withServiceTransaction()
    │         │
    │         └──► SPEC-064 (THIS SPEC) ── LAST in the transaction chain
    │
    └──► SPEC-061 Phase A ── provides test infrastructure
              │
              └──► SPEC-064 (THIS SPEC)
```

SPEC-064 is intentionally **last** in the transaction safety chain because:
1. It's the highest-risk spec (financial data)
2. It reuses patterns proven by SPEC-059 (`withServiceTransaction()`)
3. It reuses test infrastructure proven by SPEC-061 (`withTestTransaction()`)
4. Getting the foundation right (058→059→061) reduces risk here

### Reuse of SPEC-059 Infrastructure

Billing transactions MUST use `withServiceTransaction()` from SPEC-059 as the base wrapper. Do NOT duplicate `SET LOCAL statement_timeout` logic. Add advisory locks ON TOP of the base pattern:

```typescript
await withServiceTransaction(db, async (ctx) => {
  // 1. Acquire advisory lock (billing-specific)
  await ctx.tx.execute(sql`SELECT pg_advisory_xact_lock(${lockId})`);
  // 2. Business logic using ctx.tx
});
```

If SPEC-059 is NOT merged when SPEC-064 work begins: **STOP. Wait for SPEC-059.**

### Parallel Safety

| Spec | Conflict Risk | Details |
|------|--------------|---------|
| SPEC-051-055 | None | Different layers entirely. |
| SPEC-060 | None | SPEC-060 is DB model layer. SPEC-064 is billing service layer. No shared files. |
| SPEC-062 | None | API response layer. No shared files. |
| SPEC-063 | Low | SPEC-063 adds advisory lock `43010`. SPEC-064 uses `43001` + hash-derived. No collision. Coordinate via `packages/db/docs/advisory-locks.md`. |
| SPEC-066 | None | Different scope entirely. |

### Agent Instructions

1. **FIRST**: Verify ALL 3 prerequisites are merged (058, 059 Phases 1-3, 061 Phase A)
2. Implement Phase 0: Add `ctx?: QueryContext` to 7 billing files, replace 19 `getDb()` calls
3. Implement Phases 1-4: Advisory locks, dedup guards, compensating events, schema migration
4. For each billing operation: use `withServiceTransaction()` + advisory lock pattern
5. Write integration tests using SPEC-061's `withTestTransaction()` helper
6. Run `pnpm typecheck && pnpm test`
7. **Request second-engineer review** before merging (financial-critical code)

---

## Glossary

| Term | Definition |
|------|-----------|
| **Advisory lock** | PostgreSQL lightweight lock mechanism that lives in shared memory (not disk). Used for application-level mutual exclusion. |
| **`pg_advisory_xact_lock`** | Transaction-scoped advisory lock. Auto-released on COMMIT/ROLLBACK. Safe with connection pooling. |
| **`pg_try_advisory_xact_lock`** | Non-blocking variant. Returns `false` immediately if lock is held. |
| **Compensating transaction** | A record written after an external (non-rollbackable) operation succeeds, enabling recovery if subsequent local operations fail. |
| **Dedup guard** | Mechanism to prevent duplicate processing of the same operation within a time window. |
| **QZPay** | External billing/payment API (MercadoPago wrapper). Calls to QZPay cannot be rolled back. |
| **Transaction pooling** | PgBouncer/Neon mode where connections are returned to the pool after each transaction (not session). Session-level state does not persist. |
