# Staging Smoke Checklist (SPEC-143 Workstream B)

Manual smoke procedures for the billing surface, executed against the
**MercadoPago sandbox** on `https://staging.hospeda.com.ar` /
`https://staging-api.hospeda.com.ar` before merging any billing-touching PR.

This file is the **Workstream B** artifact. The companion vitest e2e
suite under `apps/api/test/e2e/flows/billing/` is **Workstream A** and
runs in CI on every PR; the production smoke (`prod-smoke-checklist.md`)
is **Workstream C** and runs only at go-live.

Authored as part of **T-143-20** (Phase 1 sections) and **T-143-36** (Phase 2
sections). Phase 3 sections land in **T-143-45**.

## How to use this checklist

1. Pick the section relevant to the PR you're about to merge. If the PR
   touches multiple flows, run every affected section.
2. Walk each step in order. Do NOT skip pre-condition steps — the smoke is
   only valid if the starting state matches.
3. Record pass/fail in the **Run log** at the end of each section. Include
   date, executor, PR number, and any observed deviations.
4. If a step fails, STOP and document. Do not "fix-and-continue" — the
   smoke surfaces real-world MP behavior that the test stubs do not.
5. Reset the test user's state between runs that interact with persisted
   state (subscriptions, entitlements). See **Test user assignment**.

## Prerequisites

- Access to `https://staging.hospeda.com.ar` (web) and
  `https://staging-api.hospeda.com.ar` (API).
- MercadoPago sandbox account with credentials configured on
  `hospeda-api-staging` (env vars `HOSPEDA_MERCADO_PAGO_*` set via Coolify).
- A staging Postgres terminal via `hops` (`hops db-counts staging` to verify
  connectivity; `hops psql staging` for ad-hoc inspection).
- At least one test user per role described in **Test user assignment** below.
- Browser dev tools open during checkout flows; capture the network
  request to `/start-paid` and the redirect query params for traceability.

## Test user assignment

Two test-user buckets keep the smoke isolated:

| Bucket | Purpose | Reset cadence |
|--------|---------|---------------|
| **Clean-state** | One-shot flows that need pristine entitlements (annual checkout happy path, trial-start) | Reset before every run via `hops psql staging` → cancel any sub, clear cache |
| **Persisted** | Flows that build on prior state (plan-upgrade, dunning, pause/resume) | Reset only when the flow's pre-conditions don't match |

Each bucket needs at least one MP sandbox test user (different cards behave
differently — see [MP test cards reference](mp-test-cards-reference.md) once
that doc lands in Phase 4). Until the reference doc exists, capture the
specific test-user emails and card numbers used in the **Run log** of each
section so the smoke is reproducible.

Reset recipe (clean-state user):

```bash
# Cancel any active sub
hops psql staging
> UPDATE billing_subscriptions SET status = 'cancelled', canceled_at = now()
  WHERE customer_id = (
      SELECT id FROM billing_customers
      WHERE external_id = '<USER_UUID>'
  ) AND status IN ('active', 'trialing', 'past_due', 'paused');

# Clear entitlement cache (force fresh load)
curl -X POST https://staging-api.hospeda.com.ar/api/v1/admin/billing/cache/clear \
  -H "Cookie: <admin-session>" -d '{"customerId": "<UUID>"}'
```

---

## Phase 1 sections

### 1.1 — Annual checkout (happy path)

Workstream A reference: `annual-checkout.test.ts`

**Pre-conditions**:

- Test user is **clean-state** (no active sub).
- An active plan with annual price exists in staging DB.

**Steps**:

1. Sign in to `staging.hospeda.com.ar` as the test user.
2. Navigate to `/suscriptores/planes/`.
3. Click "Suscribirme" on a plan card with annual billing toggled.
4. Verify the request to `POST /api/v1/protected/billing/subscriptions/start-paid`
   returns 201 with `checkoutUrl`, `localSubscriptionId`, `expiresAt`.
