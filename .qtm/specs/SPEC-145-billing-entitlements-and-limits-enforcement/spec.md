---
spec-id: SPEC-145
title: Billing Entitlements & Limits Enforcement
type: feature
complexity: high
status: in-progress
created: 2026-05-18T22:00:00Z
rewritten: 2026-06-03T00:00:00Z
scoped_under: SPEC-193
effort_estimate_hours: 50-80
tags: [billing, entitlements, limits, enforcement, feature-gates, e2e, go-live-gate]
parent: SPEC-193
depends_on: [SPEC-143, SPEC-192]
relates_to: [SPEC-149, SPEC-167, SPEC-194]
blocks: [real-money-go-live]
first_allocated_via_engram_protocol: true
priority: high
worktree: /home/qazuor/projects/WEBS/hospeda-spec-145-billing-entitlements-and-limits-enforcement
branch: spec/SPEC-145-billing-entitlements-and-limits-enforcement
base: staging
---

# SPEC-145: Billing Entitlements & Limits Enforcement

> **Scope note (2026-06-03).** This spec was briefly over-widened to "all billing end-to-end" and then
> reverted to its real scope: **enforcing entitlements and limits on routes**. The end-to-end concerns now
> live in their owners under the master SPEC-193 — catalog/ADR → SPEC-192, webhook errors/observability →
> SPEC-149, downgrade policy → SPEC-167, lifecycle bugs → SPEC-194. This spec **consumes** the catalog; it
> does not own it. It depends on SPEC-192 landing the DB-backed catalog first.

## 1. Context

The billing system loads `userEntitlements` (Set) and `userLimits` (Map) into request context for every
protected route (`entitlementMiddleware`, mounted `create-app.ts:184`) but **most routes that should be
restricted by plan are not gated**. A few gates are wired (rich description, video embed, favorites,
accommodation/promotion/photo limits); most `gateXxx` middlewares are dead code; the error contract is
inconsistent across two patterns; and there is **zero e2e coverage of enforcement against real production
routes** (existing e2e tests cover entitlement *loading* and cache invalidation, not *blocking*).

Without this spec, a customer can pay for the cheap plan and use expensive-only features. This is the
**enforcement** half of the go-live gate.

## 2. Already done (do NOT redo)

| Capability | Where | Source |
|---|---|---|
| `entitlementMiddleware` loads entitlements/limits into context, mounted globally | `entitlement.ts`, `create-app.ts:189` | SPEC-143 |
| Staff bypass (`SUPER_ADMIN/ADMIN/EDITOR/CLIENT_MANAGER` → unlimited), short-circuits before billing/cache | `entitlement.ts:290-303` (roles + helper), `:509` (short-circuit) | SPEC-171 |
| Billing-off / no-customer fallback by role (HOST→owner-basico, others→tourist-free, guest→empty) | `buildHostDraftDefaultsResult`, `buildDefaultEntitlementsResult` | BETA-42 |
| `requireEntitlement`/`hasEntitlement`/`getRemainingLimit`/`clearEntitlementCache` | `entitlement.ts:686,803,843,924` | SPEC-143 |
| `EntitlementKey` (**48** — grew from 40 since first write) + `LimitKey` (6) enums | `packages/billing/src/types/*` | — |
| Refund/dunning revoke + cache-clear behavior (the lifecycle side 145 asserts at route level) | `refund-lifecycle.service.ts` (state-machine + 4 cache-clear sites), `dunning.job.ts:318` | SPEC-194 |
| Pattern A error contract on the 3 LIVE gates (`gateRichDescription`/`gateVideoEmbed`/`gateFavorites` already throw `ServiceError(ENTITLEMENT_REQUIRED)`) | `accommodation-entitlements.ts:111,188`, `tourist-entitlements.ts:68` | post-rewrite drift (verified 2026-06-05) |
| 13 role×plan dev test users seeded (`<slug>@local.test`) — the full matrix Workstream E needs | `packages/seed/src/test-users/testUsers.seed.ts:86-162` | SPEC-143 block 1 |
| Wired gates today: `gateRichDescription`/`gateVideoEmbed` (accom PATCH), `gateFavorites` + `assertFavoritesLimitOrThrow` (bookmark create), `enforceAccommodationLimit` (create/draft/onboarding), `enforcePromotionLimit` (promo create), inline photo limit (admin media upload) | various routes | SPEC-143 |

