---
spec-id: SPEC-127
title: Migrate addon.checkout.ts to qzpay path (Phase E)
type: refactor
complexity: medium
status: completed
created: 2026-05-15T00:00:00Z
effort_estimate_hours: 8-12
tags: [hospeda, addons, refactor, qzpay-migration, bugfix]
parent: SPEC-193
parent_legacy: SPEC-122
phase: E
depends_on: [SPEC-125]
priority: medium
target_repo: /home/qazuor/projects/WEBS/hospeda
first_allocated_via_engram_protocol: true
---

# SPEC-127: Migrate addon.checkout.ts to qzpay path (Phase E)

## Coordination (SPEC-193)

As a child of SPEC-193 "Billing Go-Live Readiness — Master":

- **SPEC-192 landed first (order inverted on 2026-06-04)**: the original
  "must run BEFORE SPEC-192 FR-2" constraint is obsolete — SPEC-192 merged
  completely (PR #1428) and deferred its catalog cutover on this file to
  SPEC-127. This spec now **absorbs** that cutover (see
  `.qtm/specs/SPEC-192-billing-catalog-to-db/docs/deferred-checkout-cutover.md`,
  option 2: "do the cutover in the same PR that rewrites the file").
- **Staging smoke is batched** (owner decision 2026-06-04): on merge, register
  the deferred smoke sections in
  `.qtm/specs/SPEC-193-billing-go-live-readiness-master/docs/pending-staging-smoke.md`
  and file the deferral sign-off in `deferred-checkout-cutover.md`.

The historical `parent: SPEC-122` relationship is preserved in `parent_legacy`
for traceability.

## Context

`apps/api/src/services/addon.checkout.ts` is the last file in `apps/api` that:

1. Uses the raw `mercadopago` SDK directly (`createMercadoPagoPreference`,
   lines 51-69; the TODO at line 30 marks it as a temporary workaround).
   SPEC-125 (completed, shipped in qzpay 1.6+; `apps/api` already depends on
   `@qazuor/qzpay-core ^1.11.0`) brought `billing.checkout.create()` to full
   parity: payer fields, `categoryId`, idempotency, statement descriptor,
   expiration — all verified present in `QZPayCreateCheckoutInput`
   (`qzpay/packages/core/src/types/checkout.types.ts:69-112`). **No qzpay
   changes are required by this spec** (no changeset / npm release cycle).
2. Reads the addon catalog from config (`getAddonBySlug` at lines 177 and 469,
   `ALL_PLANS` at lines 233 and 505) instead of the DB-backed services — the
   single intentional exception left by SPEC-192 FR-2.

### Live bug being fixed (dual-resolve)

`ALL_PLANS.find((p) => p.slug === activeSubscription.planId)` appears at
**line 233** (`createAddonCheckout`, plan-category gate) and **line 505**
(`confirmAddonPurchase`, limit-adjustment baseline). Post-SPEC-168,
`planId` may be a `billing_plans` UUID instead of a slug, so the lookup
silently returns `undefined`:

- Line 233: the `targetCategories` gate is silently skipped — addons can be
  purchased for plan categories they should not be available to.
- Line 505: limit adjustments compute from `previousValue = 0` instead of the
  plan's baseline limit, producing wrong `newValue`s in the purchase record.

Fix: dual-resolve via `PlanService` (`getById` → `getBySlug` fallback),
following the established `resolvePlanByIdOrSlug` pattern from
`apps/api/src/services/addon-plan-change.service.ts:66` (SPEC-192 T-027 /
T-025 bug family). Note the existing test at `addon.checkout.test.ts:538`
("should still succeed when the subscription planId is not found in
ALL_PLANS") encodes the buggy silent-skip behavior and must be updated
deliberately alongside the fix.

### Webhook confirmation and external_reference semantics

The MP webhook confirms addon purchases via **metadata**
(`extractAddonMetadata` at
`apps/api/src/routes/webhooks/mercadopago/payment-logic.ts:595`), which passes
through `billing.checkout.create({ metadata })` unchanged — confirmation is
not affected by the migration. However, qzpay-core sets MP's
`external_reference` to the local checkout-session UUID
(`qzpay/packages/core/src/billing.ts:1645`); it is not caller-configurable.
Post-migration the `addon_<slug>_<uuid>` orderId no longer appears as
`external_reference`. Owner decision (2026-06-04): accept this, add
`order_id` to the checkout metadata for traceability, and update the
warn-only `extractAddonFromReference` fallback accordingly.

### Polling fallback (in scope — owner decision 2026-06-04)

The annual one-time-payment flow schedules a polling fallback because MP
Preferences only deliver legacy IPN events that the marker filter drops
(SPEC-143 Finding #21; see `schedulePollingForSubscription` in
`apps/api/src/services/subscription-checkout.service.ts` and
`runOneTimePaymentPoll` in `apps/api/src/cron/jobs/subscription-poll.job.ts:197`).
Addon checkouts are also MP Preferences and have **no polling fallback today**
— a pre-existing confirmation-reliability gap. This spec closes it: after the
qzpay migration the checkout-session id doubles as the searchable
`external_reference`, so the established polling pattern applies directly.
No qzpay changes needed: the polling job's required `subscriptionId` is
naturally satisfied (addon purchase requires an active subscription) and the
job's `metadata` field carries the addon context for dispatch.

## Scope

### In

1. **Refactor `addon.checkout.ts` to qzpay checkout** (FR-1):
   - Replace the inline `createMercadoPagoPreference` helper with
     `billing.checkout.create()` following the proven pattern at
     `apps/api/src/services/subscription-checkout.service.ts:569-596`.
   - Remove `extractPayerInfo` and `MP_ITEM_CATEGORY_ID` — the qzpay MP
     adapter covers both, including the email local-part payer fallback
     (`qzpay/packages/mercadopago/src/adapters/checkout.adapter.ts:78`) and
     the `'services'` categoryId default.
   - Keep generating `orderId` (`addon_<slug>_<uuid>`) for the
     `PurchaseAddonResult` return value and add it as `order_id` to the
     checkout metadata. Keep all existing metadata keys (snake_case +
     camelCase duals) — the webhook depends on them.

2. **Remove the direct `mercadopago` import** (FR-2): `addon.checkout.ts` is
   the only importer in `apps/api/src` (verified 2026-06-04) — also remove
   `mercadopago` from `apps/api/package.json` dependencies (re-verify with
   grep at implementation time, including type-only subpath imports).

3. **Absorb the SPEC-192 deferred catalog cutover** (FR-3):
   - `getAddonBySlug(input.addonSlug)` → `AddonCatalogService.getBySlug()`
     at both entry points (lines ~177 and ~469). Dual-resolve is NOT needed
     here — checkout input is always a slug.
   - Drop the `@repo/billing` catalog imports (`ALL_PLANS`, `getAddonBySlug`)
     from the file entirely (combined with FR-4).
   - Parity regression test mirroring the FR-2 cutover tests (pattern:
     `apps/api/test/routes/billing/admin/hooks/qzpay-admin-hooks.cutover.test.ts`).

4. **Fix the dual-resolve live bug** (FR-4): replace both `ALL_PLANS.find`
   sites (lines 233 and 505) with `PlanService`-based dual-resolve
   (`getById` → `getBySlug` fallback, `resolvePlanByIdOrSlug` pattern).
   Regression tests reproducing the UUID-planId failure FIRST (project
   bug-fix policy), then the fix. Update the line-538 silent-skip test
   deliberately.

5. **Polling fallback for addon purchases** (FR-5):
   - After a successful `billing.checkout.create()`, schedule a polling job
     (resourceType `'one_time_payment'`, `providerResourceId` = checkout
     session id, `subscriptionId` = the customer's active subscription id,
     metadata carrying `type: 'addon_purchase'`, `addonSlug`, `customerId`,
     `userId`, `orderId`).
   - Extend `runOneTimePaymentPoll` to dispatch on the addon context (job
     or payment metadata): addon jobs confirm via the same idempotent
     `confirmAddonPurchase` path the webhook uses (the
     `billingAddonPurchases.paymentId` idempotency check already protects
     webhook/polling races); annual jobs keep their existing branch.

6. **Update tests** (FR-6): migrate `addon.checkout.test.ts` mocks from
   `vi.mock('mercadopago')` to mocking `billing.checkout.create` on the qzpay
   billing fixture. All 32 existing tests map to the new mock targets (the
   line-538 test changes behavior per FR-4). Add tests for FR-3/FR-4/FR-5.

7. **Post-cutover mock sweep + per-package typecheck**: grep ALL tests that
   mock the touched modules (`@repo/billing`, `mercadopago`,
   `addon.checkout`) — enumerated `vi.mock` factories break silently
   (SPEC-192 paid 3 CI rounds for skipping this).

8. **On merge**: register the deferred staging-smoke sections (at minimum
   §1.7 addon purchase — billing CORE) in the SPEC-193 pending-smoke list +
   deferral sign-off in `deferred-checkout-cutover.md`.

### Out

- Changes to the qzpay packages (verified unnecessary — adapter parity
  complete since SPEC-125; polling types already support the addon case).
- Changes to addon business logic in `confirmAddonPurchase` beyond the
  dual-resolve fix (entitlement application, transaction flow untouched).
- Changes to the subscription flow (SPEC-126 territory).
- Running the staging smoke (batched at end of SPEC-193 series).

## Implementation details

### Target shape (verified against qzpay 1.11 API — `QZPayCreateCheckoutInput`)

```typescript
// No direct mercadopago import. Pattern: subscription-checkout.service.ts:569-596.

const result = await billing.checkout.create({
    mode: 'payment',
    lineItems: [
        {
            // unitAmount is in CENTAVOS (smallest unit) — the MP adapter
            // divides by 100 (checkout.adapter.ts:152). Do NOT pre-divide.
            unitAmount: finalPrice,
            currency: 'ARS',
            quantity: 1,
            title: addon.name,          // `title`, not `description`, is the label
            description: addon.description,
            categoryId: 'services'
        }
    ],
    successUrl: `${webUrl}/mi-cuenta/addons?status=success&addon=${addon.slug}`,
    cancelUrl: `${webUrl}/mi-cuenta/addons?status=failure&addon=${addon.slug}`,
    customerId: input.customerId,
    customerEmail: customer.email,
    // customerName / payer fields: the adapter splits customerName and
    // falls back to the email local-part — extractPayerInfo is retired.
    ...(customerName ? { customerName } : {}),
    notificationUrl: `${apiUrl}/api/v1/webhooks/mercadopago`,
    idempotencyKey: checkoutUuid,
    statementDescriptor: env.HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR,
    expiresInMinutes: 30,
    metadata: {
        // existing dual-format keys (webhook depends on them) + order_id
        addon_slug: addon.slug,
        addonSlug: addon.slug,
        customer_id: input.customerId,
        customerId: input.customerId,
        user_id: input.userId,
        userId: input.userId,
        type: 'addon_purchase',
        order_id: orderId,
        promo_code: input.promoCode || null,
        promo_code_id: promoCodeId || null,
        discount_amount: discountAmount,
        original_price: addon.priceArs
    }
});

// Return shape: providerInitPoint / providerSandboxInitPoint (NOT
// `checkoutUrl`); `result.id` is the local session UUID that qzpay-core
// sets as MP external_reference (billing.ts:1645) — callers cannot
// override it. Follow the subscription flow's URL preference:
const checkoutUrl = result.providerInitPoint ?? result.providerSandboxInitPoint;
```

> Behavior note: the legacy code preferred `sandbox_init_point` FIRST
> (`addon.checkout.ts:380`); the qzpay pattern prefers the production
> init point. This is an intentional alignment to the proven subscription
> flow — call it out in the PR description.

### Dual-resolve fix (FR-4)

```typescript
// Pattern: addon-plan-change.service.ts:66 (resolvePlanByIdOrSlug)
const byId = await planService.getById(activeSubscription.planId);
const customerPlan = byId.success
    ? byId.data
    : ((await planService.getBySlug(activeSubscription.planId)).data ?? null);
```

Applied at both the line-233 category gate and the line-505 limit baseline.

### Polling dispatch (FR-5)

`runOneTimePaymentPoll` currently hard-codes `confirmAnnualSubscription`
(`subscription-poll.job.ts:244`). Branch on the matched payment's metadata
(`type === 'addon_purchase'` / `addonSlug` present) or the job's own
metadata, dispatching addon jobs to the webhook-equivalent idempotent addon
confirmation; keep annual dispatch as the existing default.

### Tests migration (FR-6)

`apps/api/test/services/addon.checkout.test.ts` (32 tests):

- Remove `vi.mock('mercadopago', ...)`, `mockPreferenceCreate`, and direct
  SDK assertions.
- Mock `billing.checkout.create` on the qzpay billing fixture; assertions
  move to the create-input shape (payer via customerEmail/customerName,
  `lineItems[0].unitAmount` in centavos, `idempotencyKey`,
  `statementDescriptor`, metadata keys incl. `order_id`).
- Catalog mocks move from `@repo/billing`'s `getAddonBySlug` to
  `AddonCatalogService.getBySlug` (FR-3).
- Plan-gate tests mock `PlanService` dual-resolve instead of `ALL_PLANS`
  (FR-4); the line-538 silent-skip test is rewritten to assert the fixed
  behavior for UUID planIds.

## Acceptance criteria

- [ ] `addon.checkout.ts` no longer imports from `mercadopago` (incl. type subpaths)
- [ ] `addon.checkout.ts` uses `billing.checkout.create()` for preference creation
- [ ] `mercadopago` removed from `apps/api/package.json` (grep-verified no other importer)
- [ ] `addon.checkout.ts` no longer imports `ALL_PLANS` / `getAddonBySlug` from `@repo/billing` (catalog cutover absorbed)
- [ ] Catalog parity regression test passing (qzpay-admin-hooks.cutover.test.ts pattern)
- [ ] Dual-resolve fix at both former ALL_PLANS sites with regression tests (UUID planId reproduces the bug pre-fix)
- [ ] Addon checkout schedules a one_time_payment polling job; polling confirms addon purchases idempotently (webhook race covered by paymentId check)
- [ ] All 32 existing tests in `addon.checkout.test.ts` pass against the new mocks (line-538 test deliberately updated)
- [ ] Quality fields verified flowing through: payer, categoryId, idempotencyKey, statementDescriptor, expiration, metadata duals + order_id
- [ ] Post-cutover mock sweep done (grep all `vi.mock` of touched modules) + per-package typecheck on touched packages
- [ ] `pnpm typecheck` clean, `pnpm lint` clean
- [ ] PR merged to staging with deferred smoke sections registered in SPEC-193 pending-smoke list + sign-off in deferred-checkout-cutover.md

## Engram references

- `spec/spec-122/master-plan-decisions` — Decision 8 (migrate addon.checkout to qzpay)
- `spec/spec-109/state` — Phase 1 work being migrated
- `billing/staging-smoke-batch-deferral` — batched smoke decision (2026-06-04)
- `spec/SPEC-127-migrate-addon-checkout-to-qzpay/worktree` — worktree state

## Revision History

| Date | Trigger | Changes | Result |
|------|---------|---------|--------|
| 2026-06-04 | spec-realign | A: stale "before SPEC-192 FR-2" coordination inverted (SPEC-192 merged; cutover absorbed per deferred-checkout-cutover.md); A: "qzpay dep includes SPEC-125" AC satisfied (qzpay-core ^1.11.0, no qzpay changes needed); B: API example corrected to real QZPayCreateCheckoutInput shape (unitAmount in centavos, title, no externalReference — core sets session.id, providerInitPoint return); B: parity-test path corrected to apps/api/test/routes/billing/admin/hooks/; D: catalog cutover absorbed (FR-3); D: dual-resolve live bug added at BOTH sites 233+505 (FR-4, line-538 test encodes buggy behavior); D: addon polling fallback in-scope per owner (FR-5); D: external_reference semantics accepted + order_id metadata per owner; D: mock-sweep + smoke-registration requirements added | Scope grew from pure refactor to refactor+cutover+bugfix+polling; complexity low→medium, effort 3-5h→8-12h |