5. Follow the MP checkout URL, pay with the **APRO** sandbox test card.
6. Wait for the redirect back. Confirm landing URL (may be `/billing/return`
   pending the orphan-back-url fix — see engram
   `bug/back-url-orphan-billing-return`).
7. Wait for MP webhook to land (~5-30s). Confirm in `hops psql staging`:
   ```sql
   SELECT status, current_period_start, current_period_end
   FROM billing_subscriptions WHERE id = '<localSubscriptionId>';
   ```
   Expected: `status='active'`, periods stamped, `current_period_end ≈ now() + 1 year`.
8. Reload `/mi-cuenta/`. Confirm entitlements reflect the new plan.

**Expected outcome**: User has active annual sub, entitlements granted,
no entries in dead-letter queue.

**Run log**:

| Date | Executor | PR | Test user | Card | Result | Notes |
|------|----------|----|-----------|------|--------|-------|
|      |          |    |           |      |        |       |

### 1.2 — Monthly checkout (happy path)

Workstream A reference: `monthly-checkout.test.ts`

**Pre-conditions**: clean-state test user.

**Steps**:

1. Sign in, navigate to `/suscriptores/planes/`, toggle monthly billing.
2. Click "Suscribirme". Verify 201 from `start-paid`.
3. Follow MP preapproval URL. Authorize the recurring charge with APRO card.
4. On return, confirm webhook `subscription_preapproval.updated` arrives
   (~5-30s). Verify local sub flipped from `incomplete` to `active`.
5. Verify `mp_subscription_id` populated in `billing_subscriptions`.
6. Reload account page, confirm entitlements active.

**Run log**: (template per 1.1)

### 1.3 — Free plan signup

Workstream A reference: `free-plan-signup.test.ts`

**Pre-conditions**: clean-state test user.

**Steps**:

1. Sign up a new account, complete email verification.
2. Confirm a `billing_customers` row was created with `external_id = users.id`.
3. Confirm entitlements load returns the free-plan defaults (no sub row).

**Run log**: (template)

### 1.4 — Plan upgrade (immediate)

Workstream A reference: `plan-upgrade.test.ts`

**Pre-conditions**: persisted test user with an **active monthly** sub on
the cheap plan.

**Steps**:

1. From `/mi-cuenta/`, click "Cambiar plan", select a more expensive plan.
2. Verify `POST /change-plan` returns 200 with `delta` charge details.
3. Authorize the delta payment in MP if prompted.
4. Confirm local sub `planId` flipped, audit event written
   (`triggerSource='plan-upgrade'`), entitlements reflect the new plan
   (cache invalidated).

**Run log**: (template)

### 1.5 — Plan downgrade (scheduled)

Workstream A reference: `plan-downgrade.test.ts`

**Pre-conditions**: persisted test user on expensive plan.

**Steps**:

1. Click "Cambiar plan", select a cheaper one.
2. Verify response says "applies at end of current period" (no immediate
   charge).
3. Confirm `scheduledPlanChange` populated on the sub row with
   `applyAt = currentPeriodEnd`.
4. Confirm entitlements remain on the expensive plan until the cron runs.

**Run log**: (template)

### 1.6 — Downgrade cron applies due schedules

Workstream A reference: `plan-downgrade-cron.test.ts`

**Pre-conditions**: persisted test user with a scheduled downgrade whose
`applyAt < now()`.

**Steps**:

1. Manually trigger cron from admin panel (`/admin/cron` → Run for
   `apply-scheduled-plan-changes`), or wait for the natural schedule.
2. Confirm the cron's response: `applied >= 1`.
3. Confirm the sub's `planId` flipped and `scheduledPlanChange.status='applied'`.
4. Confirm entitlements now reflect the cheaper plan.

**Run log**: (template)

### 1.7 — Addon purchase

Workstream A reference: `addon-purchase.test.ts`

