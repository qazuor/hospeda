# SPEC-064 Billing Transaction Safety -- Implementation Plan

> **Created**: 2026-04-18
> **Total GAPs**: 67 items (80 original - 5 descartados - 2 nueva SPEC - 6 duplicados absorbidos)
> **Total Estimated Effort**: ~70 hours
> **Phases**: 5 (0-4)

---

## Architecture Context

The billing system spans three key packages:
- **`packages/db`** -- Drizzle schemas, migrations, `withTransaction()`, client
- **`packages/service-core`** -- Business logic (billing settings, promo codes, addon helpers, notifications)
- **`apps/api`** -- Hono routes, cron jobs, middlewares, service orchestration

---

## Phase 0: Foundational Infrastructure (~4.5 hrs)

**Goal**: Schema migrations, event type constants, and shared utilities that later phases depend on.

| GAP | Description | Package | Est. |
|-----|-------------|---------|------|
| GAP-038+077 | Dunning schema: nullable `subscriptionId` + partial unique constraint | `packages/db` (schema + migration) | 2h |
| GAP-017+059 | Add `maxUsesPerUser` column to promo codes + unique constraint | `packages/db` (schema + migration) | 1.5h |
| GAP-041 | Partial indexes for reconciliation flags (`WHERE flag = true`) | `packages/db` (schema + migration) | 0.5h |
| GAP-008 | Add missing event types to `BILLING_EVENT_TYPES` | `packages/service-core` | 0.5h |

**Migration strategy**: Generate a single migration file via `pnpm db:generate` after applying all three schema modifications. Update `apply-postgres-extras.sh` for CHECK constraints (GAP-014+075+076 from Phase 3).

**Dependencies**: None. Must complete before Phases 1-4.

---

## Phase 1: Critical Transaction Safety -- P0 (~13.5 hrs)

**Goal**: Eliminate nested transactions, TOCTOU races, and non-atomic operations.

### Batch 1A: Nested Transaction Removal (~2 hrs)

| GAP | Description | File |
|-----|-------------|------|
| GAP-022+023 | Remove `db.transaction()` on `input.tx`. Use `input.tx` directly when provided, `withTransaction` when not. | `addon.checkout.ts`, `addon-user-addons.ts` |

### Batch 1B: Atomic Promo Increment (~3 hrs)
*Depends on: 1A (same file `addon.checkout.ts`)*

| GAP | Description | File |
|-----|-------------|------|
| GAP-024 | Replace separate `incrementUsage + recordUsage` with transactional helper using `FOR UPDATE` | `addon.checkout.ts`, `promo-code.redemption.ts` |

### Batch 1C: TOCTOU Fix (~2 hrs)

| GAP | Description | File |
|-----|-------------|------|
| GAP-025 | Move `queryActiveAddonPurchases` inside `withTransaction` with `FOR UPDATE` | `addon-user-addons.ts` |

### Batch 1D: Billing Settings TX Propagation (~1.5 hrs)

| GAP | Description | File |
|-----|-------------|------|
| GAP-027+028 | Branch on `ctx?.tx` in `updateSettings` and `resetSettings` | `billing-settings.service.ts` |

### Batch 1E: Cron Lock Fixes (~5 hrs)

| GAP | Description | Files |
|-----|-------------|-------|
| GAP-001+009+013+015 | Migrate 4 crons to `pg_try_advisory_xact_lock` inside `withTransaction`. Propagate tx. Add unique index on notification idempotency key. | `addon-expiry.job.ts`, `webhook-retry.job.ts`, `notification-schedule.job.ts`, `dunning.job.ts` |

---

## Phase 2: High-Priority Safety -- P1 (~20 hrs)

### Batch 2A: Promo Code Context Threading (~3.5 hrs)

| GAP | Description | File |
|-----|-------------|------|
| GAP-029 | Add `ctx` param to `applyPromoCode` | `promo-code.redemption.ts` |
| GAP-030 | Pass `ctx` to `getPromoCodeByCode` (one-liner) | `promo-code.validation.ts` |
| GAP-031 | Add `ctx` to all `PromoCodeService` facade methods (~10) | `promo-code.service.ts` |

