# SPIKE — HOS-176: propagate plan price changes to MercadoPago

> **Issue:** HOS-176 — *Changing a plan's price from the admin does not reach MercadoPago; existing subscribers keep paying the old price.*
> **Priority:** High · **Billing CORE** · **High risk + legal implication.**
> **Owner decision already taken:** **propagate-con-aviso** (propagate the new price to existing subscribers, with prior notice).
> **Status:** SPIKE — **STOP here for owner review before implementing any live mutation.**
> **Date:** 2026-07-22 · **WT-E** (batch 22-07)

---

## 0. TL;DR for the reviewer

- The **mutation mechanism itself is already proven and shipped** in this codebase.
  `PUT /preapproval/{id}` with a new `auto_recurring.transaction_amount` works on a
  live authorized subscription — we do it today on plan upgrade/downgrade and on
  promo discount apply/restore. So "just wire the call" is *technically* a small change.
- **BUT the one direction we have NEVER exercised is the one HOS-176 needs most: a
  price INCREASE above the amount the subscriber originally authorized.** Every
  existing mutation either lowers the amount or restores it *up to, but never above,*
  the originally-authorized ceiling. MP is documented to constrain large increases
  (may require payer re-authorization or reject outright). **This is the single
  gating unknown and it MUST be verified against the real MP sandbox before we build
  the propagation.** If MP rejects/needs re-auth on increase, the whole feature shape
  changes (increases can't be auto-propagated; they become a re-subscribe prompt).
- **Legal (Disposición 954/2025):** raising a recurring debit without prior notice is
  a chargeback magnet and very likely non-compliant. Increases require **advance
  notice + a grace window** before the mutation lands. **Decreases have none of this
  friction** and can propagate immediately.
- Therefore the feature is **asymmetric**: decrease = frictionless immediate batch;
  increase = notice → grace → batch, gated on the re-auth verification.
- Below: the confirmed facts, the exact code seams, the gating unknowns, four
  **owner decisions I need**, and a phased mini-spec. **No code beyond this doc until
  the owner signs off.**

---

## 1. What is confirmed (no verification needed)

### 1.1 The hole is exactly as described

`packages/service-core/src/services/billing/plan/plan.crud.ts` → `updatePlan` (:543)
reconciles `billing_plans` + `billing_prices` inside one transaction and **stops there**.
Zero references to `transactionAmount` / `preapproval` / `mpSubscriptionId`. The admin
saves the new price, the plans page shows it, MP keeps charging the old amount — silently.

`apply-scheduled-plan-changes.ts` does **not** cover this: it moves *one subscriber*
from plan A to plan B (queued by the plan-change route), not "a plan's price changed
with N subscribers sitting on it".

### 1.2 The mutation mechanism is proven and shipped

`auto_recurring.transaction_amount` is mutable on an active, authorized **no-plan
preapproval** via `PUT /preapproval/{id}`. Evidence, strongest first:

1. **We already do it in production**, two paths:
   - `apps/api/src/cron/jobs/apply-scheduled-plan-changes.ts` (step 2, ~:394):
     `paymentAdapter.subscriptions.update(mpSubscriptionId, { planId, transactionAmount, reason })`.
   - `apps/api/src/routes/webhooks/mercadopago/payment-logic.ts` `confirmPlanUpgrade`:
     same call on upgrade confirmation.
2. **The promo engine's dedicated mutation seam** —
   `apps/api/src/services/promo-renewal-mp.service.ts` — `applyInitialDiscountMutation`
   (fail-closed) and `restoreFullPriceMutation` (best-effort + retry + Sentry). This is
   the *exact* structural template for HOS-176's executor.
3. **The SPEC-262 spike** (`packages/service-core/.../promo-code/docs/mp-preapproval-mutation-spike.md`)
   empirically verified Outcome A **GO** against real MP, and **HOS-191 SP-1**
   (engram #8080) re-verified it in PROD MP on a plan-based sub: lower `15000→12000`
   → HTTP 200, sub stays `authorized`, then restore `12000→15000` → HTTP 200.

### 1.3 HOS-171 widened the blast radius to *every* subscription

Since HOS-171 (card-first, annual → recurring preapproval), **all** subscriptions —
monthly and annual — are MP preapprovals subject to this. Before, annual was a one-off
charge and a new price only ever hit the next buyer. Now a stale annual preapproval
keeps re-billing the old amount every year. This raises the stakes vs. the original filing.

### 1.4 MP emails the customer on every amount change (uncontrolled)

Verified in the HOS-171 spike: MP sends the subscriber an email **every time**
`transaction_amount` changes. So the customer finds out regardless — the only question
is whether they hear it **from us first, with context**, or **from MP cold**. This is an
argument *for* prior notice, not a nice-to-have.

---

## 2. THE gating unknown (verify before building)

**All the proven evidence is for the amount going DOWN, or being restored UP to (never
above) the originally-authorized ceiling.** HOS-176's headline case — the owner raising
a plan's price — pushes `transaction_amount` **above** what the subscriber authorized at
signup. The SPEC-262 spike itself flagged this exact caveat (§3.2):

> *"MP is known to constrain large increases of the recurring amount (a subscriber
> authorized $X; pushing the amount far above $X can require re-auth or be rejected).
> Case 3 never exceeds the original amount, so this constraint should not bite."*

HOS-176 **does** exceed it. So the gating questions for a **real MP sandbox** smoke,
**before writing the propagation job**:

- **G-1** — Does `PUT /preapproval/{id}` raising `transaction_amount` above the
  originally-authorized amount get **accepted** on an `authorized` sub, and does the
  **next** `subscription_authorized_payment` charge the new (higher) amount **without**
  forcing payer re-authorization?
- **G-2** — Is there a magnitude ceiling? (e.g. accepted for +10%, rejected/needs-auth
  for +200%.) MP has historically gated "large" increases; we need the practical bound.
- **G-3** — On rejection/needs-reauth, what does the adapter surface, and does the sub
  stay chargeable at the OLD amount (safe) or land in a broken state (unsafe)?

**If G-1 is NO** (increase needs re-auth / is rejected): auto-propagating an increase is
impossible, and the feature for the increase direction becomes a **re-subscribe prompt**
(new preapproval at the new price, payer re-authorizes once), *not* a silent mutation.
That is a fundamentally different build — hence: **verify first.** Decreases are
unaffected either way.

> This mirrors how SPEC-262 and HOS-191 were run: **spike/smoke the MP behavior first,
> decide the shape second.** I recommend the owner runs this specific increase smoke
> (G-1/G-2/G-3) on the sandbox as part of the same card-time already reserved for WT-A.

---

## 3. Legal / product framing (Disposición 954/2025)

Same regulatory family as HOS-171 §7.7 (arrepentimiento). Raising an automatic recurring
debit is precisely the scenario the disposición targets. Practical consequences:

- **Increase → prior notice is mandatory, not optional.** Notify each affected
  subscriber *before* the mutation, stating old price, new price, and effective date,
  with a real window to cancel. Without it: chargebacks + likely non-compliance.
- **Grace window.** The mutation must be *scheduled*, not immediate: notice sent on
  day 0, mutation applied on day 0 + N. N is an owner/legal decision (see D-3).
- **Decrease → no notice needed, no chargeback risk.** Can propagate immediately.
- **"Effective date" semantics.** Cleanest is "applies to your **next** renewal on/after
  <date>", which the mutation naturally produces (MP bills the new amount on the next
  cycle). We should say that explicitly in the notice.

