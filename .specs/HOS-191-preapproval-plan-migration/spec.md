---
title: Migrate card-first billing to MercadoPago preapproval_plan flow
linear: HOS-191
statusSource: linear
created: 2026-07-16
type: fix
areas:
  - billing
  - api
  - db
---

# Migrate card-first billing to MercadoPago preapproval_plan flow

## 1. Summary

The card-first trial shipped by HOS-171 is broken in production: a first-time
owner who reaches the MercadoPago checkout and pays with a **credit card**
cannot start the trial — the payment fails with "No pudimos procesar tu pago"
and the preapproval lands `cancelled` with `payment_method_id: null`.

Root cause is confirmed: HOS-171 sends `free_trial` **inline in a direct
`POST /preapproval`** (subscription without an associated plan). MercadoPago's
hosted checkout cannot complete card authorization for a direct preapproval that
carries `free_trial`. The **`preapproval_plan` flow** (create an MP plan with the
`free_trial`, then subscribe via `preapproval_plan_id`) authorizes the same card
correctly.

This spec migrates **all** Hospeda subscriptions from the direct `/preapproval`
model to the **`preapproval_plan`** model.

## 2. Problem

### 2.1 Symptom (prod)

Owner-plan checkout (`/suscriptores/planes` → "Empezar" → MP) with a credit card:

- Warning on the review screen: *"No pudimos acceder al detalle de cuotas
  disponibles para tu tarjeta. Podés terminar tu compra en un pago."*
- On confirm: *"Algo salió mal… No pudimos procesar tu pago"* → MP cancels the
  preapproval.
- The preapproval Hospeda created is well-formed (`transaction_amount: 15000`,
  `frequency: 1 months`, `free_trial: {14 days, first_invoice_offset: 14}`,
  `next_payment_date: +14d`) but ends `status: cancelled`, `payment_method_id:
  null`, zero payments/authorized_payments — the card never got attached.

### 2.2 Root cause — confirmed by prod A/B + code trace

**A/B in prod (same Banco Galicia Visa Crédito, raw MP API preapprovals, only
variable = how `free_trial` is sent):**

| Flow | Cuotas warning | On confirm |
| -- | -- | -- |
| `POST /preapproval` + `free_trial` inline (Hospeda today) | shows | ❌ **fails** (2/2: real owner attempt + isolated test `1b1a854f…`) |
| `preapproval_plan` (free_trial in the plan) → subscribe via `init_point` | shows | ✅ **approved** — "¡Listo! Ya te suscribiste", sub `authorized`, `payment_method_id: visa`, **$0** card validation, trial 14d (test `ffa0cfc4…`) |

Findings:

1. The **cuotas warning is cosmetic** — it appears in *both* flows and with
   *any* payment method (also "Dinero disponible"). It is not the blocker.
2. The **actual blocker is the direct `/preapproval` + inline `free_trial`
   flow.** The `preapproval_plan` flow authorizes the card correctly ($0
   validation charge, no real charge, trial deferred 14 days).
3. `payment_methods: {installments: 1, default_installments: 1}` does **not**
   help — MP silently ignores it in `/preapproval` (it is a Checkout Pro
   preference field, not a subscriptions field; the official MP Go SDK confirms
   `/preapproval` has no `payment_methods`/`installments` field).

**Code trace (origin/staging, HOS-171 commit `5cc3c9d1c`):**
`start-paid.ts` → `initiatePaidMonthlySubscription` (`subscription-checkout.service.ts`,
`resolveCheckoutFreeTrialDays` = planTrialDays + promo extra) →
`createPaidSubscription({ freeTrialDays })` (`paid-subscription-create.ts`) →
`billing.subscriptions.create({ mode: 'paid', ...freeTrialDays })` (qzpay) →
`@qazuor/qzpay-mercadopago` adapter `buildCreateBody` builds
`auto_recurring.free_trial` on a direct `POST /preapproval`. There is **no MP
plan today** — every subscription is an individual, ad-hoc preapproval built from
the Hospeda commercial plan (`billing_plans`, DB-wins per HOS-39).

### 2.3 Impact

Launch-blocking for the card-first trial: every first-time owner paying with a
credit card (the majority case in AR) cannot start their trial. There is no
in-UI workaround ("Dinero disponible" also shows the warning; the real card
attempt failed).

## 3. Goals

- **G-1** A trial-eligible owner completes the card-first checkout with a credit
  card in prod, ending in an `authorized` MP subscription with the 14-day trial
  and **no** immediate charge.
- **G-2** The same works for the **annual** cadence (12-month plan + trial).
- **G-3** A trial-ineligible owner (already used their one lifetime trial)
  subscribes via a no-trial plan variant and is charged immediately.