**Pre-conditions**: persisted test user with an active sub on a plan that
supports the addon being purchased.

**Steps**:

1. Click "Comprar addon" on `/mi-cuenta/`. Select an active addon.
2. Verify `POST /admin/billing/customer-addons` (or the protected route
   depending on the entry point used) returns 201 with a checkout URL or
   immediate-purchase outcome (depending on addon type).
3. If a checkout is involved, complete the payment.
4. Confirm `billing_addon_purchases` row created, entitlement override
   applied (limit/feature adjustment reflected in entitlement load).

**Run log**: (template)

### 1.8 — Webhook idempotency

Workstream A reference: `webhook-idempotency.test.ts`

**Pre-conditions**: a recent webhook event id from MP logs.

**Steps**:

1. Re-fire the same webhook payload (e.g., via curl with the original
   signature). Verify the API responds 200 but does NOT duplicate side
   effects (no extra `billing_subscription_events` row, no double
   entitlement grant).
2. Confirm `billing_webhook_events.processed_at` is set for the id.

**Run log**: (template)

### 1.9 — Webhook signature validation

Workstream A reference: `webhook-signature.test.ts`

**Steps**:

1. Send a webhook payload with a deliberately invalid `x-signature` header.
2. Confirm 401 response.
3. Confirm Sentry captured a signature-validation alert.

**Run log**: (template)

### 1.10 — Failed payment webhook (past_due transition)

Workstream A reference: `webhook-failed-payment.test.ts`

**Pre-conditions**: persisted test user with active sub.

**Steps**:

1. In MP sandbox, simulate a recurring payment failure (REJECTED card on
   the next renewal cycle).
2. Confirm the `subscription_preapproval.updated` webhook flips local
   status to `past_due`.
3. Confirm `paymentFailureCount` increments in metadata.
4. Confirm dunning cron picks up the past_due sub on its next run.

**Run log**: (template)

### 1.11 — Webhook concurrency

Workstream A reference: `webhook-concurrency.test.ts`

**Steps**:

1. Re-fire two distinct webhook events that target the same local sub in
   rapid succession (within a single second).
2. Confirm both events are processed, the final sub state reflects the
   later event's outcome, no race conditions corrupt the row.

**Run log**: (template)

### 1.12 — API idempotency

Workstream A reference: `api-idempotency.test.ts`

**Steps**:

1. Re-send a `POST /start-paid` request with the same `Idempotency-Key`
   header value (if/when implemented — currently the endpoint has no
   idempotency, tracked under T-143-44's D6 pin).
2. Confirm either the same response is returned or the request is
   rejected with a clear error. Document the actual behavior.

**Run log**: (template)

### 1.13 — Subscription activation (annual)

Workstream A reference: `subscription-activation.test.ts`

**Steps**: covered as the tail of 1.1 (annual checkout). Run separately
when only validating the activation half (e.g., after re-mocking a
checkout webhook).

**Run log**: (template)

### 1.14 — Entitlement load post-activation

Workstream A reference: `entitlement-load.test.ts`

**Steps**:

1. After any flow that activates a sub (1.1, 1.2), reload `/mi-cuenta/`.
2. Verify the entitlements list matches the plan's published entitlements.
3. Verify any addon entitlements layer on top (additive merges).
4. Verify the cache hit on second reload (no DB query in API logs).

**Run log**: (template)

---

## Phase 2 sections

### 2.1 — Trial lifecycle (start, expiry, conversion)

Workstream A reference: `trial-lifecycle.test.ts`

**Pre-conditions**: clean-state test user; a plan with trial enabled in
the catalog.

**Sub-flows**:

#### 2.1.a Trial start

1. Sign up and click a plan with trial.
2. Confirm sub created with `status='trialing'`, `trial_start` and
   `trial_end` stamped, no payment processed yet.
3. Confirm entitlements reflect the trialed plan (full access during trial).

#### 2.1.b Trial expiry (cron-driven)

1. Either wait for natural cron tick or manually advance `trial_end` to
   the past via `hops psql staging` and trigger
   `apply-scheduled-plan-changes` (or the trial-expiry cron if separate).
2. Confirm sub flipped to `incomplete` / `active` / `cancelled` per the
   trial conversion policy.
3. Confirm `trial_converted` and `trial_converted_at` flags written.

#### 2.1.c Trial → paid conversion (user accepts charge before expiry)

1. From `/mi-cuenta/`, click "Activar plan ahora".
2. Confirm the upgrade-to-paid path runs, sub flips `trialing` → `active`.

**Run log**: (template — one row per sub-flow)

### 2.2 — Subscription cancel

Workstream A reference: `subscription-cancel.test.ts`

**Pre-conditions**: persisted test user with active sub.

**Steps**:

1. From the **admin panel**, navigate to the customer's billing detail
   page (user-facing self-cancel is tracked under SPEC-147 and not yet
   shipped — see T-143-27 notes).
2. Click "Cancel subscription".
3. Confirm `POST /api/v1/admin/billing/subscriptions/{id}/cancel` returns
   200 with the documented envelope.
4. Confirm sub flipped to `canceled` (qzpay-side US spelling on the live
   column; the audit row records `cancelled` UK spelling — see engram
   `bug/cancel-spelling-drift`).
5. Confirm entitlements drop to free-plan defaults on the next reload.

**Run log**: (template)

### 2.3 — Subscription pause / resume

Workstream A reference: `subscription-pause-resume.test.ts`

**Pre-conditions**: persisted test user with active sub.

**Steps**:

1. Admin pauses the sub. Confirm status flips to `paused`.
2. Verify entitlements still surface during pause (per current policy —
   see T-143-28 notes for the MP-side pause gap).
3. Admin resumes the sub. Confirm status flips back to `active`.

**Run log**: (template)

### 2.4 — Dunning cron retries

Workstream A reference: `dunning-cron.test.ts`

**Pre-conditions**: persisted test user with sub in `past_due` state
(simulate via 1.10 first if needed).

**Steps**:

1. Trigger dunning cron from `/admin/cron` (`dunning` job).
2. Confirm a retry attempt was recorded in `billing_dunning_attempts`.
3. Confirm the cron's response: retried count >= 1.
4. Run the cron multiple times to walk the [1, 3, 5, 7] retry schedule.
   Confirm each retry attempt is recorded; final retry exhaustion flips
   sub to `cancelled` if MP keeps rejecting.

**Run log**: (template — one row per retry attempt)

### 2.5 — Addon expiry / cancel

Workstream A reference: `addon-expiration-cron.test.ts` +
`addon-cancel-recalc.test.ts`

**Pre-conditions**: persisted test user with active addon.

#### 2.5.a Expiry via cron

1. Set the addon's `expires_at` to the past via `hops psql staging`.
2. Trigger the `addon-expiry` cron.
3. Confirm the addon row marked expired; entitlement override removed on
   next reload.

#### 2.5.b Cancel by admin

1. Admin navigates to the customer's addon list and clicks "Cancel".
2. Confirm `DELETE /api/v1/admin/billing/customer-addons/{id}` returns 200.
3. Confirm the addon row removed (or marked cancelled, depending on impl)
   and entitlements drop the override.

**Run log**: (template)

### 2.6 — Authorized payment webhook

Workstream A reference: `authorized-payment.test.ts`

**Pre-conditions**: monthly sub in `active` state.

**Steps**:

1. Wait for the next monthly billing cycle (or manually fire the
   `subscription_authorized_payment.created` webhook with a stub).
2. Confirm a `payments` (qzpay-side) row created with `mpPaymentId`
   populated (NOTE: providerPaymentIds loss bug — see engram
   `bug/qzpay-drizzle-payments-create-loses-provider-ids`).
3. Confirm sub `currentPeriodStart` / `currentPeriodEnd` rolled forward
   by one cycle.

**Run log**: (template)

### 2.7 — Refund flow

Workstream A reference: `refund.test.ts`

**Pre-conditions**: a successful payment row exists for the test user.

**Steps**:

1. Admin navigates to the payment detail and clicks "Refund".
2. Choose full refund or partial amount.
3. Confirm `POST /api/v1/admin/billing/refunds` returns 200.
4. **KNOWN GAPS** (engram `bug/refund-flow-gaps`): the current refund
   handler does NOT call the MP refund API, does NOT end-date entitlements,
   does NOT change sub state, and does NOT update the payment row's
   `refunded_amount` column. Smoke records the gap as "documented", not
   "blocking".

**Run log**: (template — record which gaps are still present per run)

### 2.8 — Dispute / chargeback flow

Workstream A reference: `chargeback.test.ts`

**Pre-conditions**: a payment that MP can dispute (sandbox-specific).

**Steps**:

1. Trigger a dispute via MP sandbox (CONT card pattern or admin force).
2. Confirm `chargebacks` and `payment.dispute` webhooks land.
3. Confirm the dispute handler logs the event but does NOT auto-resolve
   (per ADR-008 manual-in-v1 decision — see engram
   `spec/spec-143/checkpoint-post-t143-42` for the T-143-35 pin).
4. Verify the manual-action queue is populated for the admin to handle.

**Run log**: (template)

### 2.9 — MP error handling

Workstream A reference: `mp-error-handling.test.ts`

**Steps**:

1. Use rejection-pattern cards (CONT, OTHE, FUND) to exercise each
   4xx/5xx response branch.
2. Confirm hospeda surfaces a user-friendly error message on the
   failure.astro page (the `resolveReasonI18nKey` mapping).
3. Confirm no half-state landed in DB (sub stays `incomplete` until a
   real authorization arrives).

**Run log**: (template — one row per rejection pattern tested)

### 2.10 — Grace period and plan lifecycle

Workstream A reference: `grace-and-plan-lifecycle.test.ts`

**Steps**:

1. Walk a sub through the full state machine:
   `incomplete` → `trialing` → `active` → `past_due` → `cancelled`.
2. At each transition, verify entitlements update with the appropriate
   delay (grace period for past_due).
3. Verify audit log writes for each transition.

**Run log**: (template)

---

## Phase 3 sections

### 3.1 — Promo code apply / validate / expire

Workstream A reference: `promo-code.test.ts`

**Pre-conditions**: a promo code seeded in qzpay's catalog (the
`/promo-codes` namespace is owned by qzpay-hono, not hospeda — engram
`bug/promo-validate-route-shadow` documents the route shadowing).