I am **not** a lawyer; D-3 (notice window length + copy) should get an explicit owner/legal
sign-off, not an engineering guess.

---

## 4. Proposed mechanism (pending owner sign-off)

Modeled on the two proven precedents, **not** a synchronous call inside `updatePlan`.

### 4.1 Trigger & enqueue (NOT synchronous in the admin request)

`updatePlan` must never fan out N MP calls inside the admin's request. When it detects a
**price delta** on a plan with active subscribers, it **enqueues a price-propagation
job** (a new row/table, mirroring `scheduledPlanChange` but keyed by plan, not sub) and
returns immediately. The admin UI shows: *"Price saved. X active subscribers will be
notified and re-priced on <effective date>."* (increase) or *"…will be re-priced on their
next renewal."* (decrease).

### 4.2 The propagation job (batch + lock + retry)

A cron job (or a durable worker) that, per enqueued price change:

1. **Loads affected subs** — all `active`/`trialing` subs on the plan with a non-null
   `mp_subscription_id`. Batched (`MAX_ROWS_PER_TICK`) like `findDueScheduledChanges`.
   Excludes `comp` (no preapproval) and already-cancelled.
2. **Per-sub idempotent apply** — reuse the `apply-scheduled-plan-changes` **pre-stamp**
   pattern: mark the per-sub propagation row `applied` *before* the MP call so a finalize
   failure can never double-mutate; roll back to `pending` on MP failure with
   `attemptCount`/`lastError`; flip to `failed` after `MAX_APPLY_ATTEMPTS`.
