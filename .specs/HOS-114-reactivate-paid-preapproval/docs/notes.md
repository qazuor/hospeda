# HOS-114 — Implementation notes (T-001 wiring map)

Read-only investigation output. All anchors verified against the worktree at
`hospeda-hos-114-reactivate-route-paid-checkout` on 2026-07-10. Where the spec's
own line numbers / claims were stale or wrong, the correction is called out.

> ⚠ Three spec claims were WRONG — read §Corrections before implementing.

## 1. Buggy service methods — `apps/api/src/services/trial.service.ts`

### `reactivateFromTrial` (method `916–1079`, input destructure `924`)

- **Buggy create call**: `943–950` — `this.billing.subscriptions.create({ customerId, planId, metadata })`. No `priceId`, no `mode`, no `billingInterval`, no `paymentMethodReturnUrl`, no `notificationUrl`.
- Metadata markers written: `convertedFromTrial: 'true'` + `convertedAt` (`947–948`).
- `newSubscription.id` usages: audit insert `956`; Sentry extra `971`; error log `975`; fallback audit `982`; success log `1058`; return value `1064`.
- **Synchronous cancel-old-sub block**: loop over `existingSubscriptions`, cancels any `status === 'trialing'` sub at `1002–1028` (`this.billing.subscriptions.cancel(sub.id)` at `1006`); cancel-failure inline reconciliation `1032–1050`.
- **Audit insert** (`billingSubscriptionEvents`, `triggerSource:'trial-reactivation'`): `955–965`, Sentry-captured fallback `966–998`.
- **`clearEntitlementCache(customerId)`**: `1053` (synchronous, inline — must move to webhook, see T-007).
- No active/trialing guard (unlike `reactivateSubscription`).

### `reactivateSubscription` (method `1092–1238`, input destructure `1100`)

- **Buggy create call**: `1134–1142` — same shape (customerId/planId/metadata only).
- Metadata markers: `reactivatedFromCanceled:'true'`, `reactivatedAt`, `previousPlanId` (`1138–1140`).
- `newSubscription.id` usages: audit `1148`; Sentry `1165`; error log `1173`; fallback audit `1180`; success log `1217`; return `1225` (`{ subscriptionId, previousPlanId }`).
- **Synchronous cancel-old-sub block**: loops subs with `status === 'canceled'`, `this.billing.subscriptions.cancel(sub.id)` at `1199–1209` (swallows "already canceled").
- **Audit insert** (`triggerSource:'subscription-reactivation'`): `1147–1157`, Sentry fallback `1159–1197`.
- **`clearEntitlementCache(customerId)`**: `1212`.
- **Guards unique to this method**: rejects if any sub is `active`/`trialing` (`1112–1120`); requires a `canceled` sub to exist (`1124–1128`).

`clearEntitlementCache` imported at `trial.service.ts:40`.

## 2. Route files — `apps/api/src/routes/billing/trial.ts` (both endpoints, one file)

Mounted under `/api/v1/protected/billing/trial`.

- **`POST /reactivate`** — `reactivateTrialRoute` `304–375`, handler `312–374`.
  - Request schema `reactivateTrialRequestSchema` (LOCAL, `83–85`): `z.object({ planId: z.string().min(1) })` — **no catalog / free / annual validation**.
  - Body validated `329–337`; calls `trialService.reactivateFromTrial({ customerId: billingCustomerId, planId })` at `344–347`.
  - Response built `349–353`; local `reactivateTrialResponseSchema` `90–94` → `{ success, subscriptionId, message }`.
- **`POST /reactivate-subscription`** — `reactivateSubscriptionRoute` `482–554`, handler `490–553`.
  - Request schema `reactivateSubscriptionRequestSchema` (LOCAL, `458–460`): same bare `planId`.
  - Body validated `507–515`; calls `trialService.reactivateSubscription({ customerId: billingCustomerId, planId })` at `522–525`.
  - Response built `527–532`; local `reactivateSubscriptionResponseSchema` `465–470` → `{ success, subscriptionId, previousPlanId?, message }`.
- Routes registered on `trialRouter` `563–564`.
- `planId` is **never** validated against the catalog in either handler or service.

## 3. Live web callers — spec's "unwired" claim CONFIRMED (with asymmetry)