#### 3.1.a Validate (read-only)

1. As an authenticated user, POST to
   `/api/v1/protected/billing/promo-codes/validate`
   with a known-good code. Confirm 200 with the discount/extension shape.
2. Repeat with a bogus code. Confirm 404 / `INVALID_PROMO_CODE`.
3. Repeat with an inactive code. Confirm 422.

#### 3.1.b Apply

1. From the checkout flow, enter the promo code at the appropriate UI
   point and submit checkout.
2. Confirm the promo is recorded on the resulting sub
   (`promoCodeId` populated on `billing_subscriptions`).
3. Confirm the discount or free-trial extension is reflected on the
   provider side (MP charges less, or trial period extends).
4. **KNOWN GAPS** (engram `bug/promo-validate-route-shadow`): apply
   skips plan-restriction validation and consumes `usedCount`
   immediately (no two-phase). Smoke records the gap as documented,
   not blocking.

#### 3.1.c Expire (cron-driven)

1. Set `expiresAt` to the past via `hops psql staging`.
2. Trigger the promo-code expiry cron (if separate; otherwise rely on
   the validation path returning 422 for the now-expired code).
3. Confirm subsequent validate returns 422 / expired.

**Run log**: (template)

### 3.2 — Sponsorship grant / revoke

**OBSOLETE** — T-143-39 closed without tests because the gift-subscription
flow described in the task notes does not exist in the codebase. The
`sponsorships` table is CRUD for sponsored ads/posts, not entitlement
grants. CRUD coverage lives in unit tests
(`packages/db/test/models/sponsorship.model.test.ts` +
`packages/service-core/test/factories/sponsorshipFactory.ts`). No staging
smoke section to run.