### Batch 2B: Addon Race Condition Fixes (~7 hrs)
*Depends on: Phase 1 Batch 1A*

| GAP | Description | File |
|-----|-------------|------|
| GAP-032 | Move SELECT inside tx with FOR UPDATE in `activateAddon` | `addon.admin.ts` |
| GAP-047 | Add SELECT FOR UPDATE before INSERT in `confirmAddonPurchase` | `addon.checkout.ts` |
| GAP-054 | Check existing purchase with same `paymentId` before confirming | `addon.checkout.ts` |
| GAP-034+057 | Aggregate all active addons for same `limitKey` + wrap recalc in tx | `addon-entitlement.service.ts`, `addon-limit-recalculation.service.ts` |

### Batch 2C: External Call Isolation + Schema Hardening (~5.5 hrs)

| GAP | Description | File |
|-----|-------------|------|
| GAP-002 | Move QZPay calls outside tx boundary | `addon-plan-change.service.ts` |
| GAP-050 | Add `.int()` to promo Zod schemas + `Math.floor` in redemption | `promo-code.schema.ts`, `promo-code.redemption.ts` |
| GAP-052 | Atomic PostgreSQL increment for payment failure count via `jsonb_set` | `subscription-logic.ts` |

### Batch 2D: Webhook Security (~4 hrs)

| GAP | Description | File |
|-----|-------------|------|
| GAP-061+062 | Signature verification middleware + timestamp replay protection | `apps/api/src/middlewares/` (new), `webhooks/mercadopago/router.ts` |

---

## Phase 3: Medium-Priority Hardening -- P2 (~25 hrs)

### Batch 3A: Race Conditions + State Machine (~8 hrs)

| GAP | Description | File |
|-----|-------------|------|
| GAP-005+033 | Add FOR UPDATE to subscription-cancel race guard | `subscription-cancel.ts` |
| GAP-036+058 | Advisory lock + DB-backed dedup for trial blocking | `trial.service.ts` |
| GAP-037 | Notification retry: processing->sent/failed pattern | `notification-retry.service.ts` |
| GAP-021+072 | Document per-customer dedup + move DB check inside tx post-lock | `addon-plan-change.service.ts` |

### Batch 3B: Cascade + Deletion Safety (~6 hrs)
*Depends on: Phase 0 GAP-038+077*

| GAP | Description | File |
|-----|-------------|------|
| GAP-055+078 | Customer deletion cascade soft-delete + clear `entitlementRemovalPending` | `billing-customer-sync.ts` |
| GAP-056 | Addon cancellation partial failure flag + compensating event | `addon-lifecycle-cancellation.service.ts` |
| GAP-035 | Trial audit log: `captureException` + compensating event | `trial.service.ts` |

### Batch 3C: Rate Limiting + Audit (~5 hrs)

| GAP | Description | File |
|-----|-------------|------|
| GAP-065+066 | Rate limiting: promo validation 5/min, admin billing 50/min | `rate-limit.ts`, route files |
| GAP-064 | Admin audit trail for promo code mutations | `promo-code.crud.ts`, `billing_audit_logs` |
| GAP-014+075+076 | Batch CHECK constraints in `apply-postgres-extras.sh` | `apply-postgres-extras.sh` |

### Batch 3D: Promo Code Business Logic (~4.5 hrs)
*Depends on: Phase 0 GAP-017+059 (migration)*

| GAP | Description | File |
|-----|-------------|------|
| GAP-017+059 (logic) | Per-user promo usage check in validation | `promo-code.validation.ts` |
| GAP-051 | Add `.max(9999999)` to discountValue schema | `promo-code.schema.ts` |
| GAP-063 | Record rounding delta in audit metadata | `promo-code.redemption.ts` |
| GAP-067 | Scope `newCustomersOnly` to plan-specific usage | `promo-code.validation.ts` |
| GAP-068 | Accept currency param with default 'ARS' | `promo-code.redemption.ts` |

### Batch 3E: Documentation (~1.75 hrs)

