# SPEC-060 Gap Report: Model Subclass Transaction Propagation

> **Audit Passes**: 5 (Pass 1: 2026-04-09 — 3 agents; Pass 2: 2026-04-09 — 4 agents; Pass 3: 2026-04-09 — 3 agents; Pass 4: 2026-04-10 — 3 agents; Pass 5: 2026-04-10 — 6 agents)
> **Spec Status at time of audit**: draft (code 100% complete, tasks tracking not updated)
> **Conclusion**: Core SPEC-060 implementation is **100% COMPLETE** in production code. All gaps listed below are NEW findings not declared in the original spec — edge cases, inconsistencies, missing tests, and related code in adjacent layers. Pass 2 added 18 new gaps across model, infrastructure, service, and test layers. Pass 3 re-verified all 26 gaps, found 2 resolved (GAP-019, GAP-011 partial), 7 new gaps, and confirmed 23 still open. Pass 4 re-verified all 33 gaps, found 2 more resolved (GAP-007, GAP-017), 5 new gaps, and confirmed 29 still open. EventOrganizer orphan file confirmed deleted. Pass 5 (deepest audit yet, 6 agents across 3 dimensions) found 18 new gaps including CRITICAL structural gap GAP-039 (BaseCrudService zero tx infrastructure) and HIGH logic bug GAP-050 (findAllByAttractionId wrong WHERE clause).

---

## Summary

| Category | Pass 1 | Pass 2 (cumulative) | Pass 3 (cumulative) | Pass 4 (cumulative) | Pass 5 (cumulative) |
|---|---|---|---|---|---|
| Spec requirements verified COMPLETE | All (51 getDb() → getClient(tx), 16 findWithRelations LSP fixes, 7 delegates) | Same | Same (re-verified all 45+ custom methods) | Same (re-verified model layer: 100% clean) | Same |
| Total gaps found (not in spec) | 8 | 26 | 33 | 38 | **56** |
| GAPs FIXED since previous pass | — | 1 (GAP-006) | 2 (GAP-019, GAP-011 partial) | 2 (GAP-007, GAP-017) | 0 |
| Gaps requiring immediate inline fix | 2 | 8 | 13 | 15 | **20** (+GAP-045, 046, 048, 049, 050) |
| Gaps requiring a new SPEC | 3 | 4 | 4 | 4 | **5** (+GAP-039 as SPEC-059 prerequisite) |
| Gaps that are test coverage debt | 0 | 7 | 8 | 10 | **16** (+GAP-051 through GAP-056) |
| Gaps that are process/tracking issues | 1 | 2 | 2 | 2 | 2 |
| Gaps that are SPEC-059 scope | 0 | 0 | 1 | 3 | **4** (+GAP-039) |
| Gaps blocked by GAP-039 | 0 | 0 | 0 | 0 | **5** (GAP-040, 041, 042, 043, 044) |

---

## Verification Results (Spec Requirements)

All acceptance criteria from SPEC-060 were verified as **PASSED**:

| Check | Result |
|---|---|
| Zero `getDb()` calls in model subclasses | ✅ 0 found |
| Zero `import { getDb }` in model subclasses | ✅ 0 found |
| 16 `findWithRelations` overrides with `relations: Record<string, boolean \| Record<string, unknown>>` | ✅ 16 confirmed |
| 16 `findWithRelations` overrides with `tx?: DrizzleClient` | ✅ 16 confirmed |
| 5 `findAll()` delegates use `this.findAll(where, undefined, undefined, tx)` (correct positional) | ✅ All confirmed |
| `count()` delegates use `this.count(where, { tx })` (options object) | ✅ Confirmed |
| `DrizzleClient` type exported from `@repo/db` | ✅ Confirmed |
| `BaseModelImpl.getClient(tx?)` method exists | ✅ Lines 78-80 |
| SPEC-058 status | ✅ completed |
| No duplicate `eventOrganizer.model.ts` at root level | ✅ Confirmed — only `models/event/eventOrganizer.model.ts` exists |
| 9 unmentioned models (accommodationFaq, accommodationIaData, feature, attraction, eventLocation, postSponsor, tag, userBookmark, userIdentity) | ✅ All are pure `BaseModelImpl` wrappers — correctly excluded from scope |
| All 5 billing model subclasses (billingAddonPurchase, billingDunningAttempt, billingNotificationLog, billingSettings, billingSubscriptionEvent) | ✅ All pure BaseModelImpl, no custom methods |
| No TypeScript hacks (`@ts-ignore`, `as any`, type assertions) in fixed models | ✅ Zero found |
| All fixed models use `import type { DrizzleClient }` (not value import) | ✅ Confirmed |
| Export consistency: `DrizzleClient`, `withTransaction`, `DbError`, `BaseModelImpl`, `QueryContext`, `initializeDb` all re-exported from `@repo/db` | ✅ Confirmed |

---

## Gap Status Overview