- **G-4** Admin price changes (HOS-39 commercial layer) stay authoritative and
  propagate to the MP plan (and thus to associated subscriptions).
- **G-5** Promo discounts (SPEC-262) keep working — mechanism decided by the
  spike (§11 OQ-1).
- **G-6** No regression to entitlements, limits, dunning, webhooks/polling
  activation, cancel/reactivate, or the commercial (DB-wins) plan layer.

## 4. Non-goals

- **NG-1** Not redesigning the commercial layer. `billing_plans` (DB-wins,
  HOS-39) stays the source of truth for price/limits/entitlements/trialDays.
- **NG-2** Not moving off the MP **hosted/redirect** checkout to an embedded
  card-tokenization (MP.js/Bricks) integration. We stay on the redirect flow —
  just plan-based instead of direct-preapproval-based. (Embedded tokenization is
  a possible future alternative if plans prove insufficient, tracked separately.)
- **NG-3** Not fixing the cosmetic cuotas warning itself (it does not block; see
  OQ-5).
- **NG-4** Not re-architecting HOS-159 (webhooks). This spec depends on webhook/
  polling activation but does not change it.

## 5. Current baseline

- **Commercial layer (unchanged):** `billing_plans` table, `metadata` jsonb holds
  `hasTrial`, `trialDays`, `slug`, `category`; `monthly_price_ars` /
  `annual_price_ars` columns. DB-wins (HOS-39, admin-editable without deploy).
  MP has **no** knowledge of these plans.
- **Checkout (to change):** direct `POST /preapproval` with inline
  `auto_recurring.free_trial`, `status: pending`, user redirected to the returned
  `init_point`. Built in `@qazuor/qzpay-mercadopago` `buildCreateBody`, called via
  `paid-subscription-create.ts` / `subscription-checkout.service.ts` /
  `start-paid.ts`.
- **Eligibility:** one trial per customer for life; guard at the checkout call
  site (`hasPriorSubscription`). Trial days = planTrialDays + promo `extra_days`
  (`resolveCheckoutFreeTrialDays`).
- **Discounts (SPEC-262):** a discount mutates the **individual preapproval's**
  `transaction_amount` (lower then restore), proven viable in the spike doc
  `packages/service-core/src/services/billing/promo-code/docs/mp-preapproval-mutation-spike.md`.
- **Activation:** `subscription-poll` cron + MP webhooks (HOS-159 — webhooks
  still unverified in prod). State machine currently rejects `pending_provider →
  cancelled` (see §10 R-6 / HOS-190 sibling).
- **DB adapter:** `packages/db/src/billing/drizzle-adapter.ts` (qzpay Drizzle
  storage). `billing_subscriptions.mp_subscription_id` stores the MP preapproval
  id today.

## 6. Proposed design

### 6.1 Model: MP preapproval_plan per (commercial-plan × interval × trial-variant)

Introduce **MP `preapproval_plan` objects** and reference them at subscription
time. Because trial-eligibility is per-customer (not per-plan), each commercial
plan+interval needs up to **two** MP plan variants:

- `<plan>-<interval>-trial` — carries `auto_recurring.free_trial` (for
  trial-eligible customers of a `hasTrial` plan).
- `<plan>-<interval>-notrial` — no `free_trial` (for trial-ineligible customers,
  and for plans with `hasTrial: false`).

Approximate MP-plan set (owner tiers × {monthly, annual} × {trial, notrial} +
tourist × {monthly, annual} × notrial + commerce/partner notrial monthly +
owner-test-daily trial):

- owner-basico/pro/premium × {monthly, annual} × {trial, notrial} → 12
- tourist-plus/vip × {monthly, annual} × notrial → 4
- commerce-listing, partner-listing → notrial monthly → 2
- owner-test-daily → trial (1d) monthly → 1

≈ **19 MP plans** — managed programmatically, not by hand.

### 6.2 Plan registry (DB)

Store the MP `preapproval_plan_id` per variant so we resolve it at checkout and
keep it in sync with the commercial layer. Options (decide in impl):

- **6.2.a** New table `billing_mp_plans` (`commercial_plan_id`, `billing_interval`,
  `trial_variant`, `mp_preapproval_plan_id`, `amount_ars`, `trial_days`,
  `status`, timestamps). One row per MP plan variant. **Recommended** — clean,
  queryable, decoupled from the commercial `metadata` blob.
- **6.2.b** Extend `billing_plans.metadata` with a `mpPlanIds` map. Lighter but
  overloads the commercial blob and complicates interval/variant fan-out.

Idempotent **sync/provision** step (deploy hook or admin action): for each
active commercial plan × interval × required variant, ensure an MP plan exists
with the current price + trial days; create if missing, `PUT` if the amount/trial
drifted, record the id. Never create per-customer plans.