- `/reactivate-subscription`: one wrapper `billingApi.reactivateSubscription` at `apps/web/src/lib/api/endpoints-protected.ts:622–631` (path at `628`). **Zero call sites** in web components/pages — dead wrapper.
- `/reactivate`: **no wrapper at all** in `endpoints-protected.ts` (spec implied both had wrappers — only `reactivate-subscription` does).
- The only real caller of `/reactivate` in the repo is an **E2E test**: `apps/e2e/tests/host/host-02-trial-upgrade-mp.spec.ts:123` (direct HTTP POST). Not a UI path — but it asserts today's synchronous response shape, so changing the contract (T-008) BREAKS this test → it must be updated alongside (folded into T-009 scope).
- Net: no hidden UI caller. Scope unchanged.

## 4. Correct paid pattern to mirror — `apps/api/src/services/subscription-checkout.service.ts`

`initiatePaidMonthlySubscription` (`451–~700+`):

- Plan resolution: `resolvePlanBySlug(billing, planSlug)` (`196–218`) — matches on `p.name === planSlug` (name IS the slug), called `459`.
- Price helpers: `findMonthlyPrice` (`260–265`, `billingInterval==='month' && intervalCount===1`), `findAnnualPrice` (`286–291`), `findDailyPrice` (`274–278`).
- **`subscriptions.create({...})`**: `657–674` — `planId: plan.id`, `priceId: monthlyPrice.id`, `mode:'paid'`, `billingInterval:'monthly'`, `paymentMethodReturnUrl`, `notificationUrl`, optional `freeTrialDays`, `metadata`.
- **`checkoutUrl = subscription.providerInitPoint ?? subscription.providerSandboxInitPoint`**: `676`.
- **Fail-closed**: `678–683` — `throw new SubscriptionCheckoutError('MISSING_INIT_POINT', ...)`.
- `SubscriptionCheckoutError` class `186–194`; `SubscriptionCheckoutErrorCode` union `164–179` (`MISSING_INIT_POINT` at `170`).
- Doc `441–445`: resulting sub is `incomplete` until `subscription_preapproval.created` webhook flips it.

**Helper extraction target (T-002)**: lines `657–683` (create + checkoutUrl resolution + throw).

## 5. Webhook activation handler — ⚠ SPEC WAS WRONG on file AND event

Spec said `apps/api/src/routes/billing/` + event `subscription_authorized_payment.created`. **Both wrong.**

- Activation lives under **`apps/api/src/routes/webhooks/mercadopago/`** (not `routes/billing/`).
- Driving event is **`subscription_preapproval.created` / `.updated`** — registered in `webhooks/mercadopago/router.ts:141–142` → `handleSubscriptionPreapprovalEvent`.
- `subscription_authorized_payment.created/.updated` (`router.ts:151–152` → `handleSubscriptionAuthorizedPayment`) is a **different** event — records recurring-charge `billing_payments` rows, NOT the initial activation.
- Wrapper: `handleSubscriptionPreapprovalEvent` at `webhooks/mercadopago/subscription-handler.ts:43–70` → delegates to `processSubscriptionUpdated`.
- **Precise transition logic**: `processSubscriptionUpdated` in **`apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts`** (`233–~900`):
  - Status map `QZPAY_TO_HOSPEDA_STATUS`: `92–99`.
  - Stored-status normalize (`incomplete → PENDING_PROVIDER`, HOS-108 fix): `packages/service-core/src/services/billing/subscription/subscription-status-normalize.ts:86–97` (map `48–58`, `incomplete: PENDING_PROVIDER` at `56`); called in `subscription-logic.ts:414`.
  - Transition guards: pre-tx `checkSubscriptionStatusTransition` `466–488`; in-tx (`SELECT … FOR UPDATE`) `616–640`.
  - Atomic write tx `withServiceTransaction` `517–692`; `UPDATE billing_subscriptions` `642–645`; audit insert `666–684`.
  - **Post-commit side effects** start `694–698`; **`clearEntitlementCache(localSubscription.customerId)` at `701`** ← natural insertion point for the deferred old-sub cancellation.
  - Commerce/partner reconciliation `706–716`.
  - ⚠ This function is GENERIC (handles paused/cancelled/past-due/active). The deferred "cancel old sub" MUST gate on the specific `PENDING_PROVIDER → ACTIVE` transition, not fire on every status change. Read `supersedesSubscriptionId` from the confirmed sub's metadata there.