| Gap | Description | Severity | Pass Found | Status |
|---|---|---|---|---|
| GAP-001 | `findTopRated` uses `tx` inside params object | Medium | 1 | **Open** |
| GAP-002 | `withTransaction` swallows `TransactionRollbackError` | High | 1 | **Open** (also: type doesn't exist — see GAP-015) |
| GAP-003 | `getDb()` returns `NodePgDatabase` not `DrizzleClient` | Medium | 1 | **Open** |
| GAP-004 | `createBillingAdapter()` doesn't accept `DrizzleClient` | Medium | 1 | **Open** |
| GAP-005 | `addon-lifecycle-cancellation.service.ts` non-atomic | High | 1 | **Open** |
| GAP-006 | `addon-plan-change.service.ts` non-atomic loop | Medium | 1 | ✅ **FIXED** (advisory lock + dedup guard) |
| GAP-007 | `migrate-addon-purchases.ts` INSERT + grant non-atomic (+ idempotency bug) | High | 1 | ✅ **FIXED** (idempotency fixed with epoch normalization; INSERT+grant atomicity not addressed — see GAP-005 pattern) |
| GAP-008 | SPEC-055 status still `draft` | Low | 1 | **Open** |
| GAP-009 | `webhook-retry.job.ts` false idempotency claim / race condition | Medium | 2 | **Open** |
| GAP-010 | `addon.admin.ts` `activateAddon` non-atomic (DB + QZPay entitlements) | Medium | 2 | **Open** |
| GAP-011 | `addon-expiration.service.ts` non-atomic + missing reconciliation cron | Medium | 2 | **Partially Fixed** (reconciliation cron exists in addon-expiry.job.ts:1064, but root non-atomicity remains) |
| GAP-012 | `trial.service.ts` can leave 2 active QZPay subscriptions after failed cancel | Low | 2 | **Open** |
| GAP-013 | `notification-retry.service.ts` TOCTOU on retryCount in concurrent execution | Low | 2 | **Open** |
| GAP-014 | `withTransaction` doesn't support nested tx / tx propagation (always creates new) | High | 2 | **Open** |
| GAP-015 | `TransactionRollbackError` type doesn't exist anywhere in the package | High | 2 | **Open** |
| GAP-016 | `getBasePlanLimit()` in `migrate-addon-purchases.ts` calls `getDb()` directly | Medium | 2 | **Open** |
| GAP-017 | Pagination loop bug: uses `firstPage.hasMore` instead of `page.hasMore` in inner loop | Medium | 2 | ✅ **FIXED** (proper `hasMore`/`total` tracking with PAGE_SIZE = 100) |
| GAP-018 | `setDb()` accepts `NodePgDatabase` instead of `DrizzleClient` | Low | 2 | **Open** |
| GAP-019 | `BaseModelImpl.getClient()` lacks JSDoc — no compiler warning if subclass skips tx | Low | 2 | ✅ **FIXED** (JSDoc added at base.model.ts:74-76) |
| GAP-020 | `findPopularTags(limit = 10, tx?)` — `tx` unusable without specifying `limit` explicitly | Medium | 2 | **Open** |
| GAP-021 | SPEC-060 tasks all `pending` despite implementation being 100% complete | Low | 2 | **Open** (process) |
| GAP-022 | `withTransaction` has zero unit tests | High | 2 | **Open** (test debt) |
| GAP-023 | `BaseModelImpl` has zero tx propagation tests for all 13 methods | High | 2 | **Open** (test debt) |
| GAP-024 | 9 models with zero tx propagation tests for their custom methods | High | 2 | **Open** (test debt) |
| GAP-025 | Multiple models with partial tx test coverage (6 gaps) | Medium | 2 | **Open** (test debt) |
| GAP-026 | `BaseModel` name exported as both class (re-export) and interface — ambiguity risk | Low | 2 | **Open** (`@deprecated` JSDoc added, but dual export persists) |
| GAP-027 | `BaseModel` interface from `types.ts` NOT exported from `@repo/db` index | Low | 3 | **Open** |
| GAP-028 | `throwDbError` helper lacks `cause` parameter (cannot chain errors) | Low | 3 | **Open** |
| GAP-029 | `initBillingInstance` accepts `DrizzleClient` but passes to `createBillingAdapter(NodePgDatabase)` — type mismatch | Medium | 3 | **Open** |
| GAP-030 | `runtimeClient` variable typed as `NodePgDatabase` instead of `DrizzleClient` | Medium | 3 | **Open** (part of GAP-003 cluster) |
| GAP-031 | `initializeDb` return type is `NodePgDatabase` instead of `DrizzleClient` | Medium | 3 | **Open** (part of GAP-003 cluster) |
| GAP-032 | 11 service files in `apps/api/src/services/` call `getDb()` directly | Medium | 3 | **Open** (SPEC-059 scope) |
| GAP-033 | 13+ model test files not audited for tx coverage (beyond GAP-024's 9) | Low | 3 | **Open** (test audit gap) |
| GAP-034 | `notification-schedule.job.ts` no concurrency protection (no advisory lock) | Low | 4 | **Open** |
| GAP-035 | `dunning.job.ts` no concurrency protection (no advisory lock) | Low | 4 | **Open** |
| GAP-036 | 27+ test files use `getDb()` mock anti-pattern — blocks tx regression detection | Medium | 4 | **Open** (test debt) |
| GAP-037 | Zero `withTransaction` usage in entire API layer — SPEC-060 has no consumers yet | Medium | 4 | **Open** (SPEC-059 scope) |
| GAP-038 | 18 route handler locations with `getDb()` + multi-step DB operations | Medium | 4 | **Open** (SPEC-059 scope) |
| GAP-039 | `BaseCrudService` lifecycle pipeline has zero tx infrastructure (8 base files, no method accepts tx) | **Critical** | 5 | **Open** (SPEC-059 scope — blocks GAP-040–044) |
| GAP-040 | `DestinationService.update` splits parent row update and descendant path cascade into two separate transactions | High | 5 | **Open** (blocked by GAP-039) |
| GAP-041 | `AccommodationReviewService._afterCreate/_afterUpdate` performs 3+ unwrapped DB writes with no shared tx | High | 5 | **Open** (blocked by GAP-039) |
| GAP-042 | `DestinationReviewService._afterCreate/_afterUpdate` performs 3+ unwrapped DB writes with no shared tx | High | 5 | **Open** (blocked by GAP-039) |
| GAP-043 | `PostSponsorshipService._afterCreate/_beforeSoftDelete` cross-entity writes to Post table without tx; errors silently swallowed | High | 5 | **Open** (blocked by GAP-039) |
| GAP-044 | `AccommodationService._afterCreate` cross-entity write to `destination.accommodationsCount` without tx | Medium | 5 | **Open** (blocked by GAP-039) |
| GAP-045 | `cancelAddonPurchaseRecord` in service-core has no tx param; `revokeAllAddonsForCustomer` iterates without wrapping tx | Medium | 5 | **Open** |
| GAP-046 | `promo-code.crud.ts`: 6 CRUD functions use bare `getDb()`, no tx param — write ops can't join caller transactions | Medium | 5 | **Open** |
| GAP-047 | `QueryContext` interface is dead code — defined/exported from @repo/db, referenced in ADR-018, but zero runtime consumers | Medium | 5 | **Open** |
| GAP-048 | All 15+ `findWithRelations` overrides silently ignore unknown relation keys (no error, no warning) | Medium | 5 | **Open** |
| GAP-049 | 8+ inline `count()` queries across 4 models bypass `BaseModelImpl.count()` and its `Number()` coercion (pg returns bigint as string) | Medium | 5 | **Open** |
| GAP-050 | **LOGIC BUG**: `DestinationModel.findAllByAttractionId` compares `destinations.id` to `attractionId` — returns wrong data | High | 5 | **Open** (fix immediately) |
| GAP-051 | `UserModel` has zero db-layer test file despite 3 complex method overrides (findAll, count, findAllWithCounts) | High (test debt) | 5 | **Open** |
| GAP-052 | `AccommodationModel.search()`/`searchWithRelations()` have zero tests (~90-line complex methods with subqueries) | Medium (test debt) | 5 | **Open** |
| GAP-053 | `find-all-with-relations-tx.test.ts` only tests `AccommodationModel` — no other subclass covered | Low (test debt) | 5 | **Open** |
| GAP-054 | No partial-failure scenario test in tx test file (findMany OK + count fails) | Medium (test debt) | 5 | **Open** |
| GAP-055 | 5 billing models have zero test files at db layer (billingSettings, billingAddonPurchase, etc.) | Low (test debt) | 5 | **Open** |
| GAP-056 | Zero service-core billing service tests in `packages/service-core/test/` | Low (test debt) | 5 | **Open** (SPEC-064 scope) |

---

## Detailed Gap Descriptions

---

### GAP-001 — `findTopRated` accepts `tx` inside params object, not positional

**Audit Pass**: 1 | **Status**: Open
**File**: `packages/db/src/models/accommodation/accommodation.model.ts` ~line 259
**Severity**: Medium | **Priority**: P2 | **Complexity**: Low

**Problem**:
`findTopRated` receives `tx` nested inside a `params` object, while every other custom method in the same file and the entire codebase uses a positional `tx?: DrizzleClient` parameter:

```typescript
// findTopRated (INCONSISTENT — tx inside params object)
public async findTopRated(params: {
    limit?: number;
    destinationId?: string;
    type?: string;
    onlyFeatured?: boolean;
    excludeRestricted?: boolean;
    tx?: DrizzleClient;  // ← INSIDE OBJECT
}): Promise<Accommodation[]> {
    const db = this.getClient(params.tx);

// All other methods in same file (CONSISTENT — positional tx)
public async search(
    params: AccommodationSearchInput & { excludeRestricted?: boolean },
    tx?: DrizzleClient  // ← POSITIONAL
): Promise<{...}> {
    const db = this.getClient(tx);
```

**Impact**: Callers threading transactions (e.g., SPEC-059 Phase 4) must use a different calling convention for this method. Creates confusion and potential for bugs when `tx` is silently not forwarded.

**Proposed Solution**:
```typescript
public async findTopRated(
    params: {
        limit?: number;
        destinationId?: string;
        type?: string;
        onlyFeatured?: boolean;
        excludeRestricted?: boolean;
    },
    tx?: DrizzleClient
): Promise<Accommodation[]> {
    const db = this.getClient(tx);
```

**Action**: Fix inline. No new SPEC needed.

---

### GAP-002 — `withTransaction` swallows all errors, including intentional rollbacks

**Audit Pass**: 1 | **Status**: Open
**File**: `packages/db/src/client.ts` lines 114–128
**Severity**: High | **Priority**: P1 | **Complexity**: Medium

**Problem**:
Every error thrown inside a `withTransaction` callback — including intentional rollbacks via `tx.rollback()`, business logic errors, and network errors — is wrapped indiscriminately in a `DbError`. Callers cannot distinguish between error types:

```typescript
export async function withTransaction<T>(callback: (tx: DrizzleClient) => Promise<T>): Promise<T> {
    const db = getDb();
    try {
        return await db.transaction(callback);
    } catch (error) {
        const cause = error instanceof Error ? error : new Error(String(error));
        throw new DbError(   // ALL errors become DbError, losing original type
            'withTransaction', 'client', undefined,
            `Transaction failed: ${cause.message}`,
            cause
        );
    }
}
```

**Note from Pass 2**: `TransactionRollbackError` as a type does not exist anywhere in the codebase (see GAP-015). The fix for GAP-002 requires first creating this type (GAP-015).

**Impact**: Any code using `tx.rollback()` for conditional abort cannot detect intentional rollbacks vs real DB errors. The `cause` is accessible via `error.cause` but type-checking is impossible. SPEC-059 Phase 4 will be broken if it uses intentional rollbacks.

**Additional issue (Pass 2)**: If the callback throws a `DbError` (already wrapped), `withTransaction` double-wraps it, losing the original context.

**Proposed Solution**:
```typescript
import { TransactionRollbackError } from '@repo/db'; // must be created (see GAP-015)

export async function withTransaction<T>(callback: (tx: DrizzleClient) => Promise<T>): Promise<T> {
    const db = getDb();
    try {
        return await db.transaction(callback);
    } catch (error) {
        if (error instanceof TransactionRollbackError) {
            throw error; // re-throw intentional rollbacks without wrapping
        }
        if (error instanceof DbError) {
            throw error; // avoid double-wrapping
        }
        const cause = error instanceof Error ? error : new Error(String(error));
        throw new DbError('withTransaction', 'client', undefined, `Transaction failed: ${cause.message}`, cause);
    }
}
```

**Action**: Fix inline. Depends on GAP-015 (create `TransactionRollbackError`). Must be resolved before SPEC-059 Phase 4.

---

### GAP-003 — `getDb()` return type is `NodePgDatabase<typeof schema>`, not `DrizzleClient`

**Audit Pass**: 1 | **Status**: Open
**File**: `packages/db/src/client.ts` lines 23, 44, 75, 86
**Severity**: Medium | **Priority**: P3 | **Complexity**: Trivial

**Problem**:
```typescript
let runtimeClient: NodePgDatabase<typeof schema> | null = null;   // line 23
export function initializeDb(pool: Pool): NodePgDatabase<typeof schema>  // line 44
export function setDb(client: NodePgDatabase<typeof schema>): void       // line 75
export function getDb(): NodePgDatabase<typeof schema>                    // line 86
```

`NodePgDatabase<typeof schema>` is structurally compatible with `DrizzleClient`, but the nominal type mismatch creates friction: callers that store the result in a `DrizzleClient` variable get an implicit coercion. Also affects `setDb()` (see GAP-018).

**Proposed Solution**:
```typescript
let runtimeClient: DrizzleClient | null = null;
export function initializeDb(pool: Pool): DrizzleClient { ... }
export function getDb(): DrizzleClient {
    if (!runtimeClient) throw new Error('Database not initialized...');
    return runtimeClient;
}
```

**Action**: Fix inline. No new SPEC needed. Low risk.

---

### GAP-004 — `createBillingAdapter()` accepts `NodePgDatabase` but not `DrizzleClient`

**Audit Pass**: 1 | **Status**: Open
**File**: `packages/db/src/billing/drizzle-adapter.ts` line ~102
**Severity**: Medium | **Priority**: P2 | **Complexity**: Low

**Problem**:
```typescript
export function createBillingAdapter(
    db: NodePgDatabase<typeof schema>,  // blocks transaction injection
    config: QZPayAdapterConfig = {}
): QZPayStorageAdapter
```

A `DrizzleClient` (the union type covering both `NodePgDatabase` and `NodePgTransaction`) cannot be passed here without a type cast. The file's own JSDoc shows `createBillingAdapter(tx, ...)` in examples, creating an internally inconsistent API.

**Evidence from Pass 2**: The double cast `db as unknown as Parameters<typeof createQZPayDrizzleAdapter>[0]` at line ~109 confirms the type friction. Also, `initBillingInstance(db: DrizzleClient)` in `migrate-addon-purchases.ts` line 111 calls `createBillingAdapter(db)` — a type mismatch that TypeScript tolerates via structural compatibility but is nominally incorrect (see GAP-016 consequence).

**Proposed Solution**:
```typescript
import type { DrizzleClient } from '../types.ts';

export function createBillingAdapter(
    db: DrizzleClient,
    config: QZPayAdapterConfig = {}
): QZPayStorageAdapter
```

**Action**: Fix inline. No new SPEC needed. Unblocks GAP-005 and GAP-006 service-layer fixes.

---

### GAP-005 — `addon-lifecycle-cancellation.service.ts`: QZPay revocation and DB update are not atomic

**Audit Pass**: 1 | **Status**: Open
**File**: `apps/api/src/services/addon-lifecycle-cancellation.service.ts` lines ~180–200
**Severity**: High | **Priority**: P1 | **Complexity**: Medium-High

**Problem**:
The service performs two distinct operations per purchase loop iteration WITHOUT atomicity:

1. `revokeAddonForSubscriptionCancellation()` — external call to QZPay (idempotent but side-effectful)
2. `db.update(billingAddonPurchases).set({ status: 'canceled' })` — DB update

If step 2 fails after step 1 completes, the addon is revoked in QZPay but the DB still shows `active`. On retry, step 1 will fail (already revoked) and the status never gets updated to `canceled`, creating a permanent inconsistency.

**Proposed Solution**:
Wrap the DB update in `withTransaction`. For full atomicity (QZPay + DB), an outbox/saga pattern is required but out of scope for an inline fix:

```typescript
for (const purchase of activePurchases) {
    try {
        const revocationResult = await revokeAddonForSubscriptionCancellation({...});
        await withTransaction(async (tx) => {
            await tx.update(billingAddonPurchases)
                .set({ status: 'canceled', canceledAt: new Date(), updatedAt: new Date() })
                .where(eq(billingAddonPurchases.id, purchase.id));
        });
        succeeded.push(revocationResult);
    } catch (err) { ... }
}
```

**Action**: Create a new SPEC (e.g., SPEC-069 or sibling of SPEC-043). Service-layer atomicity concern beyond SPEC-060's model-layer scope. Tag as P1.

---

### GAP-006 — `addon-plan-change.service.ts`: non-atomic limit recalculation loop

**Audit Pass**: 1 | **Status**: ✅ **FIXED**

**Fix confirmed in Pass 2**: The service now uses:
1. `SELECT pg_advisory_xact_lock(lockId)` to prevent concurrent execution
2. A 5-minute dedup guard window to prevent double execution

Each `billing.limits.set()` call is idempotent and each limit key is independent — the design of continuing on individual key failure is intentional and correct. No state inconsistency possible between limit keys.

---

### GAP-007 — `migrate-addon-purchases.ts`: INSERT and entitlement grant are not atomic (+ idempotency bug)

**Audit Pass**: 1 | **Status**: ✅ **FIXED** (Pass 4)

**Fix confirmed in Pass 4**: The idempotency check was rewritten using `customerId + addonSlug + status='active'` with epoch millisecond normalization for timestamp comparison (lines 631–667). The code now references internal bug IDs GAP-038-28/GAP-038-39 in comments. Re-runs correctly detect already-migrated purchases.

**Note**: The INSERT + grant atomicity issue (original Pass 1 concern) was NOT addressed — the grant is still a separate non-transactional step. However, the idempotency logic now correctly allows re-running to retry failed grants, which is the more critical correctness property for a migration script. The full atomicity fix would require GAP-004 (billing adapter type) to be resolved first.

---

### GAP-008 — SPEC-055 status is still `draft` despite implementation being complete

**Audit Pass**: 1 | **Status**: Open
**File**: `.claude/specs/SPEC-055-like-wildcard-escaping/spec.md`
**Severity**: Low | **Priority**: P3 | **Complexity**: Trivial (process only)

**Problem**: SPEC-055 was declared BLOCKING for SPEC-060. The `safeIlike()` helper exists and all callers were updated. Spec status was never updated from `draft`.

**Impact**: Misleads the dependency graph for SPEC-059 Phase 4, which depends on SPEC-060 being complete.

**Proposed Solution**:
1. Update SPEC-055 status to `completed`
2. Update SPEC-060's dependency note to `SPEC-055: resolved`

**Action**: Process fix. No code change needed.

---

### GAP-009 — `webhook-retry.job.ts`: false idempotency claim and race condition

**Audit Pass**: 2 | **Status**: Open
**File**: `apps/api/src/cron/jobs/webhook-retry.job.ts` lines ~419–476
**Severity**: Medium | **Priority**: P2 | **Complexity**: Medium

**Problem**:
The file docstring (lines 11) claims "Idempotent execution (safe to run concurrently)" but this is incorrect. The job has no advisory lock or distributed mutex. If two instances run concurrently (e.g., SIGTERM during execution + cron trigger):

1. Both read the same batch of `unresolvedEvents`
2. Both call `retryWebhookEvent` for the same events
3. Both try to call `markAsResolved` or `incrementAttempts` for the same event IDs

The only protection is that `retryWebhookEvent` checks `billingWebhookEvents.status === 'processed'` (lines 193–200) — but this check is a read-then-act with no lock, creating a TOCTOU window where both instances pass the check and process the same event.

**Secondary issue**: `markAsResolved` (lines 271–278) can fail after the webhook business logic was already executed. Next run will re-process the event. This is mitigated by the `status` check, but only if the billing SDK updated the status atomically.

**Proposed Solution**:
```typescript
// At the top of the cron handler:
const lockAcquired = await db.execute(sql`SELECT pg_try_advisory_lock(${WEBHOOK_RETRY_LOCK_ID})`);
if (!lockAcquired.rows[0].pg_try_advisory_lock === false) {
    logger.info('webhook-retry: another instance is running, skipping');
    return;
}
// Remove false claim from docstring
```

**Action**: Fix inline. Update docstring. No new SPEC needed.

---

### GAP-010 — `addon.admin.ts`: `activateAddon` non-atomic (DB status + QZPay entitlements)

**Audit Pass**: 2 | **Status**: Open
**File**: `apps/api/src/services/addon.admin.ts` lines ~331–366
**Severity**: Medium | **Priority**: P2 | **Complexity**: Medium

**Problem**:
```typescript
// Line 331-344: DB update of status (not in transaction)
await db.update(billingAddonPurchases).set({ status: 'active', ... })...

// Line 347-365: Re-apply entitlements via QZPay (separate, non-atomic)
const entitlementService = new AddonEntitlementService(null);
await entitlementService.applyAddonEntitlements({ ... });
```

If the DB update succeeds but `applyAddonEntitlements` fails, the addon is `active` in the DB but has no active entitlements in QZPay. The code has a `try/catch` that logs a warning but does not revert the status. The result is a "ghost activation" — the DB says active, QZPay says not entitled.

**Proposed Solution**:
Wrap the DB update in `withTransaction`. If entitlement application fails, either:
1. Roll back the DB status to previous state (cleaner), or
2. Mark the purchase with a `needsEntitlementSync` flag and handle via a reconciliation job

```typescript
await withTransaction(async (tx) => {
    await tx.update(billingAddonPurchases).set({ status: 'active', ... });
});
// Apply entitlements outside tx (can't roll back QZPay), but with retry/reconciliation logic
```

**Action**: Create a new mini-SPEC or add to the billing reconciliation SPEC (see GAP-011). P2.

---

### GAP-011 — `addon-expiration.service.ts`: non-atomic + missing reconciliation cron

**Audit Pass**: 2 | **Status**: Open
**File**: `apps/api/src/services/addon-expiration.service.ts` lines ~179–256
**Severity**: Medium | **Priority**: P2 | **Complexity**: Medium-High

**Problem**:
The expiry flow:
1. `removeAddonEntitlements` (QZPay revocation) — can fail
2. `db.update(billingAddonPurchases).set({ status: 'expired' })` — runs **regardless** of step 1 (line 217 comment: "This ALWAYS runs regardless")

If step 1 fails (QZPay error), the addon is marked `expired` in the DB but the entitlements remain active in QZPay. The code sets `metadata: { entitlementRemovalPending: true }` as a flag.

**Critical finding**: There is a TODO at line 214 acknowledging that a reconciliation cron for `entitlementRemovalPending` is missing. The flag is set but never consumed by any job or reconciliation process in the codebase.

**Impact**: Addons can remain entitled in QZPay indefinitely if the initial removal fails, because nothing processes the `entitlementRemovalPending` flag.

**Proposed Solution**:
1. Create a reconciliation cron that queries `billingAddonPurchases` where `metadata->>'entitlementRemovalPending' = 'true'` and retries the entitlement removal
2. Add tests for the `entitlementRemovalPending` recovery path

**Action**: Create a new SPEC for billing reconciliation (covers GAP-010, GAP-011, GAP-012). P2.

---

### GAP-012 — `trial.service.ts`: failed QZPay cancel can leave 2 active subscriptions

**Audit Pass**: 2 | **Status**: Open
**File**: `apps/api/src/services/trial.service.ts` lines ~548–604 and ~684–754
**Severity**: Low | **Priority**: P3 | **Complexity**: Low

**Problem**:
Both `reactivateFromTrial` and `reactivateSubscription` follow this pattern:
1. Create new subscription in QZPay (committed)
2. Attempt to cancel the old trial subscription in QZPay
3. If step 2 fails → log warn and continue ("new subscription is already active")

When step 2 fails, the customer has two active QZPay subscriptions simultaneously with no automatic cleanup. The design is intentional ("create first to avoid service interruption") but there is no reconciliation job to detect and cancel the orphaned trial subscription.

**Impact**: QZPay billing may charge the customer twice. Depends on QZPay's handling of multi-subscription per customer.

**Proposed Solution**:
Add a reconciliation query in the billing monitor that identifies customers with multiple active subscriptions and flags them for manual review or auto-cancels the older one.

**Action**: Add to the billing reconciliation SPEC (same as GAP-010/GAP-011). P3.

---

### GAP-013 — `notification-retry.service.ts`: TOCTOU on `retryCount` in concurrent execution

**Audit Pass**: 2 | **Status**: Open
**File**: `apps/api/src/services/notification-retry.service.ts` lines ~153–231
**Severity**: Low | **Priority**: P3 | **Complexity**: Low

**Problem**:
The service reads `retryCount` from JSONB metadata, then increments it as a separate update:

```typescript
const retryCount = notification.metadata?.retryCount ?? 0;
// ... attempt send ...
await db.update(billingNotificationLog).set({
    metadata: sql`${billingNotificationLog.metadata} || '{"retryCount": ${currentRetryCount + 1}}'::jsonb`
});
```

If two service instances run concurrently (unlikely for a daily cron, but possible during restart scenarios), both read the same `retryCount`, both attempt to send, and both increment to the same value. A notification can be sent more than `MAX_RETRIES` allows.

**Proposed Solution**:
Use an atomic SQL increment: `metadata || jsonb_build_object('retryCount', COALESCE((metadata->>'retryCount')::int, 0) + 1)` combined with a `WHERE metadata->>'retryCount' < MAX_RETRIES` condition in the UPDATE itself. Or use `FOR UPDATE` row lock when reading.

**Action**: Fix inline. No new SPEC needed. Low priority.

---

### GAP-014 — `withTransaction` doesn't support nested tx / tx propagation (always creates new transaction)

**Audit Pass**: 2 | **Status**: Open
**File**: `packages/db/src/client.ts` line 114
**Severity**: High | **Priority**: P2 | **Complexity**: Medium

**Problem**:
```typescript
export async function withTransaction<T>(callback: (tx: DrizzleClient) => Promise<T>): Promise<T> {
    const db = getDb();
    try {
        return await db.transaction(callback); // ALWAYS creates a new top-level transaction
    }
```

There is no way to pass an existing `tx` to participate in an outer transaction. If service A calls `withTransaction` and service B (called from within that callback) also calls `withTransaction`, the inner call will either:
- Error (if the DB driver rejects nested transactions)
- Create an independent transaction (breaking atomicity)
- Open a savepoint (Drizzle supports this via `db.transaction()` nesting, but `withTransaction` doesn't expose this)

This is a blocking problem for SPEC-059 Phase 4, which will chain multiple service calls into a single transaction.

**Proposed Solution**:
```typescript
export async function withTransaction<T>(
    callback: (tx: DrizzleClient) => Promise<T>,
    existingTx?: DrizzleClient
): Promise<T> {
    if (existingTx) {
        return callback(existingTx); // join existing transaction (participate as savepoint)
    }
    const db = getDb();
    try {
        return await db.transaction(callback);
    } catch (error) {
        // ... (see GAP-002 fix)
    }
}
```

**Action**: Fix inline as part of SPEC-059 Phase 4 prep. No new SPEC needed. Blocks SPEC-059.

---

### GAP-015 — `TransactionRollbackError` type doesn't exist anywhere in the package

**Audit Pass**: 2 | **Status**: Open
**File**: `packages/db/src/` (missing file)
**Severity**: High | **Priority**: P1 | **Complexity**: Low

**Problem**:
The SPEC-060 spec references `TransactionRollbackError` in the context of rollback handling, and GAP-002 requires re-throwing it instead of wrapping in `DbError`. However, this type does not exist in the `@repo/db` package — not in `types.ts`, not in `utils/error.ts`, not exported from `index.ts`.

Drizzle ORM v0.44 does not publicly export a `TransactionRollbackError`. When `tx.rollback()` is called, Drizzle internally throws an error to abort the transaction, but it is not exported as a stable type from the package.

**Impact**: GAP-002 cannot be properly fixed without this type. Also, callers cannot write `catch (e) { if (e instanceof TransactionRollbackError)` to detect intentional rollbacks.

**Proposed Solution**:
Create a custom `TransactionRollbackError` class in `packages/db/src/utils/error.ts`:

```typescript
export class TransactionRollbackError extends Error {
    readonly name = 'TransactionRollbackError';
    constructor(message = 'Transaction rolled back intentionally') {
        super(message);
    }
}
```

Callers who want to abort a transaction intentionally throw `new TransactionRollbackError()`. The `withTransaction` wrapper re-throws it without wrapping (see GAP-002). Export from `@repo/db` index.

**Action**: Fix inline. No new SPEC needed. Blocks GAP-002 fix.

---

### GAP-016 — `getBasePlanLimit()` in `migrate-addon-purchases.ts` calls `getDb()` directly

**Audit Pass**: 2 | **Status**: Open
**File**: `packages/db/src/billing/migrate-addon-purchases.ts` lines ~149–157
**Severity**: Medium | **Priority**: P3 | **Complexity**: Trivial

**Problem**:
```typescript
async function getBasePlanLimit(subscriptionId: string, limitKey: string): Promise<number | null> {
    const db = getDb(); // ← hardcoded, ignores any active transaction
    const rows = await db
        .select({ planId: billingSubscriptions.planId })
        ...
```

The function is private to the migration script, which currently doesn't use transactions. However, the pattern is inconsistent with SPEC-060's philosophy, and if this function is ever extracted to a shared helper or called within a transaction, it would silently escape the transaction context.

**Proposed Solution**:
```typescript
async function getBasePlanLimit(
    db: DrizzleClient,
    subscriptionId: string,
    limitKey: string
): Promise<number | null> {
```

Pass `db` explicitly from the caller, which has the transaction context.

**Action**: Fix inline. No new SPEC needed.

---

### GAP-017 — Pagination loop bug: uses `firstPage.hasMore` instead of `page.hasMore`

**Audit Pass**: 2 | **Status**: ✅ **FIXED** (Pass 4)

**Fix confirmed in Pass 4**: The pagination loop in `restoreAllPlans` (lines 311–323) now uses proper `hasMore`/`total` tracking with `PAGE_SIZE = 100`. The fix references GAP-038-19 in the code comment.

---

### GAP-018 — `setDb()` accepts `NodePgDatabase` instead of `DrizzleClient`

**Audit Pass**: 2 | **Status**: Open
**File**: `packages/db/src/client.ts` line 75
**Severity**: Low | **Priority**: P4 | **Complexity**: Trivial

**Problem**:
```typescript
export function setDb(client: NodePgDatabase<typeof schema>): void {
    runtimeClient = client;
}
```

Consequence of GAP-003. Also, the test at `db.test.ts` line 18 uses `setDb(null as any)` for reset — confirms the type is not enforced. Should accept `DrizzleClient` for consistency.

**Action**: Fix inline alongside GAP-003. No new SPEC needed.

---

### GAP-019 — `BaseModelImpl.getClient()` lacks JSDoc

**Audit Pass**: 2 | **Status**: ✅ **FIXED**

**Fix confirmed in Pass 3**: `base.model.ts` lines 74-76 now have JSDoc:
```typescript
/**
 * Returns the provided tx if available, otherwise returns the default db connection from getDb().
 * Safe to call with undefined.
 */
protected getClient(tx?: DrizzleClient): DrizzleClient {
    return tx ?? getDb();
}
```

---

### GAP-020 — `findPopularTags(limit = 10, tx?)`: `tx` effectively inaccessible without explicit `limit`

**Audit Pass**: 2 | **Status**: Open
**File**: `packages/db/src/models/tag/rEntityTag.model.ts` line ~127
**Severity**: Medium | **Priority**: P3 | **Complexity**: Low

**Problem**:
```typescript
async findPopularTags(
    limit = 10,         // default parameter FIRST
    tx?: DrizzleClient  // optional SECOND
): Promise<Array<{ tag: unknown; usageCount: number }>>
```

While Biome allows `(paramWithDefault = val, optionalParam?)`, the API is inconsistent with every other method in the codebase (`method(businessParams, tx?: DrizzleClient)`). More importantly, to pass `tx` without specifying `limit`, callers must write `findPopularTags(10, tx)` — they cannot use `findPopularTags(undefined, tx)` cleanly since `undefined` is valid for the optional but would override the default visually.

**Impact**: In SPEC-059 Phase 4, threading transactions through this method requires knowing the default limit value — a leaky abstraction.

**Proposed Solution**:
Move `limit` into an options object:
```typescript
async findPopularTags(
    options: { limit?: number } = {},
    tx?: DrizzleClient
): Promise<Array<{ tag: unknown; usageCount: number }>>
```
Or simply reverse parameters:
```typescript
async findPopularTags(
    tx?: DrizzleClient,
    limit = 10
): Promise<Array<{ tag: unknown; usageCount: number }>>
```
The options-object approach is preferred for consistency with the codebase.

**Action**: Fix inline. No new SPEC needed.

---

### GAP-021 — SPEC-060 task tracking completely out of sync (35 tasks all `pending`)

**Audit Pass**: 2 | **Status**: Open
**File**: `.claude/tasks/SPEC-060-model-subclass-tx-propagation/state.json`
**Severity**: Low | **Priority**: P3 | **Complexity**: Trivial (process only)

**Problem**:
All 35 tasks for SPEC-060 are in `pending` state despite the implementation being 100% complete. The code was implemented (likely alongside SPEC-058 in commit `69bdfdb6`), but no tasks were marked `completed`. This creates a misleading picture of the SPEC-059 Phase 4 prerequisites.

**Action**: Update task states to `completed` for all implementation tasks. Mark spec status as `completed`. Gate tasks T-033/T-034 (full test suite, lint) on test coverage gaps being resolved (see GAP-022 through GAP-025).

---

### GAP-022 — `withTransaction` has zero unit tests

**Audit Pass**: 2 | **Status**: Open
**File**: `packages/db/test/utils/db.test.ts`
**Severity**: High | **Priority**: P1 | **Complexity**: Medium

**Problem**:
`withTransaction` is the central function of SPEC-060's entire purpose (enabling atomic multi-model operations). It has **zero** unit tests. `db.test.ts` only covers `initializeDb`, `getDb`, and `setDb`.

**What's missing**:
- Test that the callback receives a `tx` object (not `getDb()`)
- Test that a callback error causes rollback and throws `DbError`
- Test that `TransactionRollbackError` is re-thrown without wrapping (once GAP-015 is fixed)
- Test that `DbError` thrown from callback is not double-wrapped (once GAP-002 is fixed)
- Test nested `withTransaction` behavior

**Action**: Add tests before marking SPEC-060 as complete. Part of the "no tests = not done" rule. P1.

---

### GAP-023 — `BaseModelImpl` has zero tx propagation tests for all 13 methods

**Audit Pass**: 2 | **Status**: Open
**File**: `packages/db/test/models/base.model.test.ts` (697 lines, 0 refs to `tx`)
**Severity**: High | **Priority**: P1 | **Complexity**: Medium

**Problem**:
The 13 base model methods updated by SPEC-058 (all with `tx?: DrizzleClient`) have no tx tests in the base model test suite. `base.model.test.ts` covers functional behavior but not transaction propagation. The gap is significant because all subclass tests inherit from this untested foundation.

**What's missing**:
- Test that `findById(id, tx)` calls `this.getClient(tx)` with the tx
- Test that `findAll(where, ..., tx)` propagates tx
- Test that all 13 methods with `tx` actually USE `tx` when provided (via `getClient` spy)

**Action**: Add a describe block `BaseModel tx propagation` with at least the two canonical scenarios (tx=undefined → getDb, tx=defined → getClient returns tx). P1.

---

### GAP-024 — 9 models with zero tx propagation tests for their custom methods

**Audit Pass**: 2 | **Status**: Open
**Files**: Multiple test files in `packages/db/test/models/`
**Severity**: High | **Priority**: P2 | **Complexity**: Medium

**Problem**:
The following models have custom methods that accept `tx?: DrizzleClient` per SPEC-060, but their test files have zero `tx` references:

| Model | Test file | Methods without tx tests |
|---|---|---|
| `RAccommodationAmenityModel` | `r_accommodation_amenity.model.test.ts` | `countAccommodationsByAmenityIds`, `findWithRelations` |
| `RAccommodationFeatureModel` | `r_accommodation_feature.model.test.ts` | `countAccommodationsByFeatureIds`, `findWithRelations` |
| `RDestinationAttractionModel` | `r_destination_attraction.model.test.ts` | `findWithRelations` |
| `REntityTagModel` | `r_entity_tag.model.test.ts` | `findWithRelations`, `findAllWithTags`, `findAllWithEntities`, `findPopularTags` |
| `RevalidationConfigModel` | `revalidation-config.model.test.ts` | `findByEntityType`, `findAllEnabled` |
| `EventModel` | `event.model.test.ts` | `findWithRelations` |
| `EventOrganizerModel` | `eventOrganizer.model.test.ts` | `findWithRelations` |
| `PostModel` | `post.model.test.ts` | `incrementLikes`, `decrementLikes` |
| `PostSponsorshipModel` | `post_sponsorship.model.test.ts` | `findWithRelations` |

**Minimum acceptable**: At least one test per custom method verifying that `getClient(tx)` is called when `tx` is provided (spy-based, no real DB needed).

**Action**: Add tx propagation tests to all 9 models. P2. Blocks SPEC-060 from being marked `completed`.

---

### GAP-025 — Multiple models with partial tx test coverage

**Audit Pass**: 2 | **Status**: Open
**Files**: Multiple test files
**Severity**: Medium | **Priority**: P3 | **Complexity**: Low

**Problem**:
Models with tx tests but incomplete coverage:

| Model | Test file | Methods WITH tx tests | Methods WITHOUT tx tests |
|---|---|---|---|
| `RevalidationLogModel` | `revalidation-log.model.test.ts` | `deleteOlderThan` | `findWithFilters`, `findLastCronEntry` |
| `ExchangeRateModel` | `exchange-rate.model.test.ts` | `findLatestRates` | `findLatestRate`, `findRateHistory`, `findManualOverrides`, `findAllWithDateRange` |
| `DestinationModel` | `destination.hierarchy.test.ts` | `updateDescendantPaths` (1/10) | `findAllByAttractionId`, `searchWithAttractions`, `getAttractionsMap`, `search`, `findChildren`, `findDescendants`, `findAncestors`, `findByPath`, `countByFilters`, `isDescendant` |
| `SponsorshipModel` | `sponsorship.model.test.ts` | `findBySponsorUserId`, `findByStatus` (delegate tx) | `findBySlug`, `findActiveByTarget`, `findWithRelations` |

**Action**: Complete tx test coverage for all listed methods. P3.

---

### GAP-026 — `BaseModel` exported as both class alias and interface — potential name ambiguity

**Audit Pass**: 2 | **Status**: Open
**File**: `packages/db/src/base/base.model.ts` line 718, `packages/db/src/types.ts` line 67
**Severity**: Low | **Priority**: P4 | **Complexity**: Low

**Problem**:
Two exports share the name `BaseModel`:
1. `base.model.ts` line 718: `export { BaseModelImpl as BaseModel }` — re-exports the **class** under a backward-compat alias
2. `types.ts` line 67: `export interface BaseModel<T>` — exports the **interface**

When a consumer does `import { BaseModel } from '@repo/db'`, they get the class (value) in a value context and potentially the interface in a type context. This is legal in TypeScript but can confuse contributors who expect `BaseModel` to refer to the interface from `types.ts`.

**Proposed Solution**:
Remove the `as BaseModel` class alias (use `BaseModelImpl` everywhere), or document the duality explicitly in both files.

**Action**: Fix inline or document. No new SPEC needed. P4.

---

### GAP-027 — `BaseModel` interface from `types.ts` NOT exported from `@repo/db` index

**Audit Pass**: 3 | **Status**: Open
**File**: `packages/db/src/index.ts` line 24
**Severity**: Low | **Priority**: P4 | **Complexity**: Trivial

**Problem**:
`packages/db/src/index.ts` line 24 exports only `DrizzleClient` and `QueryContext` from `types.ts`:
```typescript
export type { DrizzleClient, QueryContext } from './types.ts';
```

The `BaseModel<T>` interface (defined at `types.ts:67`) is NOT included. Consumers who need to type a generic reference to any model instance (e.g., for dependency injection or factory patterns) cannot import the interface from `@repo/db`.

**Proposed Solution**:
```typescript
export type { DrizzleClient, QueryContext, BaseModel } from './types.ts';
```

**Action**: Fix inline. No new SPEC needed.

---

### GAP-028 — `throwDbError` helper lacks `cause` parameter

**Audit Pass**: 3 | **Status**: Open
**File**: `packages/db/src/utils/error.ts` lines 48-55
**Severity**: Low | **Priority**: P4 | **Complexity**: Trivial

**Problem**:
The `throwDbError` convenience function does not accept a `cause` parameter:
```typescript
export function throwDbError(method: string, entity: string, params?: unknown, message?: string): never {
    throw new DbError(method, entity, params, message);
}
```
The `DbError` constructor DOES accept `cause` (line 30), but `throwDbError` cannot chain errors. Any code using `throwDbError` instead of `new DbError(...)` loses the error chain.

**Proposed Solution**:
```typescript
export function throwDbError(method: string, entity: string, params?: unknown, message?: string, cause?: Error): never {
    throw new DbError(method, entity, params, message, cause);
}
```

**Action**: Fix inline. No new SPEC needed.

---

### GAP-029 — `initBillingInstance` accepts `DrizzleClient` but passes to `createBillingAdapter(NodePgDatabase)`

**Audit Pass**: 3 | **Status**: Open
**File**: `packages/db/src/billing/migrate-addon-purchases.ts` lines 111-113
**Severity**: Medium | **Priority**: P3 | **Complexity**: Trivial

**Problem**:
```typescript
function initBillingInstance(db: DrizzleClient) {  // accepts DrizzleClient (PgDatabase)
    const adapter = createBillingAdapter(db, ...);  // but createBillingAdapter expects NodePgDatabase
```
`DrizzleClient` (`PgDatabase`) is a SUPERTYPE of `NodePgDatabase`. Passing a supertype where a subtype is expected is technically incorrect. TypeScript tolerates this via structural compatibility, but the type annotation is misleading. If `createBillingAdapter` ever accesses `NodePgDatabase`-specific properties, this will fail at runtime.

**Proposed Solution**: Fix GAP-004 first (change `createBillingAdapter` to accept `DrizzleClient`), which automatically resolves this.

**Action**: Resolves automatically with GAP-004 fix.

---

### GAP-030 — `runtimeClient` variable typed as `NodePgDatabase` instead of `DrizzleClient`

**Audit Pass**: 3 | **Status**: Open
**File**: `packages/db/src/client.ts` line 23
**Severity**: Medium | **Priority**: P3 | **Complexity**: Trivial

**Problem**:
```typescript
let runtimeClient: NodePgDatabase<typeof schema> | null = null;
```
Part of the GAP-003 cluster. The internal storage variable uses the narrower `NodePgDatabase` type when the rest of the tx propagation system uses `DrizzleClient`. Should be `DrizzleClient | null` for consistency.

**Action**: Fix inline alongside GAP-003. No new SPEC needed.

---

### GAP-031 — `initializeDb` return type is `NodePgDatabase` instead of `DrizzleClient`

**Audit Pass**: 3 | **Status**: Open
**File**: `packages/db/src/client.ts` line 44
**Severity**: Medium | **Priority**: P3 | **Complexity**: Trivial

**Problem**:
```typescript
export function initializeDb(pool: Pool): NodePgDatabase<typeof schema>
```
Callers storing the result get the narrow `NodePgDatabase` type, not `DrizzleClient`. This is the entry point for the entire DB system. Part of the GAP-003 cluster.

**Action**: Fix inline alongside GAP-003. No new SPEC needed.

---

### GAP-032 — 11 service files in `apps/api/src/services/` call `getDb()` directly

**Audit Pass**: 3 | **Status**: Open
**Files**: Multiple in `apps/api/src/services/`
**Severity**: Medium | **Priority**: P2 | **Complexity**: Medium-High

**Problem**:
The following service files bypass model methods and call `getDb()` directly for DB operations:
1. `addon-lifecycle-cancellation.service.ts`
2. `addon.admin.ts`
3. `addon.user-addons.ts`
4. `addon.checkout.ts`
5. `addon-entitlement.service.ts`
6. `billing-metrics.service.ts`
7. `addon-expiration.service.ts`
8. `usage-tracking.service.ts`
9. `trial.service.ts`
10. `billing-usage.service.ts`
11. `notification-retry.service.ts`

These services cannot participate in caller-provided transactions because they create their own DB connections. This is the service-layer counterpart to SPEC-060's model-layer fix.

**Action**: This is SPEC-059 scope (service-layer tx propagation). Not a SPEC-060 gap per se, but documented here for completeness. The 11 files are the primary targets for SPEC-059 Phase 4.

---

### GAP-033 — 13+ model test files not audited for tx coverage

**Audit Pass**: 3 | **Status**: Open
**Files**: Multiple in `packages/db/test/models/`
**Severity**: Low | **Priority**: P3 | **Complexity**: Low

**Problem**:
GAP-024 audited 9 model test files for tx propagation tests. Pass 3 identified 13+ additional test files that were never checked:
- `accommodationFaq.model.test.ts`
- `accommodationIaData.model.test.ts`
- `postSponsor.model.test.ts`
- `userBookmark.model.test.ts`
- `accommodationReview.model.test.ts`
- `eventLocation.model.test.ts`
- `attraction.model.test.ts`
- `tag.model.test.ts`
- `r_role_permission.model.test.ts`
- `userIdentity.model.test.ts`
- `ownerPromotion.model.test.ts`
- `sponsorshipLevel.model.test.ts`
- `sponsorshipPackage.model.test.ts`

Most of these are pure `BaseModelImpl` wrappers (no custom methods), so tx tests may not be strictly required. However, the models with custom methods (ownerPromotion, sponsorshipLevel, sponsorshipPackage) should have tx propagation tests.

**Positive finding**: `find-all-with-relations-tx.test.ts` was discovered as a NEW dedicated tx propagation test file with 36+ tx-related test assertions, showing progress.

**Action**: Audit the 13 files. Add tx tests to models with custom methods. P3.

---

### GAP-034 — `notification-schedule.job.ts` no concurrency protection

**Audit Pass**: 4 | **Status**: Open
**File**: `apps/api/src/cron/jobs/notification-schedule.job.ts` line 573
**Severity**: Low | **Priority**: P3 | **Complexity**: Low

**Problem**:
Uses `getDb()` directly for notification scheduling operations without an advisory lock or any other mechanism to prevent concurrent execution. If two cron instances run simultaneously (e.g., during deployment overlap or SIGTERM + new start), both will read the same pending notifications and could dispatch duplicates.

Contrast with `addon-expiry.job.ts` which correctly uses `pg_try_advisory_lock(43001)` at line 147.

**Proposed Solution**:
```typescript
const lockAcquired = await db.execute(sql`SELECT pg_try_advisory_lock(${NOTIFICATION_SCHEDULE_LOCK_ID})`);
if (!lockAcquired.rows[0].pg_try_advisory_lock) {
    logger.info('notification-schedule: another instance is running, skipping');
    return;
}
```

**Action**: Fix inline alongside GAP-009 (same pattern). No new SPEC needed.

---

### GAP-035 — `dunning.job.ts` no concurrency protection

**Audit Pass**: 4 | **Status**: Open
**File**: `apps/api/src/cron/jobs/dunning.job.ts` line 46
**Severity**: Low | **Priority**: P3 | **Complexity**: Low

**Problem**:
Uses `getDb()` for dunning attempt records without an advisory lock. Concurrent runs could produce duplicate dunning records for the same subscription, which could result in double-charges or incorrect dunning state (e.g., marking a subscription as failed too early due to double-counting attempt numbers).

**Proposed Solution**:
Same pattern as GAP-034. Add `pg_try_advisory_lock(DUNNING_LOCK_ID)` at job entry.

**Action**: Fix inline. No new SPEC needed.

---

### GAP-036 — Pervasive `getDb()` mock anti-pattern in 27+ test files

**Audit Pass**: 4 | **Status**: Open
**Files**: `packages/db/test/models/` (27+ files)
**Severity**: Medium | **Priority**: P2 | **Complexity**: Medium-High

**Problem**:
Virtually every model test file uses the pattern:
```typescript
vi.mock('../../src/client', () => ({ getDb: vi.fn() }));
// ...
getDb.mockReturnValue(mockDb);
```

This makes it **fundamentally impossible** to detect tx propagation regressions. All tests exercise the `getDb()` fallback path only — never the `getClient(tx)` path that SPEC-060 actually changed. A future refactor that breaks `this.getClient(tx)` would pass all tests silently.

The only exception is `find-all-with-relations-tx.test.ts` which properly tests the tx path for `AccommodationModel` with 36+ assertions.

**Files with this anti-pattern** (non-exhaustive): `base.model.test.ts`, `accommodation.model.test.ts`, `destination.model.test.ts`, `event.model.test.ts`, `eventOrganizer.model.test.ts`, `post.model.test.ts`, `sponsorship.model.test.ts`, `amenity.model.test.ts`, `tag.model.test.ts`, `ownerPromotion.model.test.ts`, `revalidation-config.model.test.ts`, `revalidation-log.model.test.ts`, `r_accommodation_amenity.model.test.ts`, `r_accommodation_feature.model.test.ts`, `r_destination_attraction.model.test.ts`, `r_entity_tag.model.test.ts`, `r_role_permission.model.test.ts`, `r_user_permission.model.test.ts`, `sponsorshipLevel.model.test.ts`, `sponsorshipPackage.model.test.ts`, `attraction.model.test.ts`, `post_sponsorship.model.test.ts`, `exchange-rate.model.test.ts`, `exchange-rate-config.model.test.ts`, `destination.hierarchy.test.ts`, `accommodationReview.model.test.ts`, and more.

**Proposed Solution**:
For each model with custom methods accepting `tx`, add a `describe('tx propagation')` block that:
1. Creates a spy on `model.getClient`
2. Passes a mock `tx` object to the method
3. Asserts `getClient` was called with the mock `tx`

The `find-all-with-relations-tx.test.ts` approach is the template to follow.

**Action**: This amplifies GAP-023/GAP-024. Recommend creating a dedicated test modernization SPEC (or including in SPEC-061). This is the root cause of why tx regressions would go undetected.

---

### GAP-037 — Zero `withTransaction` usage in entire API layer

**Audit Pass**: 4 | **Status**: Open (awareness — SPEC-059 scope)
**Files**: All of `apps/api/src/` (routes, services, cron)
**Severity**: Medium | **Priority**: P2 | **Complexity**: N/A

**Problem**:
Grep for `withTransaction` across `apps/api/src/` returns **zero matches**. Despite SPEC-060 enabling tx propagation at the model layer, no service, route, or cron job currently uses `withTransaction` to create a transaction context. SPEC-060's model-layer changes are a necessary foundation but have **zero consumers** — all multi-step operations remain non-atomic.

This is expected behavior (SPEC-059 Phase 4 is the planned consumer), but it means:
1. The entire model-layer tx propagation work provides no runtime benefit until SPEC-059 Phase 4 ships
2. Any integration tests that exercise the tx path would need to create transactions explicitly

**Action**: No action needed for SPEC-060 — documents the gap between model-layer completion (SPEC-060) and service-layer adoption (SPEC-059 Phase 4). SPEC-059 Phase 4 is the critical unblocking step.

---

### GAP-038 — 18 route handler locations with `getDb()` and multi-step DB operations

**Audit Pass**: 4 | **Status**: Open (SPEC-059 scope)
**Files**: Multiple in `apps/api/src/routes/`
**Severity**: Medium | **Priority**: P2 | **Complexity**: Medium

**Problem**:
Extension of GAP-032. Beyond the 11 service files, 18 route handler locations call `getDb()` directly for multi-step operations that should be atomic:

| File | Line | Concern |
|---|---|---|
| `routes/webhooks/mercadopago/subscription-logic.ts` | 280 | Subscription processing with multiple DB writes |
| `routes/billing/admin/subscription-cancel.ts` | 121 | Admin cancel with DB state changes |
| `routes/billing/plan-change.ts` | 227 | Plan change with multiple DB operations |
| `routes/billing/addons.ts` | 314 | Addon purchase with DB writes |
| `routes/webhooks/mercadopago/utils.ts` | 78, 147, 196 | Three separate `getDb()` calls in webhook utilities |
| `routes/webhooks/mercadopago/event-handler.ts` | 63 | Event persistence |

**Proposed Solution**: Routes should delegate to service methods that use `withTransaction`. No direct `getDb()` in route handlers.

**Action**: SPEC-059 Phase 4 scope. Add to its target file list alongside the 11 service files from GAP-032.

---

---

### GAP-039 — `BaseCrudService` lifecycle pipeline has zero transaction infrastructure

**Audit Pass**: 5 | **Status**: Open (SPEC-059 scope — blocks GAP-040 through GAP-044)
**Files**: All 8 files in `packages/service-core/src/base/`
- `base.crud.write.ts`
- `base.crud.hooks.ts`
- `base.crud.service.ts`
- `base.crud.read.ts`
- `base.crud.admin.ts`
- `base.crud.permissions.ts`
- `base.crud.related.service.ts`
- `base.crud.types.ts`
**Severity**: Critical | **Priority**: P1 | **Complexity**: High

**Problem**:
The entire `BaseCrudService` hierarchy (8 files) has absolutely zero transaction awareness. The word `tx` and `transaction` appear zero times across all base files. No method signature in the chain accepts a `tx` parameter. The lifecycle pipeline in `base.crud.write.ts`:

```typescript
// create() lines 56-92 — three independent DB operations, no shared tx:
await this._beforeCreate(actor, data);   // hook — may do DB writes
await this.model.create(data);           // primary write — no tx
await this._afterCreate(actor, entity);  // hook — may do DB writes
```

Same pattern applies to `update()`, `softDelete()`, `hardDelete()`, `restore()`, `updateVisibility()`, `setFeaturedStatus()` — all execute model calls and hooks as independent DB operations.

**This is structurally distinct from GAP-032/037/038** (which identify individual files calling `getDb()` directly). GAP-039 is about the **base class architecture itself** making it impossible for any subclass to participate in a caller-provided transaction. Even if all 11 service files from GAP-032 and all 18 routes from GAP-038 were fixed, there is still no mechanism to pass `tx` through the `BaseCrudService` lifecycle pipeline.

**Impact**: Every entity service (destination, accommodation, event, post, user, tag, amenity, accommodationReview, destinationReview, postSponsorship, etc.) inherits this limitation. The hooks — which are the primary extension point for subclasses — all execute as isolated DB calls even when they perform multiple writes.

**Proposed Solution**:
Add `tx?: DrizzleClient` to all BaseCrudService write methods and wrap the lifecycle pipeline in a transaction:
```typescript
async create(actor: Actor, data: CreateInput, tx?: DrizzleClient): Promise<Result<Entity>> {
    return withTransaction(async (innerTx) => {
        await this._beforeCreate(actor, data, innerTx);
        const entity = await this.model.create(data, innerTx);
        await this._afterCreate(actor, entity, innerTx);
        return entity;
    }, tx); // use existing tx if provided (requires GAP-014 fix)
}
```

**Action**: Create new SPEC as SPEC-059 Phase 4 prerequisite. Cannot be fixed inline — it's a breaking change to all service method signatures. All hooks (`_beforeCreate`, `_afterCreate`, etc.) must be updated to accept and forward `tx`. This is the most impactful single change to the service layer.

---

### GAP-040 — `DestinationService.update` splits parent update and descendant path cascade into separate transactions

**Audit Pass**: 5 | **Status**: Open (blocked by GAP-039)
**File**: `packages/service-core/src/services/destination/destination.service.ts:509-533`
**Severity**: High | **Priority**: P1 | **Complexity**: Medium

**Problem**:
```typescript
// Line 518: commits the parent destination update INDEPENDENTLY (via base.crud.write.ts)
const result = await super.update(actor, id, data);

// Line 521-522: code comment claims "guarantee atomicity" — it does NOT
// Line 524: wraps ONLY the descendant path cascade in a separate transaction
await withTransaction(async (tx) => {
    await this.model.updateDescendantPaths(parentId, oldPath, newPath, tx);
});
```

If the `withTransaction` on line 524 fails, the parent destination has already committed its new `path`, `pathIds`, `level`, and `slug`. All descendant destinations still reference the OLD parent path, creating an inconsistent hierarchy tree that cannot be self-healed without a manual repair script.

**Proposed Solution**:
Wrap both operations in the same transaction. Requires GAP-039 fix (BaseCrudService tx infrastructure) to pass `tx` into `super.update()`:
```typescript
await withTransaction(async (tx) => {
    await super.update(actor, id, data, tx);           // primary update + hooks
    await this.model.updateDescendantPaths(parentId, oldPath, newPath, tx); // cascade
});
```

**Action**: Fix inline after GAP-039 is resolved. Interim mitigation: add explicit comment documenting the non-atomicity and the conditions under which the hierarchy becomes inconsistent.

---

### GAP-041 — `AccommodationReviewService._afterCreate/_afterUpdate` performs 3+ unwrapped DB writes

**Audit Pass**: 5 | **Status**: Open (blocked by GAP-039)
**File**: `packages/service-core/src/services/accommodationReview/accommodationReview.service.ts:257-291`
**Severity**: High | **Priority**: P2 | **Complexity**: Medium

**Problem**:
After a review is created by the base class (committed), `_afterCreate` (line 257) executes:
1. `computeAndStoreReviewAverage` → `this.model.updateById(reviewId, { averageRating })` — write 1
2. `recalculateAndUpdateAccommodationStats` → reads accommodations, writes to accommodation entity — writes 2+

None of these share a transaction with the original `model.create()` call. If stats recalculation fails mid-way, the review exists but the accommodation's `averageRating` and `reviewsCount` are permanently stale.

`_afterUpdate` (line 275) has the same pattern for review edits.

**Proposed Solution**: After GAP-039 fix, `_afterCreate(actor, entity, tx)` can participate in the same transaction as the primary create. All three writes become atomic.

**Action**: Fix after GAP-039. No independent action possible without base class tx support.

---

### GAP-042 — `DestinationReviewService._afterCreate/_afterUpdate` performs 3+ unwrapped DB writes

**Audit Pass**: 5 | **Status**: Open (blocked by GAP-039)
**File**: `packages/service-core/src/services/destinationReview/destinationReview.service.ts:202-254`
**Severity**: High | **Priority**: P2 | **Complexity**: Medium

**Problem**:
Identical pattern to GAP-041 but for destination reviews:

1. `_afterCreate` (line 202): updates `destination.averageRating` via `this.model.update(...)` — write 1
2. Calls `recalculateAndUpdateDestinationStats` → `this.model.findAll(...)` + `this.destinationService.updateStatsFromReview(...)` → `this.model.updateById(...)` — writes 2+

Three separate DB operations with no shared transaction with the primary review insert. If destination stat update fails, review exists but destination stats are stale.

**Action**: Fix after GAP-039. Same pattern as GAP-041.

---

### GAP-043 — `PostSponsorshipService` cross-entity writes without tx, errors silently swallowed

**Audit Pass**: 5 | **Status**: Open (blocked by GAP-039)
**File**: `packages/service-core/src/services/postSponsorship/postSponsorship.service.ts:92-144`
**Severity**: High | **Priority**: P2 | **Complexity**: Medium

**Problem**:
`_afterCreate` (line 92-128):
1. Creates `PostModel` instance (line 98)
2. Calls `postModel.update({id: entity.postId}, {sponsorshipId: entity.id})` (line 101-107)
3. **Error on line 120 is caught and swallowed** (`return entity`) — a failed post FK update is silently accepted

If the post FK update fails (e.g., post doesn't exist, concurrent deletion), the `post_sponsorships` row is committed but `posts.sponsorship_id` was never set. The sponsorship is orphaned.

`_beforeSoftDelete` (line 133-144):
1. Reads the sponsorship
2. Clears `posts.sponsorship_id` — separate from the soft-delete itself
3. If clearing fails silently, the post still points to a soft-deleted sponsorship

**Proposed Solution**:
After GAP-039: wrap in tx so the cross-entity write and primary create/delete are atomic. Remove silent error swallowing — propagate the error so the caller knows the operation failed.

**Action**: Fix after GAP-039. Interim mitigation: remove the silent swallow and let the error propagate.

---

### GAP-044 — `AccommodationService._afterCreate` cross-entity write without tx

**Audit Pass**: 5 | **Status**: Open (blocked by GAP-039)
**File**: `packages/service-core/src/services/accommodation/accommodation.service.ts:334-355`
**Severity**: Medium | **Priority**: P2 | **Complexity**: Low

**Problem**:
`_afterCreate` (line 334) calls `this.destinationService.updateAccommodationsCount(entity.destinationId)` (line 336). This method counts accommodations and writes the count to the destination row. The write happens after the accommodation has already been committed. No shared transaction.

If `updateAccommodationsCount` fails, the accommodation exists but the destination's `accommodationsCount` is stale until the next update.

**Action**: Fix after GAP-039.

---

### GAP-045 — `cancelAddonPurchaseRecord` has no tx parameter; `revokeAllAddonsForCustomer` iterates without wrapping tx

**Audit Pass**: 5 | **Status**: Open
**File**: `packages/service-core/src/services/billing/addon/addon-user-addons.ts:354-377`
**Severity**: Medium | **Priority**: P2 | **Complexity**: Low

**Problem**:
```typescript
// Line 359: hardcoded getDb(), no tx param
async function cancelAddonPurchaseRecord(purchaseId: string): Promise<void> {
    const db = getDb();
    await db.update(billingAddonPurchases).set({ status: 'canceled', ... }).where(...);
}
```

`revokeAllAddonsForCustomer` iterates over active purchases calling `cancelAddonPurchaseRecord` for each one with no wrapping transaction. If one cancellation fails mid-loop, some addons are canceled and some remain active — no rollback mechanism.

Unlike GAP-032 (which covers `apps/api/src/services/`), this function is in `packages/service-core/` and the structural issue is the missing `tx` parameter preventing callers from including it in their transactions.

**Proposed Solution**:
```typescript
async function cancelAddonPurchaseRecord(purchaseId: string, tx?: DrizzleClient): Promise<void> {
    const db = tx ?? getDb();
    await db.update(billingAddonPurchases).set({ status: 'canceled', ... }).where(...);
}
```

**Action**: Fix inline. Add `tx` param. Update callers to pass `tx` where available.

---

### GAP-046 — `promo-code.crud.ts`: 6 CRUD functions use bare `getDb()`, no tx parameter

**Audit Pass**: 5 | **Status**: Open
**File**: `packages/service-core/src/services/billing/promo-code/promo-code.crud.ts`
**Severity**: Medium | **Priority**: P2 | **Complexity**: Low

**Problem**:
All 6 functions (`createPromoCode` line 82, `getPromoCodeByCode` line 143, `getPromoCodeById` line 184, `updatePromoCode` line 228, `listPromoCodes` line 301, `deletePromoCode` line 347) call `getDb()` directly with no `tx` parameter.

Write operations (`createPromoCode`, `updatePromoCode`, `deletePromoCode`) cannot be included in a caller-provided transaction. Note: `promo-code.redemption.ts` correctly uses `withTransaction` for `tryRedeemAtomically`, but `incrementPromoCodeUsage` (line 142 in redemption file) also uses bare `getDb()`.

This is in `packages/service-core/`, distinct from GAP-032's scope in `apps/api/src/services/`.

**Proposed Solution**:
Refactor to accept `db: DrizzleClient = getDb()` as a parameter:
```typescript
async function createPromoCode(data: CreateInput, db: DrizzleClient = getDb()): Promise<PromoCode>
```

Or use the consistent pattern: `tx?: DrizzleClient` as last parameter.

**Action**: Fix inline. No new SPEC needed.

---

### GAP-047 — `QueryContext` interface is dead code: defined, exported, referenced in ADR-018 but never consumed

**Audit Pass**: 5 | **Status**: Open
**File**: `packages/db/src/types.ts:45-57`
**Severity**: Medium | **Priority**: P2 | **Complexity**: Low

**Problem**:
```typescript
// types.ts line 45
export interface QueryContext {
    /** Optional transaction handle */
    tx?: DrizzleClient;
    // ... documented as the MANDATORY future pattern per ADR-018
}
```

`QueryContext` is exported from `@repo/db` (`index.ts` line 24: `export type { DrizzleClient, QueryContext }`). ADR-018 states "All new model and service methods MUST accept `ctx?: QueryContext`" as a migration path. But:
- Zero model methods in `BaseModelImpl` accept `QueryContext`
- Zero service methods accept `QueryContext`
- Zero consumers import it from `@repo/db`
- All existing methods use positional `tx?: DrizzleClient` instead

The `count()` method uses `{ tx?: DrizzleClient }` inline object (not `QueryContext`). This makes `QueryContext` dead code that creates a false impression that ADR-018's Context Object pattern has been adopted.

**Impact**: Developers reading ADR-018 may believe the migration has happened and add new code using `QueryContext`, creating an inconsistent mix with the `tx?: DrizzleClient` pattern.

**Proposed Solution**:
Option A: Remove `QueryContext` from `types.ts` and the `@repo/db` export. Document in ADR-018 that the migration was not done and positional `tx?: DrizzleClient` is the canonical pattern.
Option B: Keep `QueryContext` but clearly mark it as "Future/SPEC-059" in the JSDoc and add a tracking issue.

**Action**: Decision needed (not an autonomous fix). Flag in ADR-018. No new SPEC needed.

---

### GAP-048 — All 15+ `findWithRelations` overrides silently ignore unknown relation keys

**Audit Pass**: 5 | **Status**: Open
**Files**: All model files with `findWithRelations` override (accommodationModel, destinationModel, eventModel, eventOrganizerModel, sponsorshipModel, sponsorshipLevelModel, sponsorshipPackageModel, ownerPromotionModel, rAccommodationAmenityModel, rAccommodationFeatureModel, rDestinationAttractionModel, rEntityTagModel, postSponsorshipModel, rUserPermissionModel, rRolePermissionModel)
**Severity**: Medium | **Priority**: P3 | **Complexity**: Low

**Problem**:
Every `findWithRelations` override has a hardcoded allowlist of relation keys. If a caller passes an unknown key:
```typescript
await accommodationModel.findWithRelations(where, { invalidKey: true, amenities: true });
// → Returns data with amenities but silently drops invalidKey with zero warning
```

The base class stub also silently ignores ALL relations. This creates a silent contract violation: callers cannot know whether a requested relation was not found or was simply not supported by the model.

This is relevant to SPEC-060 because the LSP fix for `findWithRelations` (which is 100% complete) changed the `relations` type but kept the silent-ignore behavior.

**Proposed Solution**:
```typescript
for (const key of Object.keys(relations)) {
    if (!ALLOWED_RELATIONS.includes(key)) {
        logger.warn(`findWithRelations: unknown relation key "${key}" for ${this.tableName}`);
    }
}
```

**Action**: Fix inline (add warning). Or document as by-design and add to JSDoc. No new SPEC needed.

---

### GAP-049 — 8+ inline `count()` queries bypass `BaseModelImpl.count()` and its `Number()` coercion

**Audit Pass**: 5 | **Status**: Open
**Files**:
- `packages/db/src/models/destination/destination.model.ts` lines 198, 344, 642
- `packages/db/src/models/accommodation/accommodation.model.ts` lines 54, 140, 269
- `packages/db/src/models/revalidation/revalidation-log.model.ts` line 109
- `packages/db/src/models/exchange-rate/exchange-rate.model.ts` line 265
**Severity**: Medium | **Priority**: P2 | **Complexity**: Low

**Problem**:
Multiple custom methods perform inline count queries instead of calling `this.count(where, { tx })`:
```typescript
// Pattern found in 8+ locations:
const [{ total }] = await db.select({ total: count() }).from(table).where(conditions);
// typeof total → bigint | string (pg driver returns bigint as string in some modes)
```

`BaseModelImpl.count()` applies `Number(result[0]?.count ?? 0)` coercion (base.model.ts line 324) which handles the pg driver returning bigint as string. The inline count queries skip this coercion. In Node.js pg driver v8+, bigint columns are returned as JavaScript `string` by default, so `total` may be `"42"` (string) instead of `42` (number), causing silent type coercion issues downstream.

Additionally, tx IS correctly propagated in all 8 locations (they all use `this.getClient(tx)` or the `db` variable from it), so this is not a tx-propagation bug — it's a type safety and consistency issue.

**Proposed Solution**:
Replace with `this.count(where, { tx })` where applicable. Where the WHERE condition differs from what `this.count` supports, add explicit `Number()` coercion:
```typescript
const [{ total }] = await db.select({ total: count() }).from(table).where(conditions);
const safeTotal = Number(total ?? 0); // explicit coercion matching BaseModelImpl.count()
```

**Action**: Fix inline. Low risk. No new SPEC needed.

---

### GAP-050 — `DestinationModel.findAllByAttractionId` has LOGIC BUG: wrong WHERE clause

**Audit Pass**: 5 | **Status**: Open (fix immediately)
**File**: `packages/db/src/models/destination/destination.model.ts:91-109`
**Severity**: High | **Priority**: P1 | **Complexity**: Low

**Problem**:
```typescript
async findAllByAttractionId(attractionId: string, tx?: DrizzleClient): Promise<Destination[]> {
    const db = this.getClient(tx);
    return await db.query.destinations.findMany({
        where: (fields, { eq }) => eq(fields.id, attractionId), // ← WRONG: compares destinations.id to attractionId
        with: { attractions: true }
    });
}
```

The method is supposed to return destinations that have a specific attraction. Instead, it queries destinations whose own `id` equals the `attractionId`. Since `attractionId` is the ID of an attraction (different entity), this will virtually always return zero results (unless an attraction and destination share the same UUID by coincidence).

The correct query should filter destinations that are related to the given `attractionId` through the `r_destination_attractions` join table.

**Impact**: Any caller of `findAllByAttractionId` receives wrong data silently. This is a LOGIC BUG that has existed since the method was written. No runtime error is thrown.

**Proposed Solution**:
```typescript
async findAllByAttractionId(attractionId: string, tx?: DrizzleClient): Promise<Destination[]> {
    const db = this.getClient(tx);
    // Option A: Use relational query with nested where
    return await db.query.destinations.findMany({
        where: (fields, { exists }) => exists(
            db.select().from(rDestinationAttractions)
                .where(and(
                    eq(rDestinationAttractions.destinationId, fields.id),
                    eq(rDestinationAttractions.attractionId, attractionId)
                ))
        )
    });
    // Option B: JOIN via raw query (more performant)
}
```

**Action**: Fix inline immediately. Write regression test first. No new SPEC needed. This is a standalone logic bug fix.

---

### GAP-051 — `UserModel` has zero db-layer test file despite 3 complex method overrides

**Audit Pass**: 5 | **Status**: Open (test debt)
**File**: Missing — no `packages/db/test/models/user.model.test.ts`
**Severity**: High (test debt) | **Priority**: P1 | **Complexity**: Medium

**Problem**:
`UserModel` overrides `findAll`, `count`, and adds `findAllWithCounts` — all three with custom WHERE clause logic (text search, `additionalConditions` merging, pagination). All three accept `tx?: DrizzleClient`. Zero test file exists for `UserModel` at the db layer.

UserModel is **not listed in GAP-024** (which lists 9 specific models with zero tx tests) nor **GAP-033** (which counts unaudited existing test files — this file doesn't exist at all). The service-core list tests mock `findAllWithCounts` entirely, so actual model logic is completely untested.

**Action**: Create `packages/db/test/models/user.model.test.ts` covering all three custom methods including tx propagation. P1.

---

### GAP-052 — `AccommodationModel.search()` and `searchWithRelations()` have zero tests

**Audit Pass**: 5 | **Status**: Open (test debt)
**File**: `packages/db/test/models/accommodation.model.test.ts`
**Severity**: Medium (test debt) | **Priority**: P2 | **Complexity**: Medium

**Problem**:
The accommodation test file covers `findWithRelations`, `countByFilters`, `updateStats`, `findAllWithRelations`, and `findTopRated`. But `search()` (~90 lines) and `searchWithRelations()` (~130 lines) — the most complex methods with multi-condition WHERE builders, amenity/feature EXISTS subqueries, sort handling, and pagination — have **zero tests**.

Both accept `tx?: DrizzleClient`. Not listed in GAP-024 or GAP-025 because those gaps target other models.

**Action**: Add test cases for `search()` and `searchWithRelations()` to `accommodation.model.test.ts`. Include tx propagation tests. P2.

---

### GAP-053 — `find-all-with-relations-tx.test.ts` only covers `AccommodationModel`

**Audit Pass**: 5 | **Status**: Open (test debt)
**File**: `packages/db/test/models/find-all-with-relations-tx.test.ts`
**Severity**: Low (test debt) | **Priority**: P3 | **Complexity**: Low

**Problem**:
The dedicated tx propagation test file for `findAllWithRelations` instantiates only `AccommodationModel`. If any other model's `findAllWithRelations` chain has a regression (e.g., tx not forwarded to the fallback `this.findAll()`), it goes undetected.

**Action**: Add at least one additional model (e.g., `DestinationModel`) to cover the tx propagation path in a model with a custom `findWithRelations` override. P3.

---

### GAP-054 — No partial-failure test in tx test file (findMany succeeds, count fails)

**Audit Pass**: 5 | **Status**: Open (test debt)
**File**: `packages/db/test/models/find-all-with-relations-tx.test.ts:199`
**Severity**: Medium (test debt) | **Priority**: P2 | **Complexity**: Low

**Problem**:
The error test mocks BOTH `findMany` AND `count` to fail simultaneously. There is no test where `findMany` succeeds but `count()` fails within a tx context. This is the real partial-success concern — a scenario where items are returned but the total count is inconsistent. Without this test, `Promise.all([findMany, count])` failure modes are only half-covered.

**Action**: Add a test: mock `findMany` to succeed, `count` to throw. Verify the tx is rolled back (or the error propagated) and no partial result is returned. P2.

---

### GAP-055 — 5 billing models have zero test files at db layer

**Audit Pass**: 5 | **Status**: Open (test debt)
**Files**: Missing for all 5:
- `packages/db/test/models/billingSettings.model.test.ts`
- `packages/db/test/models/billingAddonPurchase.model.test.ts`
- `packages/db/test/models/billingDunningAttempt.model.test.ts`
- `packages/db/test/models/billingNotificationLog.model.test.ts`
- `packages/db/test/models/billingSubscriptionEvent.model.test.ts`
**Severity**: Low (test debt) | **Priority**: P4 | **Complexity**: Low

**Problem**:
These are pure `BaseModelImpl` wrappers with no custom methods, so they were excluded from SPEC-060 scope. However, every other model in the codebase has basic tests. These 5 have zero coverage at the db layer — not even a smoke test to verify instantiation and basic CRUD works.

**Action**: Create minimal test files. Basic instantiation + one CRUD operation per model. P4.

---

### GAP-056 — Zero service-core billing service tests in `packages/service-core/test/`

**Audit Pass**: 5 | **Status**: Open (test debt — SPEC-064 scope)
**Files**: Missing: `packages/service-core/test/billing/`
**Severity**: Low (test debt) | **Priority**: P3 | **Complexity**: Medium

**Problem**:
The billing service layer in `packages/service-core/src/services/billing/` has zero test coverage at the service-core level. `apps/api/test/` has billing route tests and some addon atomicity tests, but those test at the HTTP layer. Service-core billing logic (`promo-code.redemption.ts`, `billing-settings.service.ts`, `addon-limit-recalculation.service.ts`, etc.) is only tested through the route layer — if a service method has a bug that doesn't affect the HTTP response shape, it goes undetected.

ADR-018's migration plan lists SPEC-064 (billing tx safety) as step 4. Zero service-core billing tests means there is no regression baseline for that work.

**Action**: Deferred to SPEC-064. Document here for context.

---

## Dependency Graph for Fixes

```
GAP-015 (create TransactionRollbackError)
    └──► GAP-002 (withTransaction error handling)
            └──► GAP-022 (withTransaction tests)

GAP-003 (getDb returns DrizzleClient)
    └──► GAP-018 (setDb accepts DrizzleClient)
    └──► GAP-030 (runtimeClient typed as DrizzleClient)
    └──► GAP-031 (initializeDb returns DrizzleClient)
    └──► GAP-004 (billing adapter accepts DrizzleClient)
            └──► GAP-029 (initBillingInstance type mismatch — auto-resolves)
            └──► GAP-016 (getBasePlanLimit receives db param)
            └──► GAP-005 fix (addon-lifecycle tx propagation)
            └──► GAP-010 (activateAddon tx propagation)
            └──► GAP-011 (expiration reconciliation — partially fixed)

GAP-014 (withTransaction nested tx support)
    └──► SPEC-059 Phase 4 (cross-entity transaction chaining)

GAP-019 (getClient JSDoc)
    └──► prevents future regressions in model subclasses

GAP-023 (BaseModelImpl tx tests) + GAP-024 (9 model tx tests) + GAP-022 (withTransaction tests)
    └──► SPEC-060 can be marked 'completed'

GAP-039 (BaseCrudService tx infrastructure) ← NEW CRITICAL BLOCKER
    └──► GAP-040 (DestinationService.update split tx)
    └──► GAP-041 (AccommodationReviewService hooks 3+ writes)
    └──► GAP-042 (DestinationReviewService hooks 3+ writes)
    └──► GAP-043 (PostSponsorshipService cross-entity writes)
    └──► GAP-044 (AccommodationService._afterCreate cross-entity)
    └──► SPEC-059 Phase 4 (all service-layer tx propagation)

GAP-050 (findAllByAttractionId logic bug) ← IMMEDIATE FIX (no dependencies)
```

---

## Action Summary

| Gap | Severity | Action | New SPEC? |
|---|---|---|---|
| GAP-001: `findTopRated` tx in params object | Medium | Fix inline | No |
| GAP-002: `withTransaction` swallows all errors | High | Fix inline (after GAP-015) | No |
| GAP-003: `getDb()` returns `NodePgDatabase` not `DrizzleClient` | Medium | Fix inline | No |
| GAP-004: `createBillingAdapter()` wrong type | Medium | Fix inline | No |
| GAP-005: addon-lifecycle-cancellation non-atomic | High | **New SPEC** | **Yes — P1** |
| GAP-006: addon-plan-change non-atomic loop | Medium | ✅ FIXED | — |
| GAP-007: migrate-addon-purchases non-atomic + idempotency bug | High | Fix directly with regression test | No |
| GAP-008: SPEC-055 status `draft` | Low | Update spec status | No |
| GAP-009: webhook-retry false idempotency | Medium | Fix inline (advisory lock) | No |
| GAP-010: activateAddon non-atomic | Medium | **New SPEC** (billing reconciliation) | **Yes — P2** |
| GAP-011: addon-expiration non-atomic (reconciliation cron now exists) | Medium | **New SPEC** (billing reconciliation) — partially fixed | **Yes — P2** |
| GAP-012: trial.service 2 active subscriptions | Low | Add to billing reconciliation SPEC | Yes (same) |
| GAP-013: notification-retry TOCTOU | Low | Fix inline | No |
| GAP-014: withTransaction no nested tx support | High | Fix inline | No |
| GAP-015: TransactionRollbackError type missing | High | Fix inline (create class) | No |
| GAP-016: getBasePlanLimit uses getDb() | Medium | Fix inline | No |
| GAP-017: pagination loop bug | Medium | Fix inline | No |
| GAP-018: setDb wrong type | Low | Fix inline (with GAP-003) | No |
| GAP-019: getClient() no JSDoc | Low | ✅ FIXED | — |
| GAP-020: findPopularTags unusable tx param | Medium | Fix inline | No |
| GAP-021: SPEC-060 tasks all pending | Low | Update task states | No |
| GAP-022: withTransaction zero tests | High | Add tests | No |
| GAP-023: BaseModelImpl zero tx tests | High | Add tests | No |
| GAP-024: 9 models zero tx tests | High | Add tests | No |
| GAP-025: partial tx test coverage (6 models) | Medium | Add tests | No |
| GAP-026: BaseModel name ambiguity | Low | Fix/document inline | No |
| GAP-027: BaseModel interface not exported from @repo/db | Low | Fix inline (add to index.ts exports) | No |
| GAP-028: throwDbError lacks cause param | Low | Fix inline | No |
| GAP-029: initBillingInstance → createBillingAdapter type mismatch | Medium | Fix inline (after GAP-004) | No |
| GAP-030: runtimeClient typed as NodePgDatabase | Medium | Fix inline (with GAP-003) | No |
| GAP-031: initializeDb returns NodePgDatabase | Medium | Fix inline (with GAP-003) | No |
| GAP-032: 11 service files use getDb() directly | Medium | SPEC-059 scope (service-layer tx) | **Yes — SPEC-059** |
| GAP-033: 13+ model test files unaudited for tx coverage | Low | Audit + add tests | No |
| GAP-034: notification-schedule.job.ts no advisory lock | Low | Fix inline (with GAP-009) | No |
| GAP-035: dunning.job.ts no advisory lock | Low | Fix inline | No |
| GAP-036: 27+ test files getDb() mock anti-pattern | Medium | Test modernization (SPEC-061 or new SPEC) | Maybe (if test scope is large) |
| GAP-037: Zero withTransaction in API layer | Medium | SPEC-059 Phase 4 | **Yes — SPEC-059** |
| GAP-038: 18 route handlers use getDb() multi-step | Medium | SPEC-059 Phase 4 | **Yes — SPEC-059** |
| GAP-039: BaseCrudService zero tx infrastructure | **Critical** | **New SPEC** (SPEC-059 Phase 4 prerequisite) | **Yes — P1** |
| GAP-040: DestinationService.update split transactions | High | Fix inline after GAP-039 | No |
| GAP-041: AccommodationReviewService hooks unwrapped writes | High | Fix inline after GAP-039 | No |
| GAP-042: DestinationReviewService hooks unwrapped writes | High | Fix inline after GAP-039 | No |
| GAP-043: PostSponsorshipService cross-entity writes, silent swallow | High | Fix inline after GAP-039 (+ remove silent swallow now) | No |
| GAP-044: AccommodationService._afterCreate cross-entity write | Medium | Fix inline after GAP-039 | No |
| GAP-045: cancelAddonPurchaseRecord no tx param | Medium | Fix inline (add tx param) | No |
| GAP-046: promo-code.crud.ts 6 functions use bare getDb() | Medium | Fix inline (add db/tx param) | No |
| GAP-047: QueryContext dead code | Medium | Decision + document/remove | No |
| GAP-048: findWithRelations silently ignores unknown keys | Medium | Fix inline (add warning) or document | No |
| GAP-049: Inline count() bypasses Number() coercion | Medium | Fix inline (add coercion or use this.count) | No |
| GAP-050: findAllByAttractionId wrong WHERE clause (logic bug) | High | **Fix immediately** (write regression test first) | No |
| GAP-051: UserModel zero db-layer test file | High (test) | Create test file | No |
| GAP-052: AccommodationModel search methods zero tests | Medium (test) | Add test cases | No |
| GAP-053: find-all-with-relations-tx.test.ts covers only 1 model | Low (test) | Add model coverage | No |
| GAP-054: No partial-failure test in tx test file | Medium (test) | Add error scenario | No |
| GAP-055: 5 billing models zero db-layer test files | Low (test) | Create minimal test files | No |
| GAP-056: Zero service-core billing service tests | Low (test) | Deferred to SPEC-064 | Yes (SPEC-064) |

---

## Audit History

| Pass | Date | Auditor | Focus | Gaps Found |
|---|---|---|---|---|
| 1 | 2026-04-09 | 3 specialized agents | Full spec vs codebase comparison | 8 gaps (0 in core spec requirements, 8 in adjacent layers/infrastructure) |
| 2 | 2026-04-09 | 4 specialized agents (model layer, infrastructure, service+cron, tests+exports) | Deep dive per layer: model API consistency, infra tx correctness, service atomicity, test coverage, export consistency | 18 new gaps (1 existing FIXED: GAP-006; 8 infra/type gaps; 4 service atomicity gaps; 4 test coverage gaps; 2 process gaps) |
| 3 | 2026-04-09 | 3 specialized agents (model layer exhaustive, infrastructure/types, services+tests+billing) | Full re-verification of all 26 gaps + exhaustive model method audit (45+ methods) + new gap discovery | 7 new gaps; 2 existing resolved (GAP-019 FIXED, GAP-011 partially fixed); 23 still open; 0 regressions |
| 4 | 2026-04-10 | 3 specialized agents (model layer full verify, infrastructure/types, services+tests+cron+billing) | Full re-verification of all 33 gaps + model layer confirmed 100% clean + new gap discovery (cron, tests, API) | 5 new gaps (GAP-034–038); 2 FIXED (GAP-007, GAP-017); EventOrganizer orphan file confirmed deleted; 34 open |
| 5 | 2026-04-10 | 6 specialized agents (BaseCrudService structural, lifecycle hooks, cross-entity writes, model/type correctness, test coverage depth, billing services) | Deepest audit yet — service layer structural analysis (BaseCrudService hierarchy), lifecycle hook atomicity, cross-entity write safety, QueryContext dead code, inline count coercion, findWithRelations contracts, UserModel test gap, billing db/service tests | 18 new gaps (GAP-039–056); 0 FIXED; Critical GAP-039 (BaseCrudService zero tx) discovered; High logic bug GAP-050 discovered; 51 open total |
