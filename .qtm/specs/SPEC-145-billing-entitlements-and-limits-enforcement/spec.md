---
spec-id: SPEC-145
title: Billing Entitlements and Limits Enforcement
type: feature
complexity: high
status: reserved
created: 2026-05-18T22:00:00Z
effort_estimate_hours: 60-90
tags: [billing, entitlements, limits, enforcement, e2e, feature-gates, go-live-gate]
extracted_from: SPEC-143 T-143-09 sub-commit 4 audit (apps/api/src/middlewares/entitlement.ts + tourist-entitlements.ts + accommodation-entitlements.ts review)
depends_on: [SPEC-143]
blocks: [real-money-go-live]
first_allocated_via_engram_protocol: true
priority: high
worktree: null
branch: null
base: staging
---

# SPEC-145: Billing Entitlements and Limits Enforcement

## Context

During SPEC-143 T-143-09 sub-commit 4 implementation (writing an e2e test for "entitlement load post-activation"), an exhaustive audit of the entitlement and limit subsystem surfaced a major feature gap that blocks real-money go-live:

**The billing system charges customers for plans but does not restrict feature access by plan.** Concretely:

1. **`entitlementMiddleware()` is mounted globally** (`apps/api/src/utils/create-app.ts:184`) and correctly loads `userEntitlements: Set<EntitlementKey>` and `userLimits: Map<LimitKey, number>` into the request context for every protected route. This part of the pipeline works as designed.

2. **No production endpoint reads or enforces those values.** A grep across `apps/api/src/routes/**` for `requireEntitlement`, `hasEntitlement`, `userEntitlements`, or `userLimits` returns zero results. The middleware computes correctly but the result is discarded.

3. **The `gateXxx` middlewares are fully implemented dead code.** `apps/api/src/middlewares/tourist-entitlements.ts` exports `gateFavorites`, `gatePriceAlerts`, `gateCompareAccommodations`, `gateAttachReviewPhotos`, `gateViewSearchHistory`, `gateViewRecommendations`, `gateExclusiveDeals`, and `gateEarlyAccessEvents`. `apps/api/src/middlewares/accommodation-entitlements.ts` exports a similar family. None of them are mounted on a single route.

4. **The cheap test plan uses an entitlement value that is not in the `EntitlementKey` enum.** `apps/api/test/e2e/setup/seed-helpers.ts:352` declares `entitlements: ['public:read']` but `'public:read'` does not exist in `packages/billing/src/types/entitlement.types.ts`. The middleware accepts it because of the `as EntitlementKey[]` cast at `entitlement.ts:195` — a TypeScript escape hatch that silently masks the mismatch.

5. **Latent bug at `apps/api/src/middlewares/actor.ts:178`.** The actor middleware reads `c.get('userEntitlements')` to populate `actor.entitlements`, but the actor middleware runs at position 175 of the chain and the entitlement middleware runs at position 184. The `userEntitlements` value is therefore always `undefined` at that read site. The resulting `actor.entitlements = undefined` is then never used downstream, which is why the bug has not surfaced.

6. **`clearEntitlementCache` coverage is unknown.** The annual confirmation path correctly invalidates the cache (`apps/api/src/routes/webhooks/mercadopago/payment-logic.ts:183`), but no audit confirms that subscription cancellation, plan downgrade, addon revoke, customer-level grant/revoke, or any other entitlement-mutating event invalidates the cache. Stale-cache bugs in those paths would block legitimate access or grant illegitimate access for up to five minutes (the cache TTL).

This spec is the formal follow-up of SPEC-143. SPEC-143 was intentionally scoped to **testing existing billing flows**; this spec carries the **enforcement implementation work** so that the billing surface goes to production with both the tests and the gates in place. Without this spec, customers can pay for any plan and use any feature regardless of what they paid for.

This spec was allocated through the engram-backed spec-registry protocol (CLAUDE.md § "Spec Number Allocation"). Number 145 was reserved on 2026-05-18 (engram observation under topic `spec/spec-145/reserved`) after the SPEC-143 audit surfaced the feature gap.

## Goal

Wire the entitlement and limit subsystem from "loads correctly into context but is ignored" to "enforced end-to-end across every protected route that should be gated", with full e2e coverage (block, allow, post-upgrade elevation, post-downgrade restriction, customer overrides, addon-elevated limits, post-cancellation revocation) so real-money production charging restricts features by plan as the product expects.

