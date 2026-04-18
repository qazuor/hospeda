# SPEC-064: Billing Transaction Safety — Task Overview

> **Risk level**: HIGH — Financial-critical code. All changes require second-engineer review before merging.
> **Prerequisites**: SPEC-058 merged, SPEC-059 Phases 1-3 merged, SPEC-061 Phase A merged.
> **Total tasks**: 35 | **Average complexity**: 1.9 | **Max complexity**: 2

---

## Parallel Tracks & Critical Path

```
TRACK A — Phase 0 (ctx threading, mostly parallel):
  T-001 → billing-settings.service.ts
  T-002 → promo-code.crud.ts (first 3 functions)
    T-003 → promo-code.crud.ts (last 3 functions + tests, needs T-002)
  T-004 → promo-code.redemption.ts
  T-005 → promo-code.validation.ts
  T-006 → addon-expiration.queries.ts
  T-007 → addon-user-addons.ts (add ctx to 3 functions)
    T-008 → addon-user-addons.ts (trace propagation + tests, needs T-007)
  T-009 → notification-retention.service.ts
       ↓
  T-010 (Phase 0 verification gate, needs T-001..T-009)
       ↓ ↓
       ↓ ↓——→ T-035 (Phase 5 analysis, parallel)
       ↓
  T-011 (Phase 3.5: DB schema changes) ←— CRITICAL PATH
       ↓
  T-012 (Phase 3.5: migration + model update)
       ↓ ↓ ↓
  T-013 T-014 T-015 (constants, Zod schema, i18n — parallel)
       ↓ ↓
       ↓ ↓——→ T-033 → T-034 (OP-5 analysis, parallel track)
       ↓
  T-016 → T-017 → T-018 (Phase 1: advisory lock fix, sequential)
       ↓
  T-019 → T-020 (Phase 3: subscription-cancel compensating)
  T-021 → T-022 → T-023 (Phase 3: plan-change tx wrapping)
  T-024 → T-025 (Phase 4: dedup persistence, needs T-017)
       ↓ (T-020 + T-023 + T-025)
  T-026 → T-027 → T-028 (Phase 2: cron lock migration)
       ↓ (T-028 + T-034)
  T-029 T-030 T-031 T-032 (integration tests, parallel)
```

**Critical path**: T-010 → T-011 → T-012 → T-013/T-014 → T-016 → T-017 → T-024 → T-025 → T-026 → T-027 → T-028 → T-029..T-032

---

## Phase 0: Billing ctx threading (setup) — Tasks T-001 to T-010

All 7 files can be worked in parallel (except T-003 needs T-002, T-008 needs T-007).

| Task | File | Scope | Complexity | Status |
|------|------|-------|------------|--------|
| T-001 | `billing-settings.service.ts` | 3 getDb() sites | 2 | pending |
| T-002 | `promo-code.crud.ts` | First 3 functions (create, getByCode, getById) | 2 | pending |
| T-003 | `promo-code.crud.ts` | Last 3 functions (update, delete, list) + all tests | 2 | pending |
| T-004 | `promo-code.redemption.ts` | 2 getDb() sites (NOT tryRedeemAtomically/applyPromoCode) | 2 | pending |
| T-005 | `promo-code.validation.ts` | 1 getDb() site via internal helper | 2 | pending |
| T-006 | `addon-expiration.queries.ts` | 2 getDb() sites | 2 | pending |
| T-007 | `addon-user-addons.ts` | Add ctx to 3 functions + replace getDb() | 2 | pending |
| T-008 | `addon-user-addons.ts` | Trace internal call propagation + unit tests | 2 | pending |
| T-009 | `notification-retention.service.ts` | 2 getDb() sites (class pattern) | 2 | pending |
| T-010 | Phase 0 verification gate | Sweep all 7 files, run full test suite | 2 | pending |

**Key rule for T-004**: Do NOT add `ctx` to `tryRedeemAtomically()` or `applyPromoCode()` — they own their own transaction.
**Key rule for T-009**: Class method pattern — add `ctx` to instance methods, propagate from `runRetentionPolicy()`.

---

## Phase 3.5: Schema migration (core) — Tasks T-011 to T-015

Must complete BEFORE Phase 1/3 (T-016+) and Phase 4 (T-024+).

### T-011 — DB schema changes (complexity: 2)
- File: `packages/db/src/schemas/billing/billing_subscription_event.dbschema.ts`
- Add `event_type` varchar(100) nullable column
- Make `previous_status` and `new_status` nullable
- Add composite index `idx_subscription_events_event_type`

### T-012 — Generate migration + update model (complexity: 2)
- Run `pnpm db:generate` + verify migration SQL
- Update `BillingSubscriptionEventModel` with `eventType: string | null`
- Run `pnpm db:migrate` on dev DB
- Write smoke tests for null/non-null eventType inserts