If a real grant/revoke flow ever lands, write it under a fresh
sub-section here and link the engram entry that documented the
original misalignment: `bug/sponsorship-task-notes-misalignment`.

### 3.3 — Customer override apply / expire

**OBSOLETE** — T-143-40 closed without tests because the
customer-override system described in the task notes does not exist in
hospeda OR qzpay upstream. The feature was scoped in spec.md (Goal +
Phase 3 file listing) but never built. Zero references to
`customerOverride` / `entitlementOverride` / `limitOverride` across the
billing surface and qzpay packages. No staging smoke section to run.

If/when customer override becomes a real feature, derive the smoke
section from the actual implementation under a fresh spec, not from
the stale task notes. Engram: `bug/customer-override-task-misalignment`.

### 3.4 — Entitlement cache hit / miss / invalidation / TTL

Workstream A reference: `entitlement-cache.test.ts`

**Pre-conditions**: persisted test user with active sub.

#### 3.4.a Miss → hit

1. Clear the entitlement cache for the user via
   `POST /api/v1/admin/billing/cache/clear` (admin).
2. Trigger an entitlement load (reload `/mi-cuenta/`). Confirm in API
   logs: `cache: miss, source: db`.
3. Reload again immediately. Confirm logs: `cache: hit`.

#### 3.4.b TTL expiry

1. After a hit, wait the configured TTL window (default per
   `HOSPEDA_ENTITLEMENT_CACHE_TTL_MS`).
2. Reload. Confirm `cache: miss` again — TTL expired and the cache
   re-primed from DB.

#### 3.4.c Invalidation on sub change

1. Admin cancels the sub (see 2.2). Confirm the cache entry is
   invalidated immediately.
2. Next reload returns the free-plan defaults from a fresh DB read.

#### 3.4.d Known gaps

- **No single-flight protection** on cache stampede: concurrent
  miss-readers all hit DB. Engram pin from T-143-41.
- **In-memory only**: no Redis backend wired today. Cache state is
  per-process; a multi-instance deployment will see drift until the
  Redis adapter lands.

**Run log**: (template)

### 3.5 — Admin billing ops

Workstream A reference: `admin-billing-ops.test.ts`

#### 3.5.a List endpoints

1. Admin opens `/admin/billing/customers`. Confirm 200 with pagination.
2. Admin opens `/admin/billing/subscriptions`. Confirm 200.
3. Admin opens `/admin/billing/addons`. Confirm 200 with canonical
   catalog (NOT DB rows — engram pin from T-143-42).

#### 3.5.b Customer detail

1. Click any customer row. Confirm detail view loads with sub history,
   addon list, recent events.

#### 3.5.c Sub manual ops

1. From a customer detail, click "Pause" → confirm sub paused.
2. Click "Resume" → confirm sub active.
3. Click "Cancel" → confirm sub canceled.

#### 3.5.d Addon manual ops

1. From a customer detail, click "Add addon" → select addon → confirm
   added.
2. Click "Expire addon" or "Activate addon".
3. **KNOWN GAPS** (engram `bug/admin-billing-endpoints-broken`):
   - customer-addons expire/activate response schema mismatch → 500
     (DB flippea but envelope wrong).
   - settings PATCH empty=400 / non-empty=500 (audit log insert crash).
   - sub-events handler omite eventType.
   Document the actual behavior observed in the run log.