## Workstreams

- **A — Catalog and reconciliation** (Phase 0). Single source of truth for what entitlements and limits exist, what they mean, and which plan grants which.
- **B — Gate wiring** (Phase 1). Connect existing `gateXxx` middlewares to real routes and add new gates where needed.
- **C — Bug fixes** (Phase 2). Fix the latent bugs discovered during the SPEC-143 audit.
- **D — E2E coverage** (Phase 3). Vitest e2e tests following the SPEC-143 patterns (mp-stub, billing-fixtures, withRollback / clean) covering every enforcement flow.
- **E — Hardening** (Phase 4). Snapshot tests, documentation, and contributor guidance to prevent regression.

## Phases (priority = financial risk + feature criticality)

### Phase 0 — Foundations: catalog and reconciliation

Define the source of truth for entitlements and limits so every later phase has stable ground to stand on. The team defines the catalog; no external PM dependency.

- T-145-01 Audit `EntitlementKey` enum in `packages/billing/src/types/entitlement.types.ts` against every usage in `apps/api/src/`, `apps/admin/src/`, `apps/web/src/`, `packages/`, and test seeds. Produce a `mismatches.md` listing every string-literal entitlement key that is not in the enum (e.g. `'public:read'`).
- T-145-02 Same audit for `LimitKey` enum.
- T-145-03 Define the final catalog: every `EntitlementKey` and `LimitKey` that the product needs, with a one-line description and the plan(s) that should grant it. Output: ADR-NNN-billing-entitlement-and-limit-catalog.md.
- T-145-04 Reconcile: add missing enum values, remove unused ones, update seed plans to use only enum values, update production plan config (`HOSPEDA_BILLING_DEFAULT_PLANS` or wherever plans are bootstrapped) to match the catalog. CI gate must reject any string-literal entitlement value that does not parse as `EntitlementKey`.

### Phase 1 — Wire gates to real routes (the feature gap)

Connect the entitlement and limit subsystem to the surfaces that the product needs to restrict. This is the largest phase in line count and in test count.

- T-145-05 Endpoint-to-gate matrix. Iterate over every protected route under `apps/api/src/routes/**`, decide which `EntitlementKey` / `LimitKey` (if any) should gate the route per the Phase 0 catalog, and produce `docs/billing/endpoint-gate-matrix.md`. This is the planning document that drives the rest of Phase 1.
- T-145-06 Wire favorites gates (`gateFavorites`) onto the favorites routes per the matrix.
- T-145-07 Wire accommodation gates (publish, edit, rich description, photos, advanced stats) onto the accommodation routes.
- T-145-08 Wire price-alerts, compare, search-history, recommendations, exclusive-deals, early-access tourist gates onto their respective routes.
- T-145-09 Wire reviews-attach-photos gates.
- T-145-10 Wire any remaining accommodation or destination gates per the matrix.
- T-145-11 For routes that should be gated but have no existing `gateXxx`, define new gates following the same pattern (HTTPException 403, JSON body with `code: 'ENTITLEMENT_REQUIRED'` or `code: 'LIMIT_REACHED'`, `details.upgradeUrl: '/billing/plans'`).
- T-145-12 For routes that should be limit-gated but have no current usage counter, plumb the usage source (`c.set('currentFavoritesCount', n)` etc) from the service layer.
- T-145-13 Admin override: ensure admin actors bypass all gates (`actor.role === 'admin'` short-circuits enforcement). Document the bypass in the JSDoc of `requireEntitlement` and each `gateXxx`.

### Phase 2 — Fix latent bugs surfaced during the SPEC-143 audit