| GAP | Description | File |
|-----|-------------|------|
| GAP-012 | Document READ COMMITTED + FOR UPDATE as design decision | ADR in `docs/decisions/` |
| GAP-060 | Document `validatePromoCode` as best-effort | JSDoc in `promo-code.validation.ts` |
| GAP-070 | Create operational runbook for advisory lock timeouts | `apps/api/docs/runbook-advisory-locks.md` |

---

## Phase 4: Low-Priority / Trivial Cleanup (~7 hrs)

| GAP | Description | Est. |
|-----|-------------|------|
| GAP-042 | Complete advisory lock registry (all lock IDs) | 1h |
| GAP-045 | `Promise.all` for metrics queries | 0.5h |
| GAP-046 | Wrap retention mark+purge in `withTransaction` | 1h |
| GAP-048 | Capture `Date.now()` at function entry | 0.5h |
| GAP-049 | Add `ctx` to `processExpiredAddonsBatch` | 1h |
| GAP-069 | Remove dead code `minAmount` | 0.25h |
| GAP-039 | Delete stale JSDoc | 0.25h |
| GAP-004 | Update task state.json | 0.25h |
| GAP-003+011+044 | Rename mock tests (remove IT-* labels, **DONE** — T-069) + document SPEC-061 blocker | 1h |
| GAP-007+010+018+019+020+071+073+079+080 | Batch spec text maintenance + corrections | 2h |

---

## Dependency Graph

```
Phase 0 (Infrastructure: migrations + event types)
  |
  +---> Phase 1 (Critical P0: nested tx, TOCTOU, cron locks)
  |       |
  |       +---> Phase 2 (High P1: ctx threading, race fixes, webhook security)
  |       |       |
  |       |       +---> Phase 3 (Medium P2: hardening, cascade, rate limits, promo logic)
  |       |
  |       +---> Phase 4 (Low/Trivial: cleanup, docs, spec maintenance)
```

Key ordering constraints:
1. **Phase 0 before everything** -- migrations and event types are foundational
2. **Phase 1 Batch 1A before Phase 2 Batch 2B** -- both modify `addon.checkout.ts`
3. **Phase 0 GAP-038 before Phase 3 GAP-055+078** -- cascade needs nullable `subscriptionId`
4. **Phase 1 Batch 1E before Phase 3 GAP-036+058** -- trial blocking reuses cron lock pattern
5. **Phase 0 GAP-008 before Phase 3 GAP-035+056** -- compensating events need new event types

---

## Effort Summary

| Phase | Hours | GAP Count | Risk |
|-------|-------|-----------|------|
| Phase 0: Infrastructure | 4.5h | 7 | LOW (schema only) |
| Phase 1: Critical (P0) | 13.5h | 10 | HIGH (financial-critical) |
| Phase 2: High (P1) | 20h | 14 | HIGH (race conditions) |
| Phase 3: Medium (P2) | 25h | 22 | MEDIUM |
| Phase 4: Low/Trivial | 7h | 14 | LOW |
| **Total** | **70h** | **67** | |

---

## Commit Strategy

Each batch = separate conventional commit:
- `fix(billing):` transaction safety fixes
- `fix(cron):` cron lock fixes
- `feat(db):` schema migrations
- `feat(billing):` new features (webhook security, audit trail)
- `refactor(billing):` restructuring (external call isolation)
- `fix(promo):` promo code fixes
- `docs(billing):` documentation
- `chore(billing):` cleanup

---

## Risk Mitigation

1. **Migration rollback**: Test GAP-038+077 migration against existing dunning data
2. **Large files**: `addon.checkout.ts` (~710 lines), `trial.service.ts` (~1171 lines), `addon-expiry.job.ts` (~1401 lines) should be refactored during changes to stay under 500-line limit
3. **Test coverage**: Run `pnpm test:coverage` after each phase
4. **Rollout**: Deploy Phase 0+1 together (critical fixes). Phase 2+3 can be incremental.

---

## New SPECs to Create (out of scope for this plan)

1. **Billing Event Compensation System** (from GAP-006) -- polling + recovery + alerting
2. **Webhook Reliability Hardening** (from GAP-053) -- timeout detection, DLQ, monitoring
