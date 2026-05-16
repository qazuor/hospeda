---
spec-id: SPEC-126
title: Hospeda subscription flow on top of qzpay (Phase D)
type: feat
complexity: high
status: draft
created: 2026-05-15T00:00:00Z
effort_estimate_hours: 20-30
tags: [hospeda, billing, subscriptions, preapproval, trial-conversion, webhooks, plan-change]
parent: SPEC-122
phase: D
depends_on: [SPEC-124, SPEC-125]
priority: high
target_repo: /home/qazuor/projects/WEBS/hospeda
first_allocated_via_engram_protocol: true
---

# SPEC-126: Hospeda subscription flow on top of qzpay (Phase D)

## Context

After SPEC-124 (qzpay subscription preapproval wire-up) and SPEC-125 (qzpay checkout parity) merge and publish to npm, Hospeda can finally build the user-facing flow for paid subscriptions. This spec covers:

- The new `start-paid` route that initiates a paid subscription (monthly preapproval or annual one-time).
- Webhook handlers that link MP preapprovals back to local subs and process recurring payments.
- The trial pre-end notification cron that pushes users to upgrade before their trial expires.
- The plan-change route extended to actually update MP preapprovals.
- The status polling endpoint that the front uses while waiting for MP webhook confirmation.

This is the spec where Hospeda goes from "we have addons + trial" to "we have a complete recurring billing flow".

## Scope

### In

1. **New route**: `POST /api/v1/protected/billing/subscriptions/start-paid`. Initiates a paid subscription.
2. **New route**: `GET /api/v1/protected/billing/subscriptions/:localId/status`. For front polling.
3. **New webhook handlers**:
   - `subscription_preapproval.created`: extract `external_reference` (local sub UUID), call `billing.subscriptions.linkProviderId()`, activate local sub, emit notification.
   - `subscription_authorized_payment.created`: record each successful recurring charge, maintain sub `active` status.