- T-145-14 Fix `apps/api/src/middlewares/actor.ts:178` ordering bug. Two options to evaluate: (a) move the `userEntitlements` lookup into a deferred resolver that runs lazily when `actor.entitlements` is first read, (b) populate `actor.entitlements` in the entitlement middleware itself after it sets `userEntitlements`. Pick one based on which downstream code (if any) actually consumes `actor.entitlements`. If none, delete the block.
- T-145-15 Audit `apps/api/src/middlewares/limit-enforcement.ts` for live vs dead code. If live, document its mount points; if dead, delete it.
- T-145-16 `clearEntitlementCache` invocation audit. Grep every code path that mutates a subscription, plan, customer-level grant, addon purchase, or addon revoke. Verify each one calls `clearEntitlementCache(customerId)` synchronously after the DB write. Add the call where missing. Cover: monthly checkout confirmation, plan upgrade apply, plan downgrade apply (cron), subscription cancel, subscription pause, subscription resume, addon purchase confirmation, addon revoke, customer-level entitlement grant via admin, customer-level entitlement revoke via admin, refund-induced revocation.
- T-145-17 Replace the unsafe `as EntitlementKey[]` cast at `apps/api/src/middlewares/entitlement.ts:195` with a runtime parse that warns when an unknown entitlement value reaches the middleware. Same for limits at line ~200.

### Phase 3 — E2E coverage (Workstream D)

Following the SPEC-143 patterns (mp-stub, billing-fixtures, withRollback / clean, mini-app probe where needed). Every test arranges the necessary plan + customer + subscription state, exercises a real HTTP route through the full middleware stack, and asserts the gate outcome.

- T-145-18 Test: user on cheap plan, GET endpoint gated by a Phase 1 entitlement key the cheap plan does not have → 403 `ENTITLEMENT_REQUIRED`, body shape, no DB mutation.
- T-145-19 Test: user on cheap plan, POST endpoint gated by an entitlement the cheap plan does grant → 2xx, side effect lands in DB.
- T-145-20 Test: user on cheap plan respecting a `MAX_*` limit, performs N+1 attempts where the (N+1)th lands the limit → 403 `LIMIT_REACHED`, details include `currentCount`, `maxAllowed`, `remaining: 0`.
- T-145-21 Test: same user upgrades to expensive plan via the upgrade flow (SPEC-143 T-143-11 coverage assumed). Immediately after activation, retry the previously-blocked endpoint → 2xx without waiting for the cache TTL.
- T-145-22 Test: user on expensive plan, schedules downgrade to cheap (effective at period end). Before the cron runs, expensive-only feature still works. After the cron runs, feature is blocked → 403.
- T-145-23 Test: customer-level entitlement grant (via admin override). Cheap-plan user receives a one-off grant for an expensive feature. Endpoint returns 2xx. Admin revokes the grant. Endpoint returns 403 immediately (cache invalidated).
- T-145-24 Test: addon purchase elevates a limit. User on cheap plan with `MAX_ACCOMMODATIONS: 1` purchases an addon that adds 5 accommodations. Limit-gated endpoint now allows up to 6 accommodations. After addon expires (cron), limit drops back to 1.
- T-145-25 Test: subscription cancellation revokes entitlements at the moment the sub transitions to `canceled` (or end of grace period, per product decision).
- T-145-26 Test: trial subscription grants entitlements identical to the trialed plan; trial expiration (T-143-15 + cron) revokes them.
- T-145-27 Test: stale-cache regression guard. Pre-populate the entitlement cache with an empty set, mutate the subscription state in DB without calling `clearEntitlementCache`, verify the test FAILS. Then add the missing `clearEntitlementCache` call and verify the test passes. (Meta-test that protects Phase 2 T-145-16 from regression.)

### Phase 4 — Hardening

- T-145-28 Snapshot test that walks every registered route in the app and asserts that any route under `apps/api/src/routes/protected/**` is either listed in `docs/billing/endpoint-gate-matrix.md` with an explicit "no gate needed" justification or has at least one entitlement/limit middleware in its chain. Test fails CI if a new protected route is added without an entry in the matrix.
- T-145-29 Contributor docs in `docs/billing/adding-an-entitlement.md`. Step-by-step: add to enum, add to seed, add to plan config, gate the route, add the e2e test.
- T-145-30 Update `apps/api/CLAUDE.md` and root `CLAUDE.md` to describe the enforcement model (middleware chain, gate pattern, admin bypass, cache invalidation contract).

Additional atomic tasks (T-145-31 and beyond) will be created during atomization once the Phase 0 catalog firms up; estimated 30–50 more atomic tasks across Phases 1 and 3 depending on the surface area the matrix in T-145-05 produces. Total target: 60–80 atomic tasks at complexity ≤ 4 each.

## Definition of done