### T-013 — BILLING_EVENT_TYPES constant (complexity: 2)
- File: `packages/service-core/src/services/billing/constants.ts` (create if not exists)
- Export `BILLING_EVENT_TYPES` const: `ADDON_RECALC_COMPLETED`, `ADDON_REVOCATIONS_PENDING`, `PLAN_CHANGE_LOCAL_FAILED`
- Export `BillingEventType` union type

### T-014 — Update SubscriptionEventSchema (complexity: 2)
- File: `packages/schemas/src/api/billing/subscription-event.schema.ts`
- Add `eventType` field (nullable, optional)
- Make `previousStatus` and `newStatus` nullable/optional
- Write unit tests for both event patterns

### T-015 — i18n keys (complexity: 1)
- Add `zodError.billing.subscriptionEvent.eventType.invalidType` in es/en/pt
- Add `zodError.billing.subscriptionEvent.eventType.max` in es/en/pt

---

## Phase 1: Advisory lock fix (core) — Tasks T-016 to T-018

### T-016 — Wrap in withServiceTransaction + statement_timeout (complexity: 2)
- File: `apps/api/src/services/addon-plan-change.service.ts`
- CRITICAL: Current `pg_advisory_xact_lock` at line 210 is a no-op (runs outside transaction)
- Wrap function body in `withServiceTransaction`
- Add `SET LOCAL statement_timeout = '30000'` as first statement
- QZPay `billing.limits.set()` calls remain OUTSIDE the DB transaction

### T-017 — Move lock inside transaction + replace db.* + hashCustomerId (complexity: 2)
- Move `pg_advisory_xact_lock` inside transaction using `ctx.tx`
- Prefer `pg_try_advisory_xact_lock` (non-blocking) for user-facing endpoint
- Replace all `db.*` with `ctx.tx.*`
- Implement `hashCustomerId` for stable bigint from UUID

### T-018 — Write IT-1 and IT-2 tests (complexity: 2)
- IT-1: Two concurrent calls for same customer — second blocks or returns LOCK_UNAVAILABLE
- IT-2: Mock `billing.limits.set()` fails on 2nd of 3 limits — verify rollback + retryable

---

## Phase 3: Multi-step transaction wrapping (integration) — Tasks T-019 to T-023, T-033 to T-034

### T-019 — Subscription-cancel: collect IDs + insert compensating event (complexity: 2)
- File: `apps/api/src/routes/billing/admin/subscription-cancel.ts`
- Collect `revokedAddonPurchaseIds` during Phase 1 loop
- Insert `ADDON_REVOCATIONS_PENDING` event after Phase 1, before Phase 2 `db.transaction()`

### T-020 — Write IT-3 test + unit test for record shape (complexity: 2)
- IT-3: Phase 1 succeeds, Phase 2 forced to fail — verify compensating event exists

### T-021 — Plan-change: wrap local DB updates in withServiceTransaction (complexity: 2)
- File: `apps/api/src/routes/billing/plan-change.ts`
- QZPay `changePlan()` stays OUTSIDE any transaction
- Wrap subscription status update + addon recalc in `withServiceTransaction`

### T-022 — Plan-change: add compensating event + webhook safety net comment (complexity: 2)
- On local tx failure: log `PLAN_CHANGE_LOCAL_FAILED` OUTSIDE the (failed) tx
- Document webhook safety net as explicit design decision

### T-023 — Write IT-6 test + unit test for event shape (complexity: 2)
- IT-6: QZPay succeeds, local tx forced to fail — verify `PLAN_CHANGE_LOCAL_FAILED` logged

### T-033 — OP-5 analysis: trace transaction scope in addon.user-addons.ts (complexity: 2)
- File: `apps/api/src/services/addon.user-addons.ts`
- Trace `db.transaction()` at line 150
- Determine if `recalculateAddonLimitsForCustomer()` makes QZPay calls inside tx

### T-034 — OP-5: apply fix or document confirmation (complexity: 2)
- If QZPay inside tx: split phases (DB writes in tx, external calls after)
- If not: document confirmation with JSDoc + code comment

---

## Phase 4: Dedup persistence (integration) — Tasks T-024 to T-025

### T-024 — Define DEDUP_WINDOW_MS + add DB dedup query (complexity: 2)
- File: `apps/api/src/services/addon-plan-change.service.ts`
- `DEDUP_WINDOW_MS = 5 * 60 * 1000` constant
- DB dedup check inside transaction: query `billing_subscription_events` for recent `ADDON_RECALC_COMPLETED`