## 3. Cross-spec dependencies & boundaries

- **Consumes SPEC-192** (DB-backed catalog + single catalog ADR + the `as EntitlementKey`/`as LimitKey`
  cast removal + the FR-4 plan-lookup fix). 145 references the catalog; it does not define or migrate it.
- **INV-1 cache invalidation (master):** 145 owns the *transversal completeness test* and the *stale-cache
  regression guard*. The individual cache-clear calls inside lifecycle events are wired by 194 (refund,
  dunning) and already exist for ~17 events; 145 proves the set is complete.
- **INV-2 error contract:** 145 refactors the gate denials; 149 handles provider-error mapping.
- **Downgrade restriction at route level** is the *enforcement* side (145 e2e); the *policy* (grandfather +
  restrict over-cap resources) is SPEC-167.

## 4. Tasks

### Workstream B — Gate wiring (the feature gap)

- **T-145-01** `docs/billing/endpoint-gate-matrix.md` — every protected/admin route, its decided
  `EntitlementKey`/`LimitKey` or "no gate needed" + reason. Seed with the audit candidates:
  - create/publish accommodation + draft + onboarding/start → `PUBLISH_ACCOMMODATIONS` (on top of existing `MAX_ACCOMMODATIONS`).
  - accommodation update/patch → `EDIT_ACCOMMODATION_INFO`.
  - owner-promotion create/update → `CREATE_PROMOTIONS` (on top of existing `MAX_ACTIVE_PROMOTIONS`).
  - accommodation + destination review create → `WRITE_REVIEWS`.
  - host favorites-breakdown / market-comparison → `VIEW_ADVANCED_STATS`.
  - conversations response-rate / monthly-inquiries → `VIEW_BASIC_STATS`.
  - protected gallery media upload → `MAX_PHOTOS_PER_ACCOMMODATION`.
- **T-145-02** Unify the error contract. Realign 2026-06-05: the 3 LIVE gates are ALREADY Pattern A;
  remaining Pattern B surface = the 12 phantom gates (`gateAlerts`, `gateComparator`, `gateReviewPhotos`,
  `gateSearchHistory`, `gateRecommendations`, `gateExclusiveDeals`, `gateEarlyEventAccess`,
  `gateCalendarAccess`, `gateExternalCalendarSync`, `gateWhatsAppDisplay`, `gateWhatsAppDirect`,
  `gateReviewResponse` — `tourist-entitlements.ts:109-534`, `accommodation-entitlements.ts:238-368+`) plus
  `requireEntitlement` (`entitlement.ts:704`) and `requireLimit` (`entitlement.ts:759,768`). Refactor those
  from `HTTPException(403, JSON.stringify(...))` — which the global `onError` (`response.ts:286-310`) maps
  to `FORBIDDEN` with a stringified body — to `ServiceError(ENTITLEMENT_REQUIRED | LIMIT_REACHED, ...)`
  so `code`/`message`/`details` are correct (matching Pattern A). Fixes INV-2.
- **T-145-03** Wire the entitlement gates from the matrix: publish, edit, create-promotions, write-reviews,
  advanced/basic stats. Each gets a block + allow e2e test (Workstream E).
- **T-145-04** Plumb missing limit counters: `MAX_PROPERTIES` / `MAX_STAFF_ACCOUNTS` are hardcoded
  `currentCount=0` stubs (`limit-enforcement.ts:619,725`). Wire the real count when the owning service
  exists, or register as "reserved" in the matrix so the snapshot test treats it as known (no silent
  never-triggering limit).
- **T-145-05** Favorites gate coverage: confirm matrix decision for list/delete/update/collections. Removal
  must stay ungated (BETA-42 — users at cap can still remove). Wire per matrix.