4. **Extended webhook handler**: existing `subscription_preapproval.updated` should now actually find the local sub (because we write `mp_subscription_id` in handler #3 above) and apply status transitions correctly.
5. **New cron job**: `trial-pre-end-notif.job.ts` runs daily, finds trials ending in 3 or 1 days, sends notifs with CTA link to plan picker.
6. **New cron job**: `abandoned-pending-subs.job.ts` runs hourly, marks `pending_provider` subs older than 30 minutes as `abandoned`.
7. **Extended route**: `POST /api/v1/protected/billing/subscriptions/change-plan` now actually updates MP preapproval (via `billing.subscriptions.update()`) and charges proration delta as one-time.
8. **New service**: `subscription-checkout.service.ts` encapsulates the logic for "monthly preapproval vs annual one-time" routing.
9. **Promo code in subscription flow**: free_trial extension support. When a promo code with `type: 'free_trial_days'` is applied, translate to qzpay's `freeTrialDays` input.

### Out

- Migration of `addon.checkout.ts` to use qzpay's checkout adapter (SPEC-127).
- Dead code cleanup (SPEC-128).
- Front-end (Astro/React) pages — separate UI spec (mention in operator pre-reqs).
- Coolify env vars + prod toggle (SPEC-109 Phases 3-7, runs after SPEC-122 closes).
- MP dashboard configuration (operator pre-requisite of master spec).
- **D1 annual (one-time annual payment via MP Checkout Pro)** — deferred to a
  post-SPEC-126 follow-up. Two gaps surfaced during implementation: (a)
  qzpay-core@1.4.0 does not expose a public `billing.checkout` surface (the
  checkout adapter sits behind `getPaymentAdapter().checkout` and requires
  `providerPriceIds[]` which do not apply to dynamically-computed annual
  amounts), and (b) the spec does not cover a webhook handler for the annual
  one-time `payment.created` → sub activation flow (D3 is monthly-only, D4
  is recurring-only). The `/start-paid` endpoint currently rejects
  `billingInterval: 'annual'` with HTTP 501 so the API contract is stable
  and clients can detect the unsupported case explicitly. Master plan
  Decision 2 marked annual as "MVP scope"; this deferral leaves recurring
  monthly as the only paid path until the follow-up lands.

## Implementation details

### Task D1 — `POST /api/v1/protected/billing/subscriptions/start-paid`

**File**: `apps/api/src/routes/billing/start-paid.ts` (new)

Input:
```typescript
{
    planSlug: string;  // e.g. 'owner-premium'
    billingInterval: 'monthly' | 'annual';
    promoCode?: string;
}
```

Output:
```typescript
{
    checkoutUrl: string;  // MP-hosted URL to redirect the user to
    localSubscriptionId: string;  // UUID for status polling
    expiresAt: string;  // when the pending_provider sub expires (30min TTL)
}
```

Behavior:
1. Resolve the customer + active trial (if any).
2. Validate promo code if provided.
3. **If monthly**:
   - Create a local subscription in `pending_provider` status (storage-only).
   - Call `billing.subscriptions.create({ mode: 'paid', customerId, planId, billingInterval: 'monthly', paymentMethodReturnUrl: `${SITE_URL}/billing/return?ref=<localId>`, notificationUrl: `${API_URL}/api/v1/webhooks/mercadopago`, freeTrialDays: derivedFromPromo })`.
   - Get back `{ providerInitPoint, providerSubscriptionId }`.
   - Return `checkoutUrl: providerInitPoint`, `localSubscriptionId`.
4. **If annual**:
   - Compute total annual amount with discount applied (`price * 12 * (1 - discountPct)`).
   - Apply additional promo code discount on top.
   - Create local sub in `pending_provider` status with `endDate = null` (will be set on confirmation).
   - Call `billing.checkout.create({ mode: 'payment', customerEmail, customerName, lineItems: [{ description, quantity: 1, categoryId: 'services' }], unitPrice: annualAmount, successUrl: `${SITE_URL}/billing/return?ref=<localId>`, idempotencyKey: localSubId, statementDescriptor: env.HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR })`.
   - Get back `{ initPoint }`.
   - Return `checkoutUrl: initPoint`, `localSubscriptionId`.

### Task D2 — `GET /api/v1/protected/billing/subscriptions/:localId/status`

**File**: `apps/api/src/routes/billing/subscription-status.ts` (new)

Returns:
```typescript
{
    status: 'pending_provider' | 'active' | 'past_due' | 'canceled' | 'abandoned' | 'paused';
    mpSubscriptionId: string | null;  // null until webhook arrives
    activatedAt: string | null;
}
```

Used by the front to poll every 2s after redirect from MP. When status flips to `active`, front redirects user to dashboard.

### Task D3 — Webhook handler: `subscription_preapproval.created`

**File**: `apps/api/src/routes/webhooks/mercadopago/subscription-handler.ts` (extend)

When event arrives:
1. Extract `external_reference` from event payload → that's the local sub UUID.
2. Fetch the local sub. If status !== 'pending_provider' → idempotency check, return 200 (already processed).
3. Call `billing.subscriptions.linkProviderId({ localSubscriptionId, provider: 'mercadopago', providerSubscriptionId })`.
4. Update local sub status `pending_provider` → `active`. Set `activatedAt = now`.
5. Apply plan entitlements + limits to customer.
6. Clear entitlement cache.
7. Emit `SUBSCRIPTION_ACTIVATED` notification.

If `external_reference` is unknown (no local sub by that UUID) → log warning + return 200 (don't 4xx because MP will retry forever).

### Task D4 — Webhook handler: `subscription_authorized_payment.created`

**File**: `apps/api/src/routes/webhooks/mercadopago/subscription-payment-handler.ts` (new)

Each successful monthly charge by MP fires this. We:
1. Fetch the payment details from MP.
2. Locate the local sub by `mpSubscriptionId` from the payment's preapproval reference.
3. Insert a row in `billing_payments` (already in schema).
4. Keep sub in `active` status (or move from `past_due` back to `active` if retry succeeded).
5. Emit `SUBSCRIPTION_PAYMENT_SUCCEEDED` notification (optional, low priority).

### Task D5 — Trial pre-end notification cron

**File**: `apps/api/src/cron/jobs/trial-pre-end-notif.job.ts` (new)

Runs daily at 10am AR time:
1. Acquire advisory lock (similar to dunning job pattern).
2. Find trials where `trialEnd BETWEEN now+1d AND now+3d` AND status='trialing'.
3. For each trial:
   - Check if notif already sent today (dedup via `billing_subscription_events`).
   - Send `TRIAL_ENDING_SOON` notification (D-3 or D-1 variant based on remaining days).
4. Log + return summary.

### Task D6 — Abandoned pending subs cron

**File**: `apps/api/src/cron/jobs/abandoned-pending-subs.job.ts` (new)

Runs hourly:
1. Find `pending_provider` subs with `createdAt < now - 30min`.
2. Update status → `abandoned`.
3. Log count.

### Task D7 — Plan change route extension

**File**: `apps/api/src/routes/billing/plan-change.ts` (extend)

Current behavior: updates local sub planId only. Doesn't talk to MP.

New behavior:
1. Compute proration delta (existing logic, slightly enhanced).
2. **If upgrade** (new plan more expensive):
   - Create one-time Checkout Pro preference for the delta amount via `billing.checkout.create()`. Mark the local sub as `pending_plan_change` with the delta payment ID.
   - When the delta payment webhook arrives (`payment.created` with `approved`):
     - Call `billing.subscriptions.update({ id, transactionAmount: newPlanPrice, planId: newPlanId })` which propagates to MP preapproval.
     - Mark local sub as `active` again with the new plan.
3. **If downgrade**:
   - Mark `cancelAtPeriodEnd: false` on current period (continue benefits).
   - Schedule plan change to apply at next billing cycle (cron checks daily for `scheduledPlanChange` and applies).
   - When applied: `billing.subscriptions.update({ id, transactionAmount: newPlanPrice, planId: newPlanId })`.

### Task D8 — Subscription checkout service

**File**: `apps/api/src/services/subscription-checkout.service.ts` (new)

Encapsulates the "monthly vs annual" routing and the proration computation. Pure logic, testable in isolation:
```typescript
export async function initiatePaidSubscription({
    customerId, planSlug, billingInterval, promoCode, billing, env
}): Promise<{ checkoutUrl: string; localSubscriptionId: string; expiresAt: Date }> {
    // ... (the logic described in D1)
}

export function computeProration({
    currentPlanPrice, newPlanPrice, currentPeriodStart, currentPeriodEnd, now
}): { deltaAmount: number; isUpgrade: boolean } {
    // ...
}
```

### Task D9 — Promo code: free_trial extension

**File**: `apps/api/src/services/promo-code.service.ts` (extend)

Add a new promo code type: `free_trial_days_extension`. When applied at subscription start, translates to qzpay's `freeTrialDays` input.

Schema config in `@repo/billing/src/config/promo-codes.config.ts`:
```typescript
{
    code: 'FREEMONTH',
    type: 'free_trial_days_extension',
    extraTrialDays: 30,
    // ... usual fields (expiresAt, maxRedemptions, etc.)
}
```

When validated + applied: instead of computing a discount on price, set `freeTrialDays: 30` on the qzpay subscription create input.

## Tests required

For each task: unit tests on the logic + integration tests on the routes (using vitest + supertest patterns).

Key smoke flows (in tests):
1. **Monthly happy path**: trial → start-paid (monthly) → webhook simulation `subscription_preapproval.created` → local sub becomes active → entitlements granted.
2. **Annual happy path**: trial → start-paid (annual) → webhook `payment.created approved` → local sub active with endDate=+365d.
3. **Abandoned flow**: start-paid → user doesn't return → 30min later cron marks abandoned.
4. **Upgrade with proration**: active monthly → change to higher plan → delta payment webhook → preapproval.update → sub on new plan.
5. **Downgrade**: active monthly → change to lower plan → no charge → at next period end, plan changes.
6. **Promo as free_trial**: monthly start-paid with `promoCode: 'FREEMONTH'` → MP preapproval body has `free_trial: { frequency: 30, frequency_type: 'days' }`.
7. **Status polling**: GET /status returns correct values for each phase (pending_provider → active).
8. **Trial-end notif dedup**: 2 runs of the cron on the same day → notif sent once.

## Acceptance criteria

- [ ] All 9 tasks (D1-D9) implemented
- [ ] All tests passing (>90% coverage on new code)
- [ ] `pnpm typecheck` clean, `pnpm lint` clean
- [ ] qzpay dep bumped to the version that has SPEC-123 + SPEC-124 + SPEC-125 merged
- [ ] Manual smoke against MP sandbox (or live sandbox test users) successful for monthly + annual + plan change scenarios
- [ ] Engram observation saved with the smoke results

## Engram references

- `spec/spec-122/master-plan-decisions` — Decisions 1, 2, 3, 4, 5, Sub-2, Sub-3, Sub-4
- `spec/spec-122/audit-summary` — current state of Hospeda billing
- `spec/spec-122/execution-order` — why SPEC-126 depends on SPEC-124 + SPEC-125