### T-025 — Write dedup event + retain in-memory Map + IT-5/IT-5b tests (complexity: 2)
- Write `ADDON_RECALC_COMPLETED` atomically at end of transaction
- Keep in-memory Map as fast-path (checked first)
- IT-5: Second call within 5 min returns `skipped: true`
- IT-5b: Reset Map, DB-backed dedup still blocks

---

## Phase 2: Cron lock migration (integration) — Tasks T-026 to T-028

### T-026 — Remove old locks + wrap in pg_try_advisory_xact_lock(43001) (complexity: 2)
- File: `apps/api/src/cron/jobs/addon-expiry.job.ts` (1321 lines)
- Remove `pg_try_advisory_lock(43001)` and `pg_advisory_unlock(43001)`
- Wrap cron body in `withTransaction` with `pg_try_advisory_xact_lock(43001)`
- Lock auto-releases on commit/rollback

### T-027 — Replace all db.* with tx.* + add statement_timeout (complexity: 2)
- Replace all `db.*` calls inside cron with `tx.*`
- Add `SET LOCAL statement_timeout = '120000'` (2 min for cron)
- Implement cursor-based batching if >= 100 purchases

### T-028 — Create advisory-locks.md registry + write IT-4 test (complexity: 2)
- Create `packages/db/docs/advisory-locks.md` with lock registry table
- IT-4: Two concurrent cron executions — second returns `skipped: true`

---

## Testing phase — Tasks T-029 to T-032

All 4 test tasks can run in parallel after T-028 and T-034 complete.

### T-029 — advisory-lock.test.ts (IT-1, IT-2) + subscription-cancel.test.ts (IT-3) (complexity: 2)
- Consolidate integration tests from earlier tasks

### T-030 — cron-lock.test.ts (IT-4) + dedup-guard.test.ts (IT-5, IT-5b) (complexity: 2)
- Consolidate integration tests from earlier tasks

### T-031 — plan-change.test.ts (IT-6) + promo-code-concurrency.test.ts (IT-7) (complexity: 2)
- IT-7: 10 concurrent redemptions, maxUsages: 5 — verify exactly 5 succeed

### T-032 — transaction-timeout.test.ts (IT-8) + unit tests for hashCustomerId, record shapes (complexity: 2)
- IT-8: `statement_timeout = '1000'` times out on `pg_sleep(2)`
- Unit tests for hashCustomerId, compensating event shapes, dedup guard logic

---

## Phase 5: Analysis — Task T-035

### T-035 — BaseCrudService alignment analysis (complexity: 2)
- No code changes
- Evaluate 4 billing services against BaseCrudService
- Produce `packages/service-core/src/services/billing/BILLING_ARCHITECTURE.md`
- Can run in parallel with everything after T-010

---

## Acceptance Criteria Summary

### Cross-cutting (all phases must pass before merging)
- [ ] `pnpm typecheck` passes monorepo-wide
- [ ] `pnpm lint` (Biome) passes
- [ ] All existing billing tests pass (ctx is optional — backward compatible)
- [ ] IT-7 passes: promo code concurrency regression (10 concurrent, maxUsages: 5)
- [ ] No session-level advisory locks remain in billing code

### Phase 0
- [ ] 19 `getDb()` call sites replaced with `ctx?.tx ?? getDb()` across 7 files
- [ ] `tryRedeemAtomically()` and `applyPromoCode()` NOT modified

### Phase 1
- [ ] `pg_advisory_xact_lock` in `addon-plan-change.service.ts` is inside a `withTransaction()` block
- [ ] IT-1 and IT-2 pass

### Phase 2
- [ ] `addon-expiry.job.ts` uses `pg_try_advisory_xact_lock(43001)` inside transaction
- [ ] Manual `pg_advisory_unlock` removed from `finally` block
- [ ] IT-4 passes

### Phase 3
- [ ] `subscription-cancel.ts`: `ADDON_REVOCATIONS_PENDING` event logged after Phase 1
- [ ] `plan-change.ts`: local DB updates in single transaction, `PLAN_CHANGE_LOCAL_FAILED` on failure
- [ ] `addon.user-addons.ts`: OP-5 transaction scope verified and documented
- [ ] IT-3 and IT-6 pass

### Phase 3.5
- [ ] `event_type` column added (nullable varchar(100))
- [ ] `previous_status` and `new_status` made nullable
- [ ] Index `idx_subscription_events_event_type` created
- [ ] `BILLING_EVENT_TYPES` constant defined
- [ ] Zod schema updated with `eventType` field
- [ ] i18n keys added in es/en/pt

### Phase 4
- [ ] DB-backed dedup check per subscriptionId within 5-minute window
- [ ] `DEDUP_WINDOW_MS` named constant defined
- [ ] In-memory Map retained as fast-path
- [ ] IT-5 and IT-5b pass

### Phase 5
- [ ] Analysis document produced, no code changes
