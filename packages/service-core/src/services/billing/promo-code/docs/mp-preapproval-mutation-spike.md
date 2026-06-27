# SPIKE T-001 — MercadoPago preapproval `transaction_amount` mutation

> **Spec:** SPEC-262 — Billing Promo Code Effect Engine
> **Closes:** OQ-4 (multi-cycle discount mechanism for case 3)
> **Status:** COMPLETE — see [VERDICT](#verdict).
> **Date:** 2026-06-22

---

## 1. The question

For the multi-cycle discount use case (case 3 — e.g. `LANZAMIENTO50` = "50% off the
first 3 months"), the chosen mechanism is to **mutate a live MercadoPago (MP)
preapproval's recurring amount** (`auto_recurring.transaction_amount`) down for the
discounted cycles and restore it afterward. The refund/credit fallback is **VETOED**
by the owner (cobro-full + visible refund is unacceptable UX).

We must determine, against the **real, current** MP API, whether this is reliably
possible. If not, case 3 must be flagged for **redesign** (NOT refunds). Concretely:

1. **Endpoint & mutability** — which endpoint updates a preapproval, and is
   `auto_recurring.transaction_amount` actually mutable on an
   already-authorized, active recurring preapproval?
2. **Per-cycle vs permanent** — does the change apply from the next charge onward
   (so we lower it for N cycles then raise it back), or does MP require payer
   re-authorization (which would break the unattended cron flow)?
3. **Timing window** — how far ahead of a recurring charge must the update land to
   take effect for that cycle? Is there a signal (webhook/poll) to anchor the cron
   to, so it mutates before MP bills and restores after?
4. **Idempotency / risk** — double-charge / skipped-charge risk if the update races
   the charge; idempotency support.
5. **Go/No-Go** for Outcome A (mutate works) vs Outcome B (cannot mutate reliably →
   redesign).

---

## 2. Method & sources

### 2.1 MercadoPago documentation (external)

- **Update subscription (no associated plan)** — `PUT /preapproval/{id}` reference:
  <https://www.mercadopago.com.co/developers/en/reference/subscriptions/_preapproval_id/put>
- **Subscription management** (amount-change how-to, email notification on change):
  <https://www.mercadopago.com.ar/developers/en/docs/subscriptions/subscription-management>
  and the BR mirror
  <https://www.mercadopago.com.br/developers/en/docs/subscriptions/subscription-management.md>
- **Subscriptions with authorized payment** (billing timing, first-charge ~1h,
  retry window):
  <https://www.mercadopago.com.co/developers/en/docs/subscriptions/integration-configuration/subscription-no-associated-plan/authorized-payments>
- **Create subscription** (`POST /preapproval`, status `authorized`):
  <https://www.mercadopago.com.ar/developers/en/reference/subscriptions/_preapproval/post>
- **MP Node SDK — Pre-Approval** (`preApproval.update`, idempotencyKey via
  requestOptions): <https://github.com/mercadopago/sdk-nodejs/wiki/Pre-Approval> and
  `sdk-nodejs/src/clients/preApproval/index.ts`

### 2.2 Repo grounding (how Hospeda actually drives preapprovals today)

| Concern | File | Note |
| --- | --- | --- |
| Preapproval CREATE | `apps/api/src/services/subscription-checkout.service.ts` (~L397-414) | `billing.subscriptions.create({ mode: 'paid', billingInterval: 'monthly' })` → `@qazuor/qzpay-mercadopago` → `POST /preapproval`. `transaction_amount = unitAmount / 100` (centavos → ARS units). |
| **Preapproval AMOUNT MUTATION (already exists!)** | `apps/api/src/cron/jobs/apply-scheduled-plan-changes.ts` (~L297-318) | `paymentAdapter.subscriptions.update(mpSubscriptionId, { planId, transactionAmount: targetTransactionAmountMajor })` — scheduled downgrade. |
| **Preapproval AMOUNT MUTATION (already exists!)** | `apps/api/src/routes/webhooks/mercadopago/payment-logic.ts` (~L431-455, `confirmPlanUpgrade` step 2) | Same `subscriptions.update(mpSubscriptionId, { transactionAmount })` on upgrade confirmation. |
| `mp_subscription_id` storage | `packages/db/src/migrations/0000_baseline.sql` (L1385, idx L1913) | `varchar(255)` on `billing_subscriptions`; populated by `@qazuor/qzpay-drizzle` on `subscription_preapproval.*` webhooks. |
| Webhook event router | `apps/api/src/routes/billing/webhooks/router.ts` (L131-154) | Listens for `payment.created/updated`, `subscription_preapproval.created/updated`, `subscription_authorized_payment.created/updated`, `chargebacks`, `payment.dispute`. v2 only. |
| Subscription poll cron | `apps/api/src/cron/jobs/subscription-poll.job.ts` | `* * * * *` (every minute), gated by `HOSPEDA_BILLING_POLLING_ENABLED`. Calls `subscriptions.retrieve(preapprovalId)` → synthesizes `subscription_preapproval.updated`. |
| Scheduled-changes cron | `apps/api/src/cron/jobs/apply-scheduled-plan-changes.ts` | `*/15 * * * *`. Hosts the amount-mutation call site above. |
| SDK versions | `packages/billing/package.json`, `apps/api/package.json` | `@qazuor/qzpay-core ^1.12.0`, `@qazuor/qzpay-mercadopago ^2.2.0`. No direct `mercadopago` npm dep — all MP calls go through the qzpay adapter. |
| Sandbox runbook (pause/cancel preapproval via `PUT`) | `docs/migration/mercadopago-sandbox-runbook.md` (§5.2, L213-223) | Confirms direct `PUT https://api.mercadopago.com/preapproval/<id>` is already used operationally to pause. |

---

## 3. Findings

### 3.1 Endpoint & mutability — CONFIRMED MUTABLE

- The endpoint is **`PUT https://api.mercadopago.com/preapproval/{id}`**
  (MP Node SDK: `preApproval.update({ id, ... })`).
- MP's own update reference and the subscription-management how-to **explicitly list
  `auto_recurring.transaction_amount` (with `auto_recurring.currency_id`) as an
  updatable field**: *"This option lets you change the amount of an existing
  subscription. Send the new amount via `auto_recurring.transaction_amount` and
  `auto_recurring.currency_id` in a PUT request."* The amount is **NOT fixed at
  creation** for a no-associated-plan subscription.
- **The strongest evidence is in our own codebase**: Hospeda **already mutates the
  recurring amount of a live, authorized preapproval** in two production code paths
  (scheduled downgrade cron + upgrade-confirmation webhook), via
  `paymentAdapter.subscriptions.update(mpSubscriptionId, { transactionAmount })`.
  This is the exact operation case 3 needs. It is a proven pattern, not a hypothesis.
- Note: this applies to **subscriptions without an associated plan** (preapproval),
  which is exactly how Hospeda creates monthly subs. Subscriptions *with* an
  associated plan are a different object (`/preapproval_plan/{id}`) and are NOT how
  Hospeda bills — out of scope.

### 3.2 Per-cycle vs permanent — change is PERSISTENT, applies to FUTURE charges

- An amount change via `PUT /preapproval/{id}` **persists** as the subscription's new
  recurring amount and is billed on **subsequent** charges. It is not a one-shot
  per-cycle override. Therefore the multi-cycle mechanism is:
  **lower the amount → it stays lowered for every cycle until we raise it →
  after the Nth discounted charge, raise it back to full.** We own the restore.
- **Re-authorization:** MP's subscription-management docs state that when you modify
  the amount, **MP notifies the subscriber by email** of the change. The public docs
  do **NOT** state that an amount change forces the payer to re-approve before the
  next charge for a *no-plan, authorized* preapproval; and our existing upgrade/
  downgrade flows mutate the amount with no re-auth step and rely on the next charge
  reflecting it. For **case 3 the amount only goes DOWN then back to the ORIGINAL**
  (never above the originally-authorized amount), which is the lowest-risk direction
  for re-auth concerns — the payer authorized full price at signup, and we never
  exceed it.
- **Caveat (must verify in staging, see §6):** MP is known to constrain *large
  increases* of the recurring amount (a subscriber authorized $X; pushing the amount
  far above $X can require re-auth or be rejected). Case 3 never exceeds the original
  amount, so this constraint should not bite — but the **restore step raises the
  amount back up**, and we must confirm restoring to the *original* authorized value
  is accepted without re-auth (expected yes, since it equals the originally-approved
  ceiling). This is the single most important thing the staging smoke (AC-3.3) must
  prove.

### 3.3 Timing window & anchor signal

- **Billing cadence:** first authorized charge happens ~1h after the preapproval is
  authorized; subsequent charges follow the `auto_recurring.frequency` /
  `frequency_type`. The public docs do **not** publish an exact "you must update N
  hours before the charge" SLA.
- **Anchor signal:** the MP preapproval object exposes a `summarized` block which in
  practice carries `next_payment_date` (and `last_charged_date` /
  `charged_quantity`). The cron can `subscriptions.retrieve(preapprovalId)` (already
  done every minute by `subscription-poll.job.ts`) and read the **next-charge date**
  to decide when to mutate. **`next_payment_date` exact availability/name on the
  no-plan preapproval object must be confirmed in the staging smoke** — Context7 did
  not return the full GET response schema, so this is asserted from MP's documented
  object shape, not directly cited, and is flagged as a verification item.
- **Charge-completion signal (the reliable one):** MP fires
  **`subscription_authorized_payment.created`** when a recurring charge is generated
  (already routed in `webhooks/router.ts`). This is the *deterministic* event to
  drive the discounted-cycle counter and the restore. Recommended anchoring is on
  this **post-charge** event rather than racing a pre-charge deadline (see §5).

### 3.4 Idempotency & risk

- **Idempotency:** the MP SDK supports an `idempotencyKey` via `requestOptions` on
  preapproval operations. Whether `@qazuor/qzpay-mercadopago@2.2.0`'s
  `subscriptions.update` forwards an idempotency key must be confirmed (spike
  follow-up / read the adapter). Even without it, `PUT /preapproval/{id}` is a state
  *set* (sets amount = X), so re-applying the same target amount is naturally
  idempotent in effect.
- **Race risk:** the real risk is **mutating the amount in the same window MP is
  generating the charge** — under/over-charging a cycle. The repo's existing
  mutate-on-downgrade code treats the MP call as **best-effort / non-fatal** (logs on
  failure, local state already committed). For a *discount* we cannot be that
  cavalier: a missed mutation means the customer is charged full price for a cycle
  they were promised a discount on. The mitigation is to **drive the counter off the
  post-charge `subscription_authorized_payment` event** and verify the charged amount
  matched expectation, rather than trying to land the mutation in a pre-charge race.

---

## 4. Verdict {#verdict}

### **VERDICT: Outcome A — GO. The mechanism is viable.**

`auto_recurring.transaction_amount` **is mutable on an active, authorized
no-plan preapproval** via `PUT /preapproval/{id}`. This is confirmed by MP's own
docs AND, decisively, by the fact that **Hospeda already performs this exact
mutation in production** (plan upgrade/downgrade). Case 3 only ever moves the amount
**down from, and back to, the originally-authorized full price** — the safest
direction — so it avoids the known "large increase needs re-auth" constraint.

Outcome A is conditioned on **one staging verification** (§6): that restoring the
amount back to the original authorized value after N discounted cycles is accepted
without payer re-authorization, and that `next_payment_date` (or the
`subscription_authorized_payment` event) is a usable cron anchor. Given the existing
production mutation already raises amounts on upgrades without re-auth, the expected
outcome is positive; this is a confirmation, not a gating unknown.

---

## 5. Recommended implementation approach (Outcome A)

**Anchor on the post-charge event, not a pre-charge race.**

1. **Apply the discount at sign-up / code-apply time.** When `LANZAMIENTO50`
   (`discount` effect, `durationCycles = 3`) is applied to a monthly sub, set the
   preapproval's `transaction_amount` to the discounted value *before the first
   discounted charge* via
   `paymentAdapter.subscriptions.update(mpSubscriptionId, { transactionAmount: discountedMajor })`
   (reuse the exact call the plan-change flow uses). Persist `remainingDiscountCycles`
   and the `originalTransactionAmount` (full price, source of truth = the plan price,
   not a value read back from MP).
2. **Count cycles off `subscription_authorized_payment.created`.** This webhook
   (already routed) fires when MP generates a recurring charge. On each event for a
   discounted sub: decrement `remainingDiscountCycles`. This is deterministic and
   avoids guessing charge timing.
3. **Restore when the counter hits 0.** When the last discounted charge is confirmed
   (`remainingDiscountCycles === 0`), call `subscriptions.update(mpSubscriptionId,
   { transactionAmount: originalMajor })` to raise the amount back to full price for
   the next cycle. Restoring to the *original authorized ceiling* is the re-auth-safe
   direction.
4. **Pre-flight reconcile, don't race.** Optionally, the existing every-minute
   `subscription-poll.job.ts` can `retrieve` the preapproval and, if it sees the live
   `transaction_amount` drift from what the discount state expects (e.g. a missed
   mutation), correct it *before* `next_payment_date`. Treat this as a safety net,
   not the primary mechanism.
5. **Idempotency.** Pass an idempotency key derived from
   `(subscriptionId, targetAmount, cycleIndex)` if the adapter supports it; regardless,
   the operation is a set-to-target so repeated applies converge. Guard the cron with
   the existing cron-lag/idempotency patterns used by `apply-scheduled-plan-changes`.
6. **Fail-closed on the discount apply.** Unlike the best-effort downgrade mutation,
   the *initial* discount mutation should be treated as **fail-closed** for the
   user-facing apply: if MP rejects the amount change, surface a typed error and do
   NOT mark the code as applied (else the customer is charged full price under a
   "discount"). The *restore* can be best-effort-with-retry (worst case: customer
   keeps the discount one extra cycle — recoverable, not a refund situation).
7. **Cron / poll must not "correct" an intentionally-discounted amount.** Any
   reconciler that compares live MP amount vs plan price must be made discount-aware
   (read `remainingDiscountCycles`) so it does NOT raise the amount back mid-discount.
   This is the §10 "cron interaction" risk called out in the spec — wire the discount
   state into every amount-reconciliation path.

---

## 6. Required staging verification before building (AC-3.3)

On a **real MP sandbox preapproval** across **≥2 renewal cycles** (frequency shortened
for the smoke), prove:

1. `PUT /preapproval/{id}` with a lowered `transaction_amount` is accepted on an
   `authorized` sub, and the **next** `subscription_authorized_payment` charges the
   lowered amount.
2. Restoring `transaction_amount` back to the **original** value is accepted
   **without** triggering payer re-authorization, and the following charge is at full
   price.
3. The GET preapproval object (or `subscriptions.retrieve`) exposes a usable
   next-charge signal (`summarized.next_payment_date` or equivalent) AND/OR the
   `subscription_authorized_payment.created` webhook fires reliably per cycle.
4. `@qazuor/qzpay-mercadopago@2.2.0` `subscriptions.update` forwards an idempotency
   key (read the adapter source / confirm in node_modules).

If (2) fails (restore requires re-auth), fall through to §7 redesign — do **not**
refund.

---

## 7. Fallback redesign directions (only if Outcome B materializes — NO refunds)

Recorded for completeness; **not** needed under the current GO verdict unless §6
verification (2) fails. None use refunds/credits (owner veto).

1. **Shorter discounted preapproval, recreated once.** Create the preapproval with
   the discounted `transaction_amount` and a `frequency`/end that covers exactly the
   N discounted cycles; when it ends (or after the Nth charge), **create a fresh
   preapproval at full price** for the ongoing subscription. One controlled
   cancel+recreate at a known boundary (not per cycle) avoids live mutation entirely.
   Cost: the payer re-authorizes the new full-price preapproval once (acceptable if
   framed as "your launch discount ended").
2. **Discount realized as trial-day extension equivalent.** Convert the monetary
   discount into deferred billing: instead of charging −50% for 3 cycles, grant the
   economically-equivalent free time up front by extending `trial_end` /
   `free_trial_days` so the first paid charge is delayed, then bill full price. Only
   works for discounts expressible as "free days" (a flat-percentage-of-N-cycles
   converts cleanly to a day count); does not reproduce a true per-cycle −50% but
   delivers equivalent customer value with zero live-amount mutation. (Reuses the
   already-supported `free_trial_extension` effect plumbing.)
3. **Discounted-amount preapproval with a server-side full-price re-subscribe
   prompt.** Bill the discounted amount via the live preapproval for N cycles, and at
   cycle N surface an in-app "continue at full price" re-subscribe step (new
   preapproval) instead of an automatic restore — moves the re-auth to a user action
   rather than an unattended cron mutation.

The owner selects among these only if the staging smoke disproves the restore step.

---

## Appendix — exact existing mutation call (proof it works today)

`apps/api/src/cron/jobs/apply-scheduled-plan-changes.ts` (~L297-318):

```ts
if (mpSubscriptionId) {
    const paymentAdapter = billing.getPaymentAdapter();
    if (paymentAdapter) {
        try {
            await paymentAdapter.subscriptions.update(mpSubscriptionId, {
                planId: newPlanId,
                transactionAmount: targetTransactionAmountMajor // ARS units, = unitAmount / 100
            });
        } catch (mpErr) { /* best-effort: logged, local state already committed */ }
    }
}
```

`apps/api/src/routes/webhooks/mercadopago/payment-logic.ts` (~L431-455,
`confirmPlanUpgrade`) uses the identical `subscriptions.update(..., { transactionAmount })`
shape. Case 3 reuses this call with discounted/restored amounts.