## 6. planId → priceId + catalog — `packages/billing/src/config/plans.config.ts`

- This file is **seed-time config only** (`ALL_PLANS`, `PlanDefinition[]`). Runtime source of truth after seeding is the DB (`billing_plans` / `billing_prices`), so resolve via `billing.plans.list()` at request time, not this static file.
- Runtime resolution pattern: `resolvePlanBySlug` + `findMonthlyPrice` (item 4). Returns plan with `.prices[]`; `.id` of the monthly price row = `priceId`.
- **⚠ Identifier-space ambiguity (T-004 must resolve)**: `resolvePlanBySlug` matches on **slug** (`plan.name`), but the reactivate `planId` field is passed straight to `billing.subscriptions.create({ planId })`. `billing_plans.id` is UUID, `billing_subscriptions.plan_id` is varchar — two different id spaces. Before writing the guard, confirm whether reactivate's `planId` is a slug or a UUID and resolve accordingly.
- Free-plan detection: `plan.monthlyPriceArs === 0` (`TOURIST_FREE_PLAN.monthlyPriceArs = 0` at config `414`; runtime it's the typed `monthly_price_ars` column, exposed on the plan object). **No such guard exists yet** — this is new code, not an extraction.
- Annual vs monthly: `PlanDefinition` has separate `monthlyPriceArs` / `annualPriceArs` (`annualPriceArs: null` when no annual option); runtime = separate price rows by `billingInterval` (`'month'` vs `'year'`).

## 7. Response schema — ⚠ NOT in `@repo/schemas` (spec premise off)

- Runtime response schemas are **local inline** in `apps/api/src/routes/billing/trial.ts` (`reactivateTrialResponseSchema` `90–94`; `reactivateSubscriptionResponseSchema` `465–470`) — both synchronous-success shapes with **no `checkoutUrl`** and no room for one.
- `@repo/schemas` (`packages/schemas/src/api/billing/trial.schema.ts`) only has `ReactivateTrialRequestSchema` (`25–32`, request-only) and it is **dead code** (route re-declares its own local `reactivateTrialRequestSchema`). No response schema for either endpoint; no schema at all for `/reactivate-subscription`.
- T-008 recommendation: introduce proper request+response schemas in `@repo/schemas` (fixing the drift) rather than extending the local ones — but confirm with owner since it widens the diff slightly.

## Post-T-004 — plan guard landed + ambiguity RESOLVED

- **planId IS a UUID** (`billing_plans.id`), NOT a slug. Evidence: E2E host-02 selects `bp.id` via SQL and posts it as `planId`; the T-002 helper JSDoc calls reactivation the "UUID-keyed caller". So the guard resolves `plan.id === planId`, NOT `plan.name`. (Corrects the notes §6 uncertainty.)
- **Free detection is `plan.prices[].unitAmount === 0`**, NOT `monthlyPriceArs` — that field is NOT on the qzpay runtime plan object (only a DB column / seed config). Every runtime site derives free/annual from `plan.prices[].unitAmount`. (Corrects spec §6.1 / notes §6.)
- **New guard**: `resolveReactivationPlan({ billing, planId }) → { plan, priceId }` at `apps/api/src/services/billing/reactivation-plan-guard.ts`. Throws `PLAN_NOT_FOUND` (unknown), `INVALID_REACTIVATION_PLAN` (free), `ANNUAL_REACTIVATION_UNSUPPORTED` (no monthly price). T-005/T-006 call this FIRST, then pass the returned `{ plan.id, priceId }` into `createPaidSubscription`.
- Three new codes added to `SubscriptionCheckoutErrorCode` in `subscription-checkout-error.ts`; `start-paid.ts:mapServiceErrorToHttp` switch got the matching 422 mappings (union exhaustiveness). 53 tests green.

## Post-T-002/T-003 — shared helper landed

- **New helper**: `createPaidSubscription({ billing, customerId, planId, priceId, paymentMethodReturnUrl, notificationUrl, freeTrialDays?, metadata? }) → { subscription, checkoutUrl }` at `apps/api/src/services/billing/paid-subscription-create.ts`. This is what T-005/T-006 import (pass RESOLVED planId + priceId).
- **Error type moved**: `SubscriptionCheckoutError` + `SubscriptionCheckoutErrorCode` now live in `apps/api/src/services/billing/subscription-checkout-error.ts` (neutral module to break the ESM cycle). `subscription-checkout.service.ts` re-exports both for backward compat, so existing imports still work — but NEW code (trial.service.ts) should import from the neutral module directly to avoid re-introducing the cycle.
- `initiatePaidMonthlySubscription` now calls the helper; `/start-paid` + 185 billing tests green (R-5 verified).
- Test convention confirmed: tests live at `apps/api/test/services/billing/` mirroring `src/`, NOT colocated under `src/.../test/`.

## Post-T-005/T-006/T-008 — reactivate methods rewritten

- Both methods now: `resolveReactivationPlan` → ensure customer (new `CUSTOMER_NOT_FOUND` guard) → build urls → `createPaidSubscription` → return `{ success, subscriptionId, checkoutUrl, status:'incomplete', message }` (+`previousPlanId` for reactivateSubscription). Synchronous cancel/audit/clearEntitlementCache REMOVED, replaced with `// Deferred to webhook (HOS-114 T-007): cancel superseded sub + audit + clearEntitlementCache on PENDING_PROVIDER->ACTIVE`.
- `supersedesSubscriptionId` written to create metadata (comma-joined if multiple old subs).
- **Shared modules extracted** (dedup from start-paid, satisfies AC-7): `apps/api/src/routes/billing/checkout-return-urls.ts` (url builders) + `apps/api/src/services/billing/subscription-checkout-error-http.ts` (`mapSubscriptionCheckoutErrorToHttp`). start-paid.ts now imports both.
- **Schemas** in `@repo/schemas` (`packages/schemas/src/api/billing/trial.schema.ts`): `ReactivateTrialResponseSchema`, `ReactivateSubscriptionRequestSchema`, `ReactivateSubscriptionResponseSchema`. `status` modeled as `z.enum(['incomplete'])` standalone literal (qzpay raw status, NOT the Hospeda `SubscriptionStatusEnum` which has no `incomplete` — it normalizes to `PENDING_PROVIDER`). trial.ts imports these, local schemas deleted.
- Types extended in `packages/service-core/src/services/billing/addon/trial.types.ts` (`ReactivationCheckoutUrls`, `ReactivateFromTrialResult`, `urls` on inputs).
- 210/210 API tests + 15/15 schema tests green.

### ⚠ Pre-existing baseline failures (NOT our regressions)

`apps/api/test/integration/trial-lifecycle.test.ts` — `startTrial > should start a trial...` and `blockExpiredTrials > should cancel expired...` FAIL on a clean unmodified checkout too (verified via git show HEAD copy). Do NOT attribute these to HOS-114 during T-010/T-011.

## Post-T-007 — webhook supersession landed

- `completeReactivationSupersession()` at `subscription-logic.ts:209-390`, called at `:701-724` right after the existing `clearEntitlementCache`. Gate: `previousStatus === PENDING_PROVIDER && mappedStatus === ACTIVE` (both already computed in `processSubscriptionUpdated`).
- Reads `localSubscription.metadata.supersedesSubscriptionId` (single or comma-joined). Absent → no-op (plain /start-paid). Per superseded id: cancel (swallow "already canceled") + write `billingSubscriptionEvents` audit (triggerSource trial-reactivation/subscription-reactivation inferred from convertedFromTrial/reactivatedFromCanceled marker). Per-id try/catch + Sentry so a failure never undoes the committed activation.
- **⚠ Idempotency keyed off AUDIT-ROW EXISTENCE, not superseded-sub status.** Critical subtlety: in the lapsed-reactivation flow the superseded sub is ALREADY `cancelled` before the webhook fires (it's the canceled sub being reactivated from), so a status-based "skip if already cancelled" guard would permanently drop that flow's audit. Checks for an existing event on `(localSubscription.id, supersededId)` before writing.
- Entitlement cache: NO second clear — the `:701` call already covers the customer (both reactivation flows keep the same customerId). AC-4 "cleared exactly once" satisfied.
- 147/147 webhook + trial.service tests green. This CLOSES the double-subscription window left open by T-005/T-006.

## Post-review — T-015/T-016 hardening (owner: full robustness)

- **Shared `completeSupersessionPairing`** at `apps/api/src/services/billing/reactivation-supersession-complete.ts` — single source used by BOTH the webhook (`completeReactivationSupersession`, now a thin per-id loop) AND the reconcile cron. Owns idempotency (audit-row existence) + cancel + T-015a re-verify + audit insert.
- **T-015a cancel hardening**: after `billing.subscriptions.cancel`, RE-FETCH via `billing.subscriptions.get()`. Confirmed terminal → write audit (done). Still active/trialing OR indeterminate (null) → Sentry + log + DO NOT write audit (conservative default; leave for cron). Fixes the MEDIUM (transient cancel masked forever).
- **T-015b**: `ACTIVE_SUBSCRIPTION_EXISTS` (409) + `NO_CANCELED_SUBSCRIPTION` (404) codes added; reactivateSubscription throws typed SubscriptionCheckoutError instead of plain Error (was 500).
- **T-016 reconcile cron**: `apps/api/src/cron/jobs/reactivation-supersession-reconcile.job.ts`, registered in cron/jobs/index.ts + registry.ts + schedules.manifest.ts. **Hourly** (`0 * * * *`) — money-correctness (orphaned old preapproval can double-charge), mirrors abandoned-pending-subs not the 6h display backstop. Finds active/trialing subs referenced in an active sub's supersedesSubscriptionId metadata with no completion audit → cancel + audit via the shared fn.
- 947 API tests green.

### Post-review-2 fix (2 blockers resolved) — caveat now largely closed in code

Second focused review found 2 BLOCKERS, both fixed:

- **HIGH**: reconcile cron skipped the lapsed flow (superseded sub locally `canceled` = terminal, cron only entered on non-terminal). Also `billing.subscriptions.get()` reads LOCAL storage ONLY (verified in qzpay-core dist) — so the T-015a re-verify was a no-op for lapsed. FIX: shared fn now selects `mpSubscriptionId` on the superseded row; if present (lapsed flow, had a real preapproval) it re-verifies via `paymentAdapter.subscriptions.retrieve(mpSubscriptionId)` — a REAL provider round-trip (mirrors subscription-poll.job.ts); if absent (trial flow, `mode:'trial'`, no preapproval, zero money risk) it falls back to local get(). Cron candidate selection decoupled from local status (active supersessor + no completion audit); cron builds its own MP adapter + calls clearEntitlementCache after reconcile-cancel.
- **MEDIUM**: re-verify deny-list → ALLOW-list of known-terminal statuses (`canceled/cancelled/incomplete_expired/finished/expired`, verified against qzpay-core `QZPAY_SUBSCRIPTION_STATUS` + `qzpayIsTerminalStatus`). paused/past_due/unknown → cancel-did-not-take (no audit).
- Confirmed: `cancel()` under `providerSyncErrorStrategy:'throw'` (Hospeda's config) does NOT persist local status on provider failure. The original ⚠ caveat is thus resolved in code (risky path now consults provider directly), though a smoke confirmation is still good hygiene.
- Deferred (follow-up): partial unique index on `(subscription_id, metadata->>'supersededSubscriptionId')` for atomic one-audit-per-pairing (TODO comment in code). No money impact (cancel idempotent).
- 958 API tests green.

## Corrections to the spec (fold into implementation)

1. **Webhook (§6.4 / T-007)**: handler is `subscription-logic.ts` `processSubscriptionUpdated`, event `subscription_preapproval.created/.updated` — NOT `routes/billing/` / `subscription_authorized_payment.created`. Insertion point line `701`, gated on `PENDING_PROVIDER → ACTIVE`.
2. **Schemas (§7 / T-008)**: response schemas are local inline in `trial.ts`, not `@repo/schemas`. The one `@repo/schemas` reactivate schema is unused dead code.
3. **Callers (§5 / T-009)**: `/reactivate` has NO web wrapper (only `/reactivate-subscription` has a dead one). The live caller is the E2E test `apps/e2e/tests/host/host-02-trial-upgrade-mp.spec.ts:123`, which asserts the current synchronous shape → must be updated when the contract changes.
4. **planId ambiguity (§6 / T-004)**: confirm slug-vs-UUID before writing the catalog guard.