### 6.3 Checkout flow (redirect, plan-based)

1. `start-paid` resolves: commercial plan, interval, and trial-eligibility →
   picks the `trial` or `notrial` MP plan variant → looks up its
   `mp_preapproval_plan_id` from the registry.
2. Create the subscription referencing `preapproval_plan_id` (do **not** re-send
   `auto_recurring`/`free_trial`/amount — inherited from the plan). Redirect the
   user to the subscription/plan `init_point`.
3. User authorizes the card on MP's hosted page → MP creates the subscription
   (`authorized`, `payment_method_id` set, $0 validation, first charge deferred to
   trial end for trial variants).
4. Webhook/poll activates the local sub → `TRIALING` (trial variant) or `active`
   (notrial). (HOS-159 dependency.)

### 6.4 qzpay adapter changes (`@qazuor/qzpay-mercadopago`)

The adapter today only builds direct `/preapproval`. It needs:

- Create/read/update MP `preapproval_plan` (`POST/GET/PUT /preapproval_plan`).
- Create a subscription **via `preapproval_plan_id`** (not inline auto_recurring).
- Keep the direct `/preapproval` path available only if a fallback/hybrid is
  ever needed (not used by default once migrated).

This is an **external package** change — coordinate the version bump; Hospeda
pins `@qazuor/qzpay-mercadopago` (currently `^2.2.1`).

### 6.5 Price changes

Admin price edit (HOS-39, DB-wins) must additionally `PUT /preapproval_plan/{id}`
so MP and its associated subs get the new amount. Per MP docs, amount changes on
a plan sync to associated subscriptions. Design the write path so the DB and the
MP plan cannot silently drift (update both in one operation; reconcile on the
provision sync as a backstop). See OQ-6 for PUT-in-place vs new-plan-version.

### 6.6 Discounts (SPEC-262) — spike-gated

Owner decision: **spike first.** Before committing the discount design, run
**SP-1** (§11 OQ-1): empirically test whether a **plan-based** subscription's
individual `transaction_amount` can be mutated via `PUT /preapproval/{id}` (the
same mutation SPEC-262 proved for *direct* preapprovals). Decision tree:

- **If YES** → discounts stay per-sub: subscribe via the plan, then mutate the
  individual sub's amount for the discounted cycles (existing SPEC-262 renewal
  countdown logic mostly carries over). No plan proliferation.
- **If NO** → fall back to one of: (a) pre-created discounted plan variants
  (plan proliferation), or (b) MP's **native coupon** mechanism — the hosted
  checkout already renders "Ingresar un cupón"; investigate whether MP coupons
  can model our promo codes (SP-2, OQ-2).

## 7. Data model / contracts

- **New:** `billing_mp_plans` (see 6.2.a) — or `billing_plans.metadata.mpPlanIds`
  (6.2.b). Decide in impl. Migration via the structural carril
  (`pnpm db:generate` + `db:migrate`) if a table; seed/data-migration for any
  seeded plan-id rows (dual-write rule).
- **Unchanged:** `billing_plans`, `billing_subscriptions` (still stores the MP
  subscription id in `mp_subscription_id`; note it now points at a
  plan-associated subscription, semantics unchanged for our purposes),
  entitlements/limits.
- **MP endpoints used:** `POST /preapproval_plan`, `GET /preapproval_plan/{id}`,
  `PUT /preapproval_plan/{id}`, `POST /preapproval` (with `preapproval_plan_id`),
  `GET /preapproval/{id}`, `PUT /preapproval/{id}` (cancel; and amount-mutate iff
  SP-1 passes).
- **qzpay contract:** new plan-management + subscribe-via-plan methods
  (`@qazuor/qzpay-core` + `@qazuor/qzpay-mercadopago`). Exact surface designed
  with the adapter change.

## 8. UX / UI behavior

- Web checkout unchanged from the user's side (still "Empezar" → redirect to MP).
  MP's hosted screen for the plan flow reads **"Activar prueba gratis"** and
  shows an extra fallback toggle *"usar dinero disponible cuando no sea posible
  cobrar de la tarjeta"* — nicer than the direct flow's bare "Confirmar".
- The cosmetic cuotas warning still appears on MP's side (OQ-5); it does not
  block. Consider a short pre-checkout note or accept as-is.
- Success/back URL, poller, and "Mi Suscripción" states unchanged.

## 9. Acceptance criteria

- **AC-1** Trial-eligible owner completes card-first checkout with a **credit
  card** in prod (real MP): MP sub `authorized`, `payment_method_id` set, $0
  validation, no real charge, local sub `TRIALING`, `next_payment_date` = +14d.
