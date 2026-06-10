---
specId: SPEC-150
title: Billing multi-currency support: per-customer locale, multi-currency plan prices, FX fallback, addon currency match
type: feature
status: draft
complexity: high
created: 2026-05-20T00:00:00Z
discoveredDuring: SPEC-143 T-143-62 reframe
tags: [billing, multi-currency, i18n, fx, exchange-rates, feature, schema-change]
effortEstimateHours: "24-40"
depends_on: [SPEC-143]
blocks: []
priority: medium
firstAllocatedViaEngramProtocol: true
parent: SPEC-193
---

# SPEC-150: Billing multi-currency support

## Coordination (SPEC-193)

As a child of SPEC-193 "Billing Go-Live Readiness — Master", this spec is explicitly post-MVP:

- **Post-MVP scope**: multi-currency is out of scope for the initial go-live, consistent with SPEC-122's out-of-scope designation. This spec documents the full design for when the feature is prioritized, but it does not block SPEC-193 completion.
- **Schema coordination with SPEC-192**: the `prices` JSONB column on `billing_plans` (and `billing_addons`) that this spec proposes must be coordinated with SPEC-192, which owns the catalog-to-DB migration. If SPEC-192 ships first (expected), the `prices` column addition goes through the SPEC-178 versioned migration carril after SPEC-192 lands. Both specs cannot add columns to the same tables concurrently.
- **Regression-guard test inversion**: the existing regression-guard test `apps/api/test/e2e/flows/billing/multi-currency.test.ts` was written under SPEC-143 T-143-62 to assert the current single-currency behavior. When SPEC-150 is implemented, those assertions must be inverted to validate the multi-currency paths.
- **Exchange-rate cron advisory lock**: SPEC-194 (T-194-15) adds an advisory lock to the exchange-rate cron to prevent concurrent runs. This is a prerequisite before SPEC-150 enables FX-fallback in checkout (concurrent cron + checkout reads would create a TOCTOU window on the rate). Sequence: SPEC-194 T-194-15 ships before SPEC-150 Phase 3.

## Context

SPEC-143 T-143-62 was scoped as "E2E: multi-currency price selection (ARS / USD / BRL per customer)". The task description listed four assertions:

1. Customer with ARS locale → plan ARS price selected; USD locale → USD price; BRL locale → BRL price.
2. Edge: plan with only USD price + customer ARS → fallback to USD with FX conversion using latest `billing_exchange_rates` row.
3. Stale exchange rate (cron didn't run today) → warning + use last known rate.
4. Currency mismatch between subscription and addon → error.

During reframe (2026-05-20), audit of `packages/db/src/schemas`, `packages/billing/src/constants/billing.constants.ts`, and `apps/api/src/services/subscription-checkout.service.ts` confirmed that **none of the four assertions are achievable today**:

- **billing_customers has no `currency` or `locale` field**. The schema is `id`, `external_id`, `segment`, `status`, plus timestamps. There is no place to read a customer's preferred currency from.
- **billing_plans has single-currency price columns**. Plans store one `priceMonthly` + one `priceAnnual`, not a `prices_by_currency` map nor a separate `billing_plan_prices` table. There is no ARS / USD / BRL slot.
- **Checkout service does not branch on customer currency**. `subscription-checkout.service.ts` calls `findMonthlyPrice(plan.prices)` and returns the single active price. No code path reads customer locale or currency to pick an alternative price.
- **`billing_exchange_rates` table exists but is decorative wrt checkout**. The table + the `/api/v1/public/exchange-rates` + `/protected/exchange-rates` routes + the rates cron all exist (T-143-43 closed). But the checkout service never invokes it. No fallback-to-USD-with-FX-conversion logic.
- **Addon currency mismatch is not validated**. There is no `subscription.currency === addon.currency` check anywhere. Addons inherit the parent subscription currency implicitly because everything is single-currency.

Two constants document the implicit single-currency state:

```ts
// packages/billing/src/constants/billing.constants.ts
export const DEFAULT_CURRENCY = 'ARS';
export const REFERENCE_CURRENCY = 'USD';
```

These constants are read by reporting / formatting code, not by price selection.

T-143-62 has been reframed to a regression-guard test that documents the current single-currency behavior. The real work — schema additions, currency-aware price selection, FX fallback, stale-rate handling, and addon mismatch validation — is captured by this spec.

## Goals

1. Add `currency` (and optionally `locale`) to `billing_customers` so price selection can branch on customer preference.
2. Add multi-currency price storage to `billing_plans` (either currency-keyed JSON map or a separate `billing_plan_prices` table). Same for addons.
3. Implement currency-aware price selection in the checkout services (`subscription-checkout.service.ts`, `subscription-upgrade.service.ts`, `addon-purchase.service.ts`).
4. Implement FX fallback for customers whose preferred currency is not directly priced on the plan, using the latest active row from `billing_exchange_rates`.
5. Define and implement stale-rate behavior: if the rates cron has not run within N hours, emit a structured warning + reuse last known rate (do not block checkout).
6. Add addon currency-mismatch validation: an addon purchase fails fast when its currency differs from the parent subscription currency.

## Non-goals

- Multi-currency payouts or settlement (this is a MercadoPago / banking concern, not Hospeda's).
- Hedging against FX volatility on the merchant side.
- Per-region tax handling (separate concern).
- Migrating historical subscription rows to multi-currency — existing rows are grandfathered as their original price + currency.

## Approach (sketch)

### Schema changes

- `billing_customers`: add `currency` (varchar, default `'ARS'`) + optional `locale` (varchar, default `'es-AR'`).
- `billing_plans`: add `prices` JSONB column keyed by `{ currency: { monthly, annual } }` (e.g. `{ "ARS": { "monthly": 4990_00, "annual": 49900_00 }, "USD": { "monthly": 990, "annual": 9900 } }`). Backfill from existing `priceMonthly` + `priceAnnual` into the `ARS` slot.
- `billing_addons`: same JSONB shape.
- Optional: a `billing_plan_prices` join table if the JSONB approach is rejected on querying grounds (see Risks).

### Service layer

- `subscription-checkout.service.ts`: replace `findMonthlyPrice(plan.prices)` with a `selectPrice({ plan, interval, customer })` helper that:
  1. Returns the direct price if `plan.prices[customer.currency]` exists.
  2. Otherwise picks a fallback currency (default `USD`) and converts using the latest `billing_exchange_rates` row from `customer.currency` to the fallback currency.
  3. Marks the returned price object with `fxConverted: true` + the source rate id, so downstream display + logging can flag it.
- New helper `resolveExchangeRate({ from, to })` in `packages/billing/src/utils/` that:
  1. Reads the latest row from `billing_exchange_rates` for the (from, to) pair.
  2. Throws if no rate exists at all (operator error — cron has never run).
  3. Returns the rate + a `stale: boolean` flag + `lastUpdatedAt` so callers can warn (do not block).
- Addon purchase service: validate `addon.currency === subscription.currency` (after the same `selectPrice` call). Return a typed error mapped to `HTTP 400 ADDON_CURRENCY_MISMATCH`.

### Observability

- Emit a `billing.fx_fallback_used` metric per checkout that hits the FX path.
- Emit a `billing.stale_exchange_rate` warning + Sentry event when a checkout uses a rate older than `STALE_RATE_THRESHOLD_HOURS` (start with 36 — covers two missed daily cron runs).

### Rollout

- Phase 1: schema migration + backfill ARS prices. No behavior change (selectPrice always returns the ARS slot).
- Phase 2: add customer.currency UI + admin form. Default still ARS.
- Phase 3: enable currency-aware selection + FX fallback. Feature-flag-gated until staging smoke + prod smoke pass.

## Risks

- **JSONB price storage queryability**. If we ever want to filter / sort plans by price in a given currency at the DB level, JSONB makes that painful. Mitigation: start with JSONB for speed-of-iteration, plan a future migration to a `billing_plan_prices` join table if querying needs emerge.
- **Stale exchange rate UX**. If the rates cron is down for days, customers paying in non-direct currencies will be quoted from increasingly out-of-date rates. Mitigation: alert at 36h (Sentry warning) and block at 72h (return error to user).
- **MP price + currency mismatch**. MercadoPago checkout preferences carry a single `currency_id` field. If the customer's currency does not match the merchant's MP account country, the checkout will fail at the provider level. Mitigation: keep a "supported currencies for checkout" set (start with ARS only) — non-ARS customers see the price localized but pay in ARS via FX-converted amount. Settlement remains ARS.
- **Concurrent rate updates**. The rates cron writes a new row per (from, to) pair per run. `selectPrice` reads the latest. There is a window where a checkout reads rate A while a new rate B is being written. Mitigation: `selectPrice` snapshots the rate id on the subscription / purchase row so the entire flow is reproducible from the snapshot.

## Open questions

- Does the marketing team want to display prices in the customer's preferred currency on the public site (apps/web) too, or only inside the checkout flow? This decides whether `selectPrice` needs to be exposed via a public API endpoint.
- Should `customer.currency` be inferred from browser `Accept-Language` on signup, or always require an explicit user choice? (Strong recommendation: explicit, to avoid surprises.)
- What is the MP-side flow for non-ARS settlement? (Out of scope here; tracked separately.)

## References

- Reframe context: `apps/api/test/e2e/flows/billing/multi-currency.test.ts` (regression-guard test landed under SPEC-143 T-143-62).
- Related spec: SPEC-148 (defensive grace + plan lifecycle), SPEC-149 (provider error propagation) — both follow the same "reframe + forward spec" pattern.
- Engram registry topic: `spec-registry/hospeda/allocations` (SPEC-150 entry).