- **T-145-06** Phantom gates (calendar, external sync, whatsapp display/direct, review-response, alerts,
  comparator, review-photos, search-history, recommendations, exclusive-deals, early-event-access): keep as
  **documented dead code** (owner decision). Add `// PHANTOM-GATE (SPEC-145): route not built yet, see
  endpoint-gate-matrix.md`, register each in the matrix under "reserved — route pending", and except them
  in the snapshot test (T-145-12). Do NOT delete, do NOT build the routes.
- **T-145-07** Document + test admin/staff bypass on the wired gates (INV-6): JSDoc on each `gateXxx` and
  `requireEntitlement`; an e2e test that a staff actor passes a gate a tourist-free actor fails.

### Workstream E — Enforcement e2e coverage

Following SPEC-143 patterns (mp-stub, billing-factories, withRollback/clean, probe). Every test exercises a
**real production route** through the full middleware stack.

- **T-145-08** Block: user whose plan lacks the entitlement → 403 `ENTITLEMENT_REQUIRED`, correct body, no
  DB mutation. One per wired gate.
- **T-145-09** Allow: same route under a plan that grants it → 2xx, side effect lands.
- **T-145-10** Limit: N+1 attempts where the (N+1)th hits a `MAX_*` over a real route → 403 `LIMIT_REACHED`
  with `currentCount`/`maxAllowed`/`remaining`. Cover accommodations, promotions, favorites, photos.
- **T-145-11** Elevation/restriction across plan changes: post-upgrade previously-blocked route → 2xx
  immediately (no TTL wait); post-downgrade (scheduled + cron apply, per 167 policy) premium route → 403.
- **T-145-12** Customer-level override: admin grants a one-off entitlement → 2xx; admin revokes → 403
  immediately. Realign 2026-06-05: the admin grant/revoke route DOES NOT EXIST (no
  `billing/admin/customer-entitlements` route; verified) — this task EXPANDS to build the minimal admin
  route pair (grant/revoke one-off customer entitlement via `billing.entitlements`, PermissionEnum-gated,
  calling `clearEntitlementCache`) following the established `createAdminRoute` + qzpay-admin patterns,
  then the e2e asserts grant→2xx / revoke→403 immediately.
- **T-145-13** Addon limit elevation: cheap plan `MAX_ACCOMMODATIONS=1` + extra-accommodations-5 → allows up
  to 6; after addon-expiry cron → back to 1.
- **T-145-14** Cancellation/refund revocation at route level (refund behavior owned by 194; 145 asserts the
  route-level effect).
- **T-145-15** Trial: grants the trialed plan's entitlements at route level; trial-expiry revokes them.
- **T-145-16** Staff bypass e2e (pairs with T-145-07).
- **T-145-17 [INV-1] Stale-cache regression guard:** pre-populate cache empty, mutate sub state in DB
  without `clearEntitlementCache`, assert the test FAILS; add the call, assert it passes.
- **T-145-18 [INV-1] Transversal cache-invalidation test:** enumerate every money-mutating event
  (activation, upgrade, downgrade-cron, cancel, pause, resume, addon purchase/expiry/cancel, trial
  start/expire, refund, dunning-cancellation, admin grant/revoke) and assert each calls
  `clearEntitlementCache`. This is the master INV-1 guard; the refund/dunning calls themselves are wired by
  194 — this test fails until they are.

### Workstream F — Hardening

- **T-145-19** Route snapshot/guard test: walk every registered route; any `routes/**/protected/**` or gated
  `admin/**` route must be in `endpoint-gate-matrix.md` with a "no gate needed" justification or have an
  entitlement/limit middleware. Phantom/reserved entries excepted explicitly. Fails CI when a new protected
  route lands without a matrix entry.
- **T-145-20** Contributor doc `docs/billing/adding-an-entitlement.md`: enum (192) → seed/plan config → gate
  the route → block+allow e2e → matrix entry.
- **T-145-21** Update `apps/api/CLAUDE.md` + `packages/billing/CLAUDE.md` with the enforcement model:
  middleware chain order, the unified error contract, admin/staff bypass, the `clearEntitlementCache`
  invariant, and the phantom/reserved-key concept.