3. **The MP call** — the **exact** `paymentAdapter.subscriptions.update(mpSubscriptionId,
   { transactionAmount, reason })` used everywhere else. Failure semantics:
   - **Increase:** treat like `restoreFullPriceMutation` — best-effort **with retry +
     Sentry**; a stuck sub stays on the OLD (lower) price = revenue leak, recoverable,
     never overcharge. Never fail-closed in a way that overcharges.
   - **Decrease:** best-effort with retry; a stuck sub stays on the OLD (higher) price
     until the reconciler catches it — must be corrected because we promised the lower price.
4. **Discount-awareness (mandatory).** If a sub has an active multi-cycle discount
   (`promo_effect_remaining_cycles`), the target amount must be recomputed on the NEW plan
   price via the existing `resolveDiscountAwarePlanChangeAmount` logic — **do not clobber a
   live discount with the full new price.** This is the SPEC-262 §10 cron-interaction risk;
   HOS-176 is a new amount-reconciliation path and must be wired into it.
5. **Notice (increase only), before the mutation.** New `NotificationType` (none exists —
   §6). Sent at enqueue/notice time; the mutation is scheduled for notice + N.

### 4.3 Divergence detection (extend, don't build new)

HOS-171 §7.5 already compares charged-vs-expected amount in the payment webhook
(`apps/api/src/routes/webhooks/mercadopago/subscription-payment-handler.ts`). Extend that
check to flag when MP's charged amount diverges from `billing_prices.unit_amount` (the
source of truth) beyond an active-discount explanation → Sentry/alert. This is the
backstop that makes a missed mutation *visible* instead of silent, and it's the "detect
the divergence" ask in the issue's scope.

---

## 5. Reused code seams (concrete)

| Need | Reuse from | Note |
|---|---|---|
| MP amount mutation call | `promo-renewal-mp.service.ts` (`subscriptions.update({ transactionAmount, reason })`) | Copy the fail-closed vs best-effort-retry+Sentry structure. |
| Batch + idempotent apply loop | `apply-scheduled-plan-changes.ts` (pre-stamp, `MAX_APPLY_ATTEMPTS`, `MAX_ROWS_PER_TICK`, `ApplyOutcome`) | The whole retry/failed/finalize skeleton transfers. |
| Discount-aware target amount | `resolveDiscountAwarePlanChangeAmount` (same file) | Must call this, not raw new price. |
| MP `reason` (buyer-facing label) | `resolvePlanChangeReason` (`services/billing/plan-change-reason.ts`) | HOS-220/231 — show plan display name, not UUID. |
| Divergence check | `subscription-payment-handler.ts` (HOS-171 §7.5) | Extend the existing charged-vs-expected comparison. |
| Notification send | `sendNotification` + `@repo/notifications` `NotificationType` | Need a NEW type (§6). |
| The hole to patch | `plan.crud.ts::updatePlan` (:543) | Enqueue on price delta; never fan out inline. |

---

## 6. Gaps to build (not just wiring)

1. **New `NotificationType`** — no price-change notice exists (`PLAN_CHANGE_CONFIRMATION`
   is for a subscriber changing their own plan, semantically different). Needs enum value,
   category (TRANSACTIONAL), es/en/pt copy, template. Advance-notice + effective-date copy.
2. **New enqueue store** — a `billing_plan_price_changes` (or `scheduledPriceChange` JSONB
   per sub) to track: plan, old/new price, notice-sent-at, effective-at, per-sub status,
   attemptCount, lastError. New migration (`packages/db/src/migrations`, structural carril).
3. **New cron job** in the registry (mirrors `apply-scheduled-plan-changes`).
4. **`updatePlan` change** — detect price delta, decide direction, enqueue vs. immediate.
5. **Admin UX copy** — the save-confirmation must tell the operator what will happen
   (who's affected, when, that it's async), so "silent divergence" can't recur.