#### 3.5.e Permission gating

1. As a non-admin user, attempt to call any `/api/v1/admin/billing/*`
   endpoint. Confirm 403.

**Run log**: (template)

### 3.6 — Exchange rate cron

Workstream A reference: `exchange-rate-cron.test.ts` (T-143-43)

**Pre-conditions**: `HOSPEDA_EXCHANGE_RATE_API_KEY` configured on
`hospeda-api-staging` (set via `hops env-set staging` if missing).

**Steps**:

1. Trigger the `exchange-rate-fetch` cron from `/admin/cron`.
2. Confirm cron output: `success: true`, `processed >= 2`,
   `fromDolarApi > 0` or `fromExchangeRateApi > 0` (depending on what
   each external API returns at smoke time).
3. Verify rows landed in `exchange_rates` via
   `hops psql staging`:

   ```sql
   SELECT from_currency, to_currency, rate, source, fetched_at
   FROM exchange_rates
   ORDER BY fetched_at DESC
   LIMIT 10;
   ```

4. Re-trigger the cron. Confirm new rows appended (NOT updates — each
   run inserts a new fetched_at slice).

#### 3.6.a Manual override priority

1. Insert a manual override row directly:

   ```sql
   INSERT INTO exchange_rates (
       from_currency, to_currency, rate, inverse_rate,
       rate_type, source, is_manual_override, fetched_at
   ) VALUES (
       'USD', 'ARS', 1234.5, 1/1234.5,
       'official', 'manual', true, now()
   );
   ```

2. Trigger cron. Confirm the fetcher logs
   `fromManualOverride: 1` and does NOT overwrite the manual row.

**Run log**: (template)

### 3.7 — Plan migration matrix

Workstream A reference: `plan-migration-matrix.test.ts` (Phase 3 task,
status: see state.json)

**Pre-conditions**: persisted test user on each starting plan, walk
all migration paths defined in the matrix.

**Steps**:

1. For each `(from_plan, to_plan)` pair in the migration matrix, attempt
   a change-plan call.
2. Confirm the matrix outcome (allowed / blocked / requires-confirmation)
   matches the spec.
3. For allowed migrations, confirm entitlements adjust correctly
   (subset/superset rules per plan).

**Run log**: (template — one row per (from, to) pair tested)

### 3.8 — Multi-currency

Workstream A reference: `multi-currency.test.ts` (Phase 3 task)

**Pre-conditions**: exchange rate cron has run (3.6) so fresh rates
exist; at least one plan with a USD or BRL price.

**Steps**:

1. As a user, select a plan priced in USD. Confirm checkout calculates
   the ARS-equivalent using the latest `exchange_rates` row.
2. Confirm MP receives the ARS amount (or the multi-currency settlement,
   depending on the plan config).
3. Confirm `billing_subscriptions.currency` and `unit_amount` reflect
   the chosen currency.

**Run log**: (template)

### 3.9 — Secondary auth / redirect / cancel flows (D1..D8)

Workstream A references (T-143-44):

- `apps/api/test/e2e/flows/billing/auth-redirect-cancel-flows.test.ts` (D4/D6/D7/D8)
- `apps/web/test/pages/checkout-pages.test.ts` (D1/D2/D3, source-reading)

D5 (browser-back) **has no CI coverage** and exists primarily for
this manual smoke section.

#### 3.9.a D1 — success-redirect

1. Complete annual checkout (see 1.1). At the MP return moment, observe
   the URL the browser lands on.
2. Confirm the page renders correctly with the approved-payment variant.
3. **PIN** — the back_url emitted by the API is `/billing/return`, which
   does NOT exist (engram `bug/back-url-orphan-billing-return`). The
   actual pages live at `/{lang}/suscriptores/checkout/{success,failure,pending}`.
   Document which URL the browser actually receives; this is the most
   direct way to verify whether the back_url bug is fixed.