- Phase 0 catalog ADR merged and referenced by every later task.
- Endpoint → gate matrix (T-145-05) merged.
- Every route listed in the matrix has its gate wired and an e2e test that proves block + allow behavior under the appropriate plan.
- Phase 2 latent bugs fixed; `clearEntitlementCache` invocation audit complete and every entitlement-mutating event invalidates the cache.
- 100% functional + line coverage on `apps/api/src/middlewares/entitlement.ts`, `tourist-entitlements.ts`, `accommodation-entitlements.ts`, `limit-enforcement.ts` (if kept).
- Phase 4 snapshot test (T-145-28) passing in CI; any new protected route added after this spec lands without an entry in the matrix breaks the build.
- Manual smoke checklist run in STAGING confirms that a freshly-signed-up cheap-plan user sees the expected 403 on expensive-only features and 2xx on cheap-included features.

## Workstream split with SPEC-143

| Concern | SPEC-143 | SPEC-145 (this spec) |
|---|---|---|
| Webhook signature, idempotency, dunning, etc | YES | — |
| Checkout flows (annual, monthly, upgrade, downgrade) | YES | — |
| Entitlement middleware loads correctly post-activation | YES (T-143-09 sub-commit 4) | — |
| Production routes enforce entitlements/limits | — | YES |
| `gateXxx` middlewares mounted on real routes | — | YES |
| `clearEntitlementCache` invocation audit | partial (annual confirmation only) | YES (full audit) |
| Endpoint → gate matrix | — | YES |

SPEC-143 stays narrow on testing what exists. SPEC-145 stays narrow on enforcement. The two are sequential: SPEC-143 merges first to staging, then SPEC-145 activates.

## Activation criteria

This spec is `reserved`. Activation (flip to `in-progress`, create worktree `hospeda-spec-145-billing-entitlements-and-limits-enforcement`, cut branch `spec/SPEC-145-billing-entitlements-and-limits-enforcement` from staging, register in `.qtm/tasks/index.json`) happens when **either** of:

1. SPEC-143 merges to staging (preferred sequential path).
2. The user explicitly authorizes parallelization while SPEC-143 is still in flight.

## Risks

- **Scope creep on Phase 0 catalog.** Defining the catalog can pull in product debates ("does feature X belong to cheap or expensive?"). Mitigation: time-box T-145-03 to a single sit-down, document defaults that can be revised later, do not block phase 1+ on unrelated catalog debates.
- **Surface area in Phase 1.** Wiring every protected route is large by default; the matrix in T-145-05 may surface 50+ endpoints. Mitigation: prioritize by financial value (publish/edit/photos/limits first; vanity features later) and ship in batches.
- **Cache invalidation completeness.** Missing a single `clearEntitlementCache` site causes silent bugs (users locked out or granted illegitimate access for up to 5 minutes). Mitigation: T-145-27 meta-test + manual grep checklist in the PR description template.
- **Test runtime.** Adding 10+ enforcement e2e tests on top of the SPEC-143 suite may push CI runtime past the budget. Mitigation: reuse the same `testDb.withRollback` / `testDb.clean()` setup, and parallelize within vitest if needed.

## Cross-references

- Engram `spec/spec-145/reserved` — reservation rationale and audit summary.
- Engram `spec/spec-143/t-143-09-checkpoint` (#564) — SPEC-143 state at handoff.
- Engram `spec-registry/hospeda/last-number` — registry source of truth.
- `apps/api/src/middlewares/entitlement.ts` — `entitlementMiddleware`, `requireEntitlement`, `hasEntitlement`, `clearEntitlementCache`, `getEntitlementCacheStats`.
- `apps/api/src/middlewares/tourist-entitlements.ts` — `gateFavorites` and friends (dead code today, target of Phase 1).
- `apps/api/src/middlewares/accommodation-entitlements.ts` — same.
- `apps/api/src/middlewares/limit-enforcement.ts` — possibly dead, audit in T-145-15.
- `packages/billing/src/types/entitlement.types.ts` — `EntitlementKey` enum.
- `packages/billing/src/types/plan.types.ts` — `LimitKey` enum.
- `apps/api/test/middlewares/entitlement.test.ts` — existing unit test pattern reusable in Phase 3.
- `apps/api/test/e2e/flows/billing/annual-checkout.test.ts` — sub-commit 4 of SPEC-143 T-143-09 is the entry point that surfaced this spec.