- **AC-2** Annual trial-eligible owner: same, on a 12-month plan variant.
- **AC-3** Trial-ineligible owner subscribes via the `notrial` plan variant →
  card authorized, first charge immediate, local sub `active`.
- **AC-4** Admin changes a plan price → `PUT /preapproval_plan` → new checkouts
  use the new amount; the DB and MP plan do not drift.
- **AC-5** Promo discount applies correctly per the SP-1 outcome (per-sub mutate
  or fallback), verified end-to-end.
- **AC-6** Webhook/poll activates the plan-based sub; `billing_payments` records
  the first real charge at trial end (HOS-159 must be resolved for the webhook
  path).
- **AC-7** Staging smoke against the real MP sandbox passes for the plan flow
  (per the billing smoke-staging gate).
- **AC-8** No regression: cancel/reactivate, dunning, entitlements, limits, and
  the commercial (DB-wins) layer behave as before.

## 10. Risks

- **R-1** qzpay adapter change is in an **external package** — version bump +
  coordination; the plan-management surface must be designed there.
- **R-2** Plan proliferation (~19 MP plans) — needs idempotent provisioning and a
  registry; risk of DB↔MP drift.
- **R-3** Price-change sync (DB ↔ MP plan) — a missed `PUT` silently diverges
  the charged amount from the advertised one.
- **R-4** Discount reconciliation depends on SP-1; if per-sub mutation fails on
  plan-based subs, the fallback (discount plan variants or MP coupons) is a
  larger change.
- **R-5** Trial extension (mutating a live trial) — HOS-171 already flagged this
  as unverified; with plans it is even less obvious. Carried as OQ-3.
- **R-6** State-machine gap: `pending_provider → cancelled` is rejected today, so
  a failed/cancelled MP sub leaves the local sub stuck erroring every poll (seen
  during this investigation). Must be handled alongside — see sibling HOS-189/
  HOS-190 area; include a fix or link.
- **R-7** Existing direct-preapproval subs: card-first trial never succeeded in
  prod (all attempts failed), so there are ~no trial subs to migrate; existing
  non-trial direct subs keep working. Confirm no bulk migration is required
  before assuming it.

## 11. Open questions

- **OQ-1 (SP-1, spike — do first):** Can a **plan-based** subscription's
  individual `transaction_amount` be mutated via `PUT /preapproval/{id}`? Decides
  the discount design (§6.6). Testable empirically in prod (create plan →
  authorize a $0-validation sub → attempt amount mutate → observe → cancel).
- **OQ-2 (SP-2):** Can MP's **native coupon** ("Ingresar un cupón" on the hosted
  checkout) model our SPEC-262 promo codes? Fallback path if SP-1 fails.
- **OQ-3:** How to extend a **live** trial on a plan-based sub (HOS-171 carried
  risk). Possibly out of scope for v1 (admin-only edge).
- **OQ-4:** Plan registry shape — `billing_mp_plans` table (6.2.a, recommended)
  vs `billing_plans.metadata` (6.2.b); and provisioning trigger (deploy hook vs
  admin action vs lazy-on-first-use).
- **OQ-5:** The cosmetic cuotas warning — accept, add a pre-checkout note, or
  open an MP support ticket. Non-blocking.
- **OQ-6:** Price change via `PUT /preapproval_plan/{id}` in place vs creating a
  new plan version and migrating subs (to freeze old customers on old price).
  Interacts with the commercial-layer price-change strategy.
- **OQ-7:** owner-test-daily is `active: false` and priced $1 (not $15) in prod —
  align it as the recurring canary as part of provisioning, or leave off.

## 12. Implementation notes

- **Verification method that worked here:** raw MP API calls (token via
  `hops --target=prod exec api -- printenv HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN`) +
  driving the hosted checkout in a browser as the payer. `preapproval_plan`
  init_point form: `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=<id>`.
  A `$0` payment on the sub = card validation (MP refunds it), not a charge.
- **Do NOT** send `payment_methods`/`installments` to `/preapproval` — ignored.
- Keep the commercial DB layer authoritative; the MP plan is a **projection** of
  it, kept in sync — never the other way around.
- Coordinate with the sibling reset/robustness issues found in the same smoke:
  HOS-188 (`billing-test-reset` deletes `billing_customers`), HOS-189
  (`start-paid` should `ensureCustomerExists`), and the `pending_provider →
  cancelled` state-machine gap (R-6).
- Smoke-staging gate applies (billing core). Add
  `status-needs-smoke-staging` (+ `status-needs-smoke-prod` for go-live) before
  Done.

## 13. Linear

Canonical tracking:
HOS-191

Related: HOS-171 (introduced the regression), HOS-188, HOS-189, SPEC-262
(promo-discount mutation mechanism).
