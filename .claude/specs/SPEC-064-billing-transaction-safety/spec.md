# SPEC-064: Billing Transaction Safety

> **Status**: draft
> **Priority**: P1
> **Complexity**: High
> **Origin**: SPEC-053 gaps (GAP-066)
> **Created**: 2026-04-01
> **Depends on**: SPEC-059 (service-layer tx patterns), SPEC-061 (integration testing)
> **Risk**: HIGH (financial-critical code)

## Problem Statement

Billing services in `packages/service-core/src/services/billing/` use a completely different pattern from the rest of the codebase:

- `BillingSettingsService` uses `getDb()` directly without extending `BaseCrudService`
- `promo-code.crud.ts` has 6 standalone functions with `getDb()` direct
- `addon-expiration.queries.ts` and `addon-user-addons.ts` are standalone functions with `getDb()`
- No transaction propagation mechanism exists

Multi-step billing operations (subscription creation, addon purchase, plan changes) can partially fail, leaving financial data inconsistent.

## Affected Files

| File | Pattern | getDb() calls |
|------|---------|---------------|
| `billing/settings/billing-settings.service.ts` | Class, no BaseCrudService | 3+ |
| `billing/promo-code/promo-code.crud.ts` | Standalone functions | 6 |
| `billing/addon/addon-expiration.queries.ts` | Standalone functions | 2+ |
| `billing/addon/addon-user-addons.ts` | Standalone functions | 2+ |
| `billing/promo-code/promo-code.redemption.ts` | Mixed (already uses SELECT FOR UPDATE) | 3+ |

## Proposed Solution

### Phase 1: Add ctx parameter to all billing functions

Add `ctx?: QueryContext` to all standalone billing functions and service methods. Replace `getDb()` with `ctx?.tx ?? getDb()` pattern (lightweight, no model refactor needed).

### Phase 2: Wrap multi-step operations in transactions

Identify billing operations that perform multiple writes and wrap them in `withTransaction`:

- Subscription creation (plan assignment + customer update)
- Addon purchase (purchase record + entitlement grants)
- Plan changes (old plan deactivation + new plan activation)

### Phase 3: Align with BaseCrudService (optional)

Evaluate whether billing services should extend `BaseCrudService` or remain standalone. The promo-code pattern with `SELECT FOR UPDATE` is already correct and may not benefit from BaseCrudService.

## Acceptance Criteria

- [ ] All billing functions accept `ctx?: QueryContext`
- [ ] All `getDb()` calls use `ctx?.tx ?? getDb()`
- [ ] Multi-step billing operations wrapped in transactions
- [ ] Existing billing tests pass
- [ ] Integration tests for critical billing flows (subscription creation, promo-code redemption)
- [ ] `pnpm typecheck` passes

## Estimated Effort

5-7 days

## Risks

- **Financial impact**: Any regression in billing code affects revenue. Extra review required.
- **Existing SELECT FOR UPDATE**: `promo-code.redemption.ts` already has correct locking. Changes must preserve this pattern.
- **Integration test dependency**: Billing tx tests need real DB (SPEC-061).

## Out of Scope

- Refactoring billing to extend BaseCrudService (evaluate only)
- MercadoPago webhook handling (external integration)
- Billing UI changes