- **T-145-22** Coverage: 100% functional + line on `entitlement.ts`, `tourist-entitlements.ts`,
  `accommodation-entitlements.ts`, `limit-enforcement.ts` (chunked coverage per SPEC-143; full `--coverage`
  OOMs, engram #636). Realign note: tourist-/accommodation-entitlements have NO standalone test files —
  they're covered inside `entitlement.test.ts` (2498 lines); chunked runs target the source files, not
  test-file granularity.
- **T-145-23 (realign 2026-06-05, absorbed from SPEC-192 §3 residue)** Remove the remaining
  `as EntitlementKey`/`as LimitKey` casts in `entitlement.ts` (lines ~323, 409, 415, 429, 435 — 6+ sites;
  ~11 across apps/api/src). SPEC-192 closed without completing the cast removal this spec's §3 assumed.
  Replace with proper narrowing/validation per ADR-021 (type-cast policy). Small, typed, no behavior change.

## 5. Definition of done

- Endpoint-gate-matrix merged; every gated route has block + allow e2e under the right/wrong plan.
- Error contract unified (INV-2): no gate returns `FORBIDDEN` with a stringified body.
- Admin/staff bypass documented + tested (INV-6).
- INV-1 proven by the transversal + stale-cache tests (the refund/dunning cache calls land in 194; the test
  is the gate that they did).
- Snapshot guard in CI (T-145-19); a new protected route without a matrix entry breaks the build.
- 100% functional coverage on the four enforcement files.
- Manual staging smoke: a fresh cheap-plan user sees 403 on expensive-only features, 2xx on included ones.

## 6. Cross-references

- Master: SPEC-193. Depends on SPEC-192 (catalog). Coordinates with SPEC-149 (error mapping), SPEC-167
  (downgrade policy), SPEC-194 (lifecycle cache-clear calls feed INV-1).
- ADRs: 013 (deferred limit enforcement — this spec activates it), 016 (fail-open), 021 (type-cast policy),
  026 (collections limit). Catalog ADR owned by 192.
- Code: `apps/api/src/middlewares/{entitlement,tourist-entitlements,accommodation-entitlements,limit-enforcement}.ts`;
  `routes/**/protected/**`; `packages/billing/src/types/*`.
- Tests: `apps/api/test/e2e/flows/billing/**`, `apps/api/test/middlewares/{entitlement,limit-enforcement,limit-enforcement-photo}.test.ts`.
- E2e toolkit (verified available): `test/e2e/helpers/` — billing-factories (createTestBillingCustomer/Subscription/Addon/SubscriptionAddon/PromoCode), mp-stub, billing-fixtures, api-client, signature-helpers; `withRollback` via TestDatabaseManager; 13 seeded role×plan dev users.

## Revision History

| Date | Trigger | Changes | Result |
|------|---------|---------|--------|
| 2026-06-05 | spec-realign (post SPEC-192/127/194 merges) | §2 line numbers refreshed (create-app:189, bypass 290-303/509, helpers 686/803/843/924); EntitlementKey 40→48; §2 gained 3 rows (194 refund/dunning behavior, 3 live gates already Pattern A, 13 dev users seeded); T-145-02 narrowed (live gates done; scope = 12 phantom gates + requireEntitlement/requireLimit); T-145-12 expanded (admin grant/revoke route does not exist — build minimal route pair + e2e); T-145-22 noted no standalone test files for tourist-/accommodation-entitlements; NEW T-145-23 absorbs the as-EntitlementKey/LimitKey cast removal SPEC-192 left incomplete; e2e toolkit inventory appended | 23 tasks; status reserved→ready to atomize |
| 2026-06-05 | owner decision | **WRITE_REVIEWS host lockout is intentional.** Hosts on owner/complex plans cannot write reviews (conflict-of-interest: hosts must not review competitors). Hosts keep RESPOND_REVIEWS. This policy is reflected in enforcement-gates.test.ts Gate 4 BLOCK tests (owner-basico is the BLOCK plan) and endpoint-gate-matrix.md review-create rows. | Decision recorded; no task change. |