#### 3.9.b D2 — failure-redirect

1. Use the OTHE / FUND rejection card. Complete a rejected payment.
2. Confirm landing on the failure page with the friendly error message.
3. Verify no sensitive identifier (payment_id, preference_id) is
   rendered in HTML.

#### 3.9.c D3 — pending-redirect

1. Use the CONT card to produce a pending payment.
2. Confirm landing on the pending page with the 24h confirmation
   message and "Verificar estado" CTA.
3. **PIN** — qzpay-mercadopago checkout adapter sets
   `back_urls.pending = back_urls.success` (engram
   `bug/back-url-orphan-billing-return`). Document whether the
   browser actually lands on success or pending.

#### 3.9.d D4 — cancel-from-MP

1. After authorizing a monthly preapproval, cancel it from the MP
   sandbox dashboard.
2. Wait for the webhook (~5-30s). Confirm local sub flipped to
   `cancelled` (UK 2L on the audit row, `canceled` US 1L on the qzpay
   live status — engram `cancel-spelling-drift`).

#### 3.9.e D5 — browser-back during checkout

**THIS SUB-FLOW HAS NO CI COVERAGE.** This manual smoke is its ONLY
automated regression check. Run it on every PR that touches checkout
flow or MP redirect handling.

1. Start a fresh annual checkout. Reach the MP-hosted page.
2. Click the browser BACK button (do NOT close the tab).
3. From the now-visible plan/checkout page, click "Suscribirme" again.
4. Confirm either: (a) the same checkout URL is reused without creating
   a duplicate sub, OR (b) a fresh checkout url is issued and the
   abandoned-pending-subs cron will reap the orphan later.
5. Document the actual behavior. If duplicate pending subs accumulate,
   add a follow-up pin in engram.

#### 3.9.f D6 — double-submit

1. From the plan page, click "Suscribirme" TWICE in rapid succession.
2. Confirm whether the API creates one sub or two (T-143-44 test
   pinned the gap: today it creates two pending subs).
3. Document the count observed.

#### 3.9.g D7 — session-expired during checkout

1. Start checkout. Before completing payment, force-expire the session
   (clear cookies in dev tools, or wait out the BetterAuth TTL).
2. Try to return to the checkout flow. Confirm the protected endpoint
   returns 401 (or the web redirects to login).

#### 3.9.h D8 — anonymous checkout attempt

1. Log out completely.
2. Navigate to `/suscriptores/planes/` and click "Suscribirme".
3. Confirm the web router redirects to login, preserving the intent
   (the plan slug + billing interval should survive the round trip
   so the user resumes the same flow after auth).

**Run log**: (template per sub-flow — D5 especially should land here
because it has no other regression check)

---

## Sign-off block

After completing the sections relevant to the PR, file a sign-off entry:

```text
Sign-off — PR #<N>, executed sections <list>
- Date: YYYY-MM-DD
- Executor: <name>
- Branch tested: <branch>
- Staging commit: <sha>
- Result: PASS / PASS with notes / FAIL
- Notes: <observations, deviations, anything to follow up>
```

Failed smokes block merge. Notes-only passes can merge but the note must
be filed as a follow-up task in `state.json` or as a new engram bug entry.

---

## Cross-references

- Spec: `.claude/specs/SPEC-143-billing-testing-coverage/spec.md`
- Task state: `.claude/tasks/SPEC-143-billing-testing-coverage/state.json`
- Workstream A coverage: `apps/api/test/e2e/flows/billing/`
- Web-side page coverage: `apps/web/test/pages/checkout-pages.test.ts`
- Production smoke: `prod-smoke-checklist.md` (T-143-22, Phase 1 Workstream C)
- MP test cards reference: `mp-test-cards-reference.md` (T-143-54, Phase 4 polish)
- Billing runbooks: `billing-runbooks.md` (T-143-49, Phase 4 polish)