6. **Divergence-check extension** in the payment webhook.

---

## 7. Owner decisions I need before implementing

- **D-1 — Increase re-auth smoke (BLOCKING).** Confirm we run the G-1/G-2/G-3 sandbox
  smoke (raise `transaction_amount` above the authorized amount, observe accept/charge/
  re-auth) *before* building the increase path. If MP needs re-auth on increase, the
  increase path becomes a **re-subscribe prompt**, not a mutation. **Nothing downstream
  can be designed until this is answered.** I recommend: yes, and you run it on the card
  time already reserved for WT-A.
- **D-2 — Symmetric or split rollout?** (a) Ship **decreases first** (frictionless, no
  legal gate, immediate value, proves the batch machinery) and treat **increases** as a
  fast-follow gated on D-1; or (b) build both together behind the notice+grace flow.
  **Recommendation: (a)** — decreases are low-risk and unblock the machinery while the
  increase re-auth question is resolved.
- **D-3 — Notice window length + copy owner.** How many days between the price-change
  notice and the mutation for increases (7? 15? 30?), and who signs off the legal copy
  (Disposición 954/2025). Engineering should not guess this.
- **D-4 — Trialing subscribers on a price change.** A `trialing` sub hasn't been charged
  yet. On an increase: do we re-price their *first* post-trial charge (they were shown the
  old price at signup — arguably grandfather them through the current period), or apply
  immediately? Product call. **Recommendation:** grandfather the in-flight trial's first
  charge; apply from the following cycle.

---

## 8. Phased mini-spec (contingent on §7)

> Phases 2+ are contingent on D-1's smoke result and D-2's rollout choice.

- **Phase 0 — Increase re-auth smoke (D-1).** Owner runs G-1/G-2/G-3 on sandbox. Output:
  GO/NO-GO for auto-propagating increases + the practical magnitude bound. *Gate for
  everything else.*
- **Phase 1 — Enqueue store + `updatePlan` detection + divergence check.** Migration for
  the price-change store; `updatePlan` detects a price delta and enqueues (no MP calls yet);
  extend the webhook divergence check. Fully testable with no live mutation. Ships value
  (detection) immediately.
- **Phase 2 — Decrease propagation job.** Batch job, idempotent apply, discount-aware,
  best-effort+retry, reconciler backstop. No notice needed. Staging smoke: real sandbox
  decrease across ≥2 cycles.
- **Phase 3 — Increase propagation (only if Phase 0 = GO).** New `NotificationType` +
  advance-notice + grace window (D-3) + scheduled mutation + trialing handling (D-4).
  Staging + prod smoke with the increase re-auth path.
- **Phase 4 — Admin UX copy** so the operator sees the async/affected-subscribers effect.

**Acceptance (headline):** after an admin price change, every affected active subscriber's
MP preapproval charges the new `billing_prices.unit_amount` on their next cycle (increases
after notice + grace), discounts preserved, divergence surfaced in Sentry, and no
subscriber is ever charged *more* than authorized without prior notice + (if MP requires
it) re-authorization.

**Smoke gates:** `status-needs-smoke-staging` + `status-needs-smoke-prod` (billing CORE).
Real-MP smoke conducted by the owner. Issue stays `In Review` until sign-off — never
auto-closed.

---

## 9. Key risks

1. **Increase re-auth (G-1)** — could invalidate the auto-propagate-increase design. *Mitigation: Phase 0 smoke gates it.*
2. **Racing the charge** — mutating in the same window MP generates a charge → wrong-amount cycle. *Mitigation: schedule off notice+grace, not a pre-charge race; reconciler backstop (SPEC-262 §5.4 pattern).*
3. **Clobbering a live discount** — applying full new price over an active multi-cycle discount. *Mitigation: mandatory `resolveDiscountAwarePlanChangeAmount`.*
4. **Legal non-compliance on increase** — *Mitigation: notice + grace (D-3), owner/legal sign-off.*
5. **Partial batch failure** — some subs re-priced, some not → mixed pricing. *Mitigation: per-sub idempotent pre-stamp + retry + failed-state + divergence detection so stragglers are visible.*
6. **`comp` / no-`mp_subscription_id` subs** — must be excluded (no preapproval to mutate). *Mitigation: filter in the due-query.*
