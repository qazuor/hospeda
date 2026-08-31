---
title: Courtesy cycles — gift N free cycles to a paying subscriber
linear: HOS-180
statusSource: linear
created: 2026-08-29
type: feature
areas:
  - billing
  - api
  - admin
---

# Courtesy cycles — gift N free cycles to a paying subscriber

## 1. Summary

Let an admin gift **N free billing cycles** to a subscriber who is already paying,
without cancelling their subscription, without asking for their card again, and
without them losing access to anything.

The mechanism is a **new subscription status** (`courtesy`) backed by pausing the
MercadoPago preapproval. MP skips the cycles while paused; a cron resumes the
preapproval when the gift runs out and the subscription returns to `active` at
full price on its own.

## 2. Problem

There is no way to say *"this month is on us"* to an existing paying customer.
The four available mechanisms are each closed for a different reason (verified in
code, see HOS-180):

| Mechanism | Why it does not work |
|---|---|
| `FREEMONTH` (`trial_extension`) | `applyPromoCode` Rule 2 rejects it unless the subscription is `trialing`. A paying customer is `active`. |
| Discount < 100% for N cycles | Works, but it is *"50% off next month"*, not *"free"*. |
| Discount = 100% | MercadoPago rejects a preapproval with amount 0. |
| `HOSPEDA_FREE` (`comp`) | Permanent by construction (`isPermanent: true`, 100-year period) and it destroys the preapproval (`mp_subscription_id = NULL`). Never returns to full price, and there is nothing to return to. |

The exact gap: `comp` is a **binary, permanent status**, not a quantity of cycles.
`promo_effect_remaining_cycles` does know how to count cycles, but it only modulates
a **discount**, and a discount cannot reach zero.

## 3. Goals

- **G-1** — An admin can grant N courtesy cycles to a live, paying subscription
  from the admin panel.
- **G-2** — The subscriber keeps **every entitlement of their plan** for the whole
  courtesy window. This is the point of the feature: they paid so as not to lose
  the service.
- **G-3** — MercadoPago does not charge during the window, and does not charge
  retroactively when it ends.
- **G-4** — When the gift runs out, the subscription returns to `active` at full
  price **on its own**, with no admin action and without re-entering the card.
- **G-5** — A real pause (self-serve or admin) keeps working exactly as today,
  including cutting entitlements. Courtesy must not weaken it.
- **G-6** — The subscriber can tell, from their own panel, that they are on a gift
  and when it ends.

## 4. Non-goals

- **NG-1** — A redeemable promo code for courtesy cycles. This spec is an admin
  action on one concrete subscription (owner decision, 2026-08-29). A new
  `effect_kind` may come later; the design must not block it, but does not build it.
- **NG-2** — Changing what `paused` means. `paused` keeps cutting entitlements.
- **NG-3** — Self-service: a subscriber cannot grant themselves courtesy.
- **NG-4** — Courtesy on a subscription that is not live (`past_due`, `cancelled`,
  `pending_provider`, `abandoned`). See AC-3.
- **NG-5** — Fixing the single paused-email template for its other origins. This
  spec only guarantees courtesy does **not** get that template (G-6 / AC-9); the
  broader bug stays its own issue.

## 5. Current baseline

### What was measured against MercadoPago (2026-08-27 → 2026-08-29)

Experiment on preapproval `daf021b8384b4a40ba295fe40b06a829` (sandbox, **daily**
cadence at $100 ARS so a full cycle elapses in 24 h). Recorded on HOS-180:

| moment | action | `charged_quantity` | `next_payment_date` |
|---|---|---|---|
| 28/08 01:03:26 | control charge (positive control) | 1 | 29/08 00:48 |
| 28/08 01:04:41 | `PUT status=paused` | 1 | 29/08 00:48 (unchanged) |
| 29/08 00:48 | **due date elapses while paused** | **1** | **30/08 00:48** |
| 29/08 07:12:22 | `PUT status=authorized` (resume) | **1** | **30/08 00:48** |

Cross-checked against `GET /authorized_payments/search`: exactly **one** payment
ever (`id=7031313703`). `pending_charge_quantity: null`.

Three facts this establishes:

1. **Paused, MP does not charge.** The due date passed with no debit.
2. **Pausing does not accrue debt.** `next_payment_date` advanced on its own from
   29/08 to 30/08 while paused — cycles are **skipped, not stacked**. This rules
   out a retroactive charge per skipped cycle on resume. (`last_modified` did not
   even move for that advance.)
3. **Resuming does not charge on the spot.** After the PUT, no new charge, nothing
   pending, and the next due date is the normal one. No surprise debit.

Also measured (27/08, recorded on HOS-180): `free_trial` and `start_date` on an
authorized preapproval are **immutable** — the PUT returns 200 and changes nothing.
That permanently rules out the "inject a free trial into a live preapproval"
candidate. Only `transaction_amount` is mutable (floor $15 ARS).

### The blocker is on our side, not MercadoPago's

`packages/billing/src/predicates/is-entitlement-granting-status.ts:39`

```ts
export const ENTITLEMENT_GRANTING_STATUSES = ['active', 'trialing', 'comp'] as const;
```

`paused` is not there. Pausing a subscriber to "gift" them a month would **cut their
service** for that month — the opposite of the use case.

### The pattern to replicate already runs in production

`trialing` does not exist in MercadoPago either. MP reports `authorized`, and
`deriveTrialingStatus` turns it into `trialing` by reading the local `trial_end`.
The webhook hot path in
`apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts` is a four-stage
pipeline:

1. **line 468** — `providerStatus = QZPAY_TO_HOSPEDA_STATUS[qzpayStatus]`
   (`packages/service-core/src/services/billing/subscription/subscription-status-provider.ts`).
   Maps MP vocabulary to ours. It can never produce `TRIALING`.
2. **lines 571-579** — resolve `resolvedTrialEnd` (preserve-if-set from the local row).
3. **lines 585-589** — `mappedStatus = deriveTrialingStatus({ mappedStatus: providerStatus, trialEnd: resolvedTrialEnd, now })`
   (`subscription-status-derive.ts`). Pure, no I/O. **This** is what produces `TRIALING`.
4. **lines 738 and 956** — `checkSubscriptionStatusTransition({ from: previousStatus, to: mappedStatus })`
   (`subscription-status-transitions.ts`), the second one a re-check inside the
   transaction under `FOR UPDATE`.

`courtesy` plugs in as a **second derivation** at stage 3, keyed off a local column
the way `trialing` is keyed off `trial_end`.

### Relevant facts about the current code

- **`billing_subscriptions.status` is a plain `varchar(50)`** with **no CHECK
  constraint** anywhere (`@qazuor/qzpay-drizzle`,
  `packages/drizzle/src/schema/subscriptions.schema.ts:27`, re-exported untouched by
  `packages/db/src/billing/schemas.ts:13`). A new status value needs **no DB
  migration** — exactly how `comp` and `abandoned` were added. Validation is
  app-level: enum + transition guard.
- `SubscriptionStatusEnum` lives at
  `packages/schemas/src/enums/subscription-status.enum.ts` with 9 values
  (`active`, `trialing`, `past_due`, `paused`, `cancelled`, `expired`,
  `pending_provider`, `abandoned`, `comp`).
- **Pause and resume are already wired.** `billing.subscriptions.pause(id)` and
  `.resume(id)` (called at `apps/api/src/routes/billing/subscription-pause.ts:117`
  and `:187`) reduce to a single MP call each —
  `PUT /preapproval/{id} {status:'paused'}` and `{status:'authorized'}`
  (`@qazuor/qzpay-mercadopago`, `subscription.adapter.ts:181-197`). This spec adds
  no new MercadoPago plumbing.
- **Transitions touching `PAUSED` today** (`subscription-status-transitions.ts:94-162`):
  in — `TRIALING → PAUSED` (:114), `ACTIVE → PAUSED` (:121); out — `PAUSED → ACTIVE`
  (:137), `PAUSED → TRIALING` (:138, the HOS-913 fix), `PAUSED → CANCELLED` (:139).
- **An invalid transition is silent.** The webhook logs an error and returns
  `{ success: true, statusChanged: false }` with HTTP 200 (`subscription-logic.ts:799`,
  and again inside the transaction ~:1000). The row is never written and no side
  effect fires. This is precisely the HOS-913 bug shape.
- **No spare column exists** for the courtesy deadline. Every candidate is already
  load-bearing: `cancelAt` (scheduled hard cancel), `cancelAtPeriodEnd` (soft-cancel
  grace), `gracePeriodEndsAt` (7-day past-due dunning grace),
  `promoEffectRemainingCycles` (multi-cycle discount countdown). See OQ-1.
- **The paused email is one template for every origin**
  (`packages/notifications/src/templates/subscription/subscription-paused.tsx`),
  sent purely on the observed transition to `PAUSED` via `shouldSendPausedEmail`
  (`subscription-logic.ts:177-182`, dispatched at `:1506-1516`). Its copy assumes a
  payment problem.
- **Closest structural precedent for the admin action**:
  `apps/api/src/routes/billing/admin/subscription-trial-extension.ts` —
  `POST /api/v1/admin/billing/subscriptions/:subscriptionId/apply-trial-extension`,
  gated by a permission plus `assertSubscriptionOwnership`.

## 6. Proposed design

### 6.1 A derived status, not a flag

Add `COURTESY = 'courtesy'` to `SubscriptionStatusEnum`.

A status rather than a `pause_reason` boolean on `paused`, deliberately: every call
site that already asks `status === 'paused'` would keep treating a courtesy as a
real pause, and each would have to be audited by hand. A distinct enum member makes
the compiler participate in the review.

### 6.2 The four-stage pipeline, with one stage added

MercadoPago cannot express "courtesy" — it only knows `paused`. So the first
`preapproval.updated` webhook would map to `PAUSED` and overwrite the state,
cutting the subscriber's service. The fix is the same one `trialing` already uses:
**derive it locally.**

```
raw MP status
  → QZPAY_TO_HOSPEDA_STATUS        (paused → PAUSED)
  → deriveTrialingStatus           (unchanged; only acts on ACTIVE)
  → deriveCourtesyStatus           (NEW: PAUSED + live courtesy window → COURTESY)
  → checkSubscriptionStatusTransition
  → write
```

`deriveCourtesyStatus` mirrors `deriveTrialingStatus` exactly — pure, no I/O:

```ts
// returns COURTESY when the provider says paused AND the local row is inside a
// live courtesy window; otherwise returns mappedStatus untouched.
export function deriveCourtesyStatus(input: {
    mappedStatus: SubscriptionStatusEnum;
    courtesyEndsAt: Date | null | undefined;
    now: Date;
}): SubscriptionStatusEnum;
```

Consequence worth stating plainly: when the window lapses, the same derivation
stops applying and `paused` means `paused` again. The local column is the only
thing separating the two readings of one provider state.

### 6.3 Granting

`POST /api/v1/admin/billing/subscriptions/:subscriptionId/grant-courtesy`, modelled
on `subscription-trial-extension.ts` (same permission-plus-ownership shape). Body
carries the number of cycles. Steps, in order:

1. Validate the subscription is live and eligible (AC-3).
2. Compute `courtesyEndsAt` from the current cycle boundary plus N cycles.
3. `billing.subscriptions.pause(id)` — the MercadoPago call.
4. Write `status = 'courtesy'` + `courtesyEndsAt` + `courtesyCyclesGranted`,
   through the transition guard, with an audit event.
5. Clear the entitlement cache and send the courtesy notification.

MercadoPago is called **before** the local write on purpose: if MP refuses, nothing
was promised locally. The reverse order can leave a subscriber marked `courtesy`
with a preapproval that is still charging them.

### 6.4 Ending it

A cron finds subscriptions with `status = 'courtesy'` and `courtesyEndsAt <= now`,
calls `billing.subscriptions.resume(id)`, and lets the resulting webhook settle the
row back to `active`.

**This cron is load-bearing, not a backstop** — the same warning the CLAUDE.md
carries for `trial-reconcile`. If it does not run, the subscriber stays paused in
MercadoPago forever: their gift silently becomes a permanent loss of service. See
R-1.

### 6.5 What must NOT change

`paused` keeps cutting entitlements. `ENTITLEMENT_GRANTING_STATUSES` gains
`courtesy` and nothing else.

## 7. Data model / contracts

### New status

`SubscriptionStatusEnum.COURTESY = 'courtesy'`
(`packages/schemas/src/enums/subscription-status.enum.ts`).

**This DOES need a structural migration**, contrary to what this section said
while it was being written. `billing_subscriptions.status` is indeed a
`varchar(50)` with no CHECK — but `packages/db/src/schemas/enums.dbschema.ts`
also derives a Postgres enum, `subscription_status_enum`, from this same TS enum
via `enumToTuple`. Adding a member therefore requires
`ALTER TYPE ... ADD VALUE 'courtesy'`, and `scripts/check-schema-drift.sh`
fails the build without it. Shipped as `0099_kind_toro.sql`; purely additive,
so it carries no data risk and needs no release-gap split.

Worth stating because the wrong version of this claim is exactly the kind of
"verified" detail that survives review: the column really is a varchar, and the
conclusion still did not follow.

### New fields

| field | type | meaning |
|---|---|---|
| `courtesyStartsAt` | timestamptz, nullable | when the gift begins — the end of the period the subscriber already paid for. Drives the "your gift is now active" notification. |
| `courtesyEndsAt` | timestamptz, nullable | when the gift expires. Drives the derivation and the cron. |
| `courtesyCyclesGranted` | integer, nullable | how many cycles were gifted. For display and audit. |

`courtesyStartsAt` exists because granting and starting are **two different
moments** (OQ-4): the admin grants it today, but the gift only begins when the
already-paid period runs out. Without the column there is no way to tell the
subscriber "it starts now" — see §8.

Per **OQ-1**, all three live as typed columns in `@qazuor/qzpay-drizzle`, the route
`product_domain` (HOS-73) and `promo_effect_remaining_cycles` took.

### Predicates

- `ENTITLEMENT_GRANTING_STATUSES` → `['active', 'trialing', 'comp', 'courtesy']`.
- `isSubscriptionLive` → new `courtesy` branch, evaluated against `courtesyEndsAt`,
  mirroring how `trialing` is evaluated against `trialEnd`.

### Transitions to add (`subscription-status-transitions.ts`)

| from → to | why |
|---|---|
| `ACTIVE → COURTESY` | the grant |
| `COURTESY → ACTIVE` | the cron resumes and the webhook confirms |
| `COURTESY → CANCELLED` | the subscriber or an admin cancels mid-gift — the one self-service billing action allowed during a gift (OQ-2) |
| `COURTESY → PAST_DUE` | the first charge after the gift fails |

`COURTESY → PAUSED` is deliberately **absent**. OQ-2 resolved to blocking
self-service pause during a gift, so the edge must not exist: adding it would
legitimise a state the API refuses to produce.

Enumerating these wrong reintroduces the HOS-913 failure mode — silent, 200, no
write. Every edge needs its own test (AC-10).

### Endpoint

`POST /api/v1/admin/billing/subscriptions/:subscriptionId/grant-courtesy` — admin
tier, permission-gated plus `assertSubscriptionOwnership`, following
`subscription-trial-extension.ts`. Per the error contract: an ineligible
subscription is **422**, a subscription owned by somebody else is **404, not 403**.

## 8. UX / UI behavior

**Subscriber panel** — while `courtesy`, the plan reads as active (all entitlements
work) with an explicit note that these cycles are a gift and the date the gift ends.
Never the word "paused": nothing is suspended for them.

`SubscriptionDashboard.client.tsx` already has the precedent — it picks `trialEndsAt`
over `currentPeriodEnd` while trialing, guarding against the date having elapsed
(:875-878). Courtesy needs the same treatment against `courtesyEndsAt`.

**Admin panel** — the grant action on a concrete subscription, plus the courtesy
state and its end date on the subscription view.

**Email — three moments, three notifications** (owner decision, 2026-08-31).
Granting and starting are not the same event, so the subscriber hears about the
gift three times:

| # | When | Trigger | Says |
|---|---|---|---|
| 1 | **Granted** | the admin's `grant-courtesy` call succeeds | "we gifted you N cycles; they start on `courtesyStartsAt`, when your current period ends" |
| 2 | **Started** | the cron crosses `courtesyStartsAt` | "your gift is running; you will not be charged until `courtesyEndsAt`" |
| 3 | **Ended** | the cron crosses `courtesyEndsAt` and resumes the preapproval | "the gift is over; normal billing resumes on <next charge date>" |

Notification #3 must go out **before or with** the resume, never after a charge
lands: a subscriber who sees a charge they were not expecting reads it as a bug.

New `NotificationType` members and their own templates under
`packages/notifications/src/templates/subscription/`. Registering the type is not
enough — the dispatch switch in `notification.service.ts` routes type → template,
and a template that is not wired there is silently never sent.

The gift must never receive `subscription-paused.tsx`, whose copy blames the
payment method (HOS-926). See R-7.

## 9. Acceptance criteria

- **AC-1** — An admin grants N cycles to an `active` subscription: it becomes
  `courtesy`, the MercadoPago preapproval is `paused`, and `courtesyEndsAt` is N
  cycles ahead.
- **AC-2** — During the window, the subscriber retains **every** entitlement of
  their plan. Verified through `loadEntitlements`, not only through the status.
- **AC-3** — The grant is rejected with **422** on a subscription that is not
  live (`past_due`, `cancelled`, `expired`, `pending_provider`, `abandoned`) and on
  one that is already `courtesy`.
- **AC-4** — A `preapproval.updated` webhook carrying `paused` during the window
  **does not** knock the subscription out of `courtesy`. This is the regression test
  for the overwrite the derivation exists to prevent.
- **AC-5** — Once the window lapses, the cron resumes the preapproval and the
  subscription ends up `active`, with no admin intervention.
- **AC-6** — Resuming produces **no immediate charge**: the first charge lands on
  the next natural due date.
- **AC-7** — No cycle is charged retroactively for the skipped ones.
- **AC-8** — A real pause (self-serve or admin) still cuts entitlements. Regression
  test against G-5.
- **AC-9** — A courtesy grant does not send the paused email; it sends its own.
- **AC-10** — Every transition listed in §7 has a test, and so does at least one
  rejected transition, asserting the row is **not** written.
- **AC-11** — The subscriber's panel shows the courtesy end date, never a
  "paused"/"suspended" wording.
- **AC-12** — The grant is rejected with **422** when the next MercadoPago charge
  is less than `COURTESY_MIN_LEAD_DAYS` (3) away, naming the next charge date in
  the error. See R-6.
- **AC-13** — Three notifications fire, once each: on grant, on start, on end.
  Re-running the cron over an already-notified boundary sends nothing further.
- **AC-14** — A subscriber in `courtesy` **can cancel** (soft-cancel succeeds) and
  **cannot** pause, change plan, or buy an addon — each rejected by its existing
  status gate, not by a new one.
- **AC-15** — `courtesyStartsAt` is the end of the already-paid period, not the
  grant instant, and `courtesyEndsAt` is N cycles after `courtesyStartsAt`.

## 10. Risks

- **R-1 — The resume cron is a single point of failure.** If it does not run or
  fails, the subscriber stays paused in MercadoPago and loses service indefinitely.
  Worse: a job can report `success` while having failed its work — 77 such runs are
  documented in HOS-918, and `page-revalidation` does it in 24 % of its runs. This
  cron must fail **loudly**, and its failure must be visible in `cron_runs`. HOS-918
  should land before, or at least alongside, this.
- **R-2 — A missing transition is silent.** Invalid transitions return 200 and skip
  the write with no user-visible error (`subscription-logic.ts:799`). Exactly the
  HOS-913 bug. Mitigated by AC-10.
- **R-3 — Ordering between MercadoPago and the local write.** Writing locally first
  and then failing to pause leaves a subscriber marked `courtesy` who is still being
  charged. §6.3 fixes the order; it needs an explicit test.
- **R-4 — One provider state, two local readings.** `paused` in MercadoPago means
  either "paused" or "courtesy" depending on a local column. Any reconciler that
  copies the provider's verdict without the derivation would knock every courtesy
  subscriber out of their gift. HOS-914 must be written knowing this — it now has
  **two** derived states to respect, not one.
- **R-5 — A plan change or cancellation mid-gift.** Resolved by OQ-2: cancelling is
  allowed, everything else is refused by the status gates that already demand
  `active`/`trialing`. No longer open.
- **R-6 — The gift can lose a race against MercadoPago's charge.** Pausing the
  preapproval is what stops the next charge, so a grant issued shortly before the
  due date may land after MP has already begun collecting — and the subscriber pays
  precisely the cycle they were given. Owner decision (2026-08-31): require a lead
  time of a few days (3) and reject the grant otherwise (AC-12). This is a
  guardrail, not a proof: **how far ahead MercadoPago actually commits a charge was
  never measured**, and 3 days is a judgement call. The sandbox experiment that
  validated pause/resume should be extended to measure it.
- **R-7 — The worst possible email at the worst possible moment.** Courtesy pauses
  the preapproval in MercadoPago, and `subscription-paused.tsx` blames the payment
  method (HOS-926). If `deriveCourtesyStatus` does not run — or runs after the
  notification decision — a subscriber who was just given a free month is told their
  card failed. `shouldSendPausedEmail` keys off the *derived* status
  (`subscription-logic.ts:177`), so the ordering in §6.2 is what prevents it. AC-9
  is the regression test; it is not optional.

## 11. Decisions (owner, 2026-08-31)

Four of the five open questions were answered by the owner. **OQ-1 is the only one
still open, and it blocks nothing** — see below for how the implementation avoids
waiting on it.

- **OQ-2 — Cancelling, pausing or changing plan during the gift.** ✅
  **Cancelling is allowed; everything else is blocked.** The block costs no code:
  every other billing gate already demands `active`/`trialing` explicitly, so a new
  status is refused by omission — `subscription-pause.ts:76`, `plan-change.ts:235`,
  `qzpay-admin-hooks.ts:874`. Only cancelling needs a change: adding `courtesy` to
  `SOFT_CANCELLABLE_STATUSES` (`subscription-cancel.service.ts:110`), one line.

  Cancelling is deliberately NOT blocked. A subscriber who is not being charged and
  cannot leave is trapped for no benefit to anyone, and Argentine consumer law
  (Resolución 424/2020) requires unsubscribing to be as easy as subscribing.

- **OQ-3 — Does a downgrade interrupt the gift?** ✅ **The question no longer
  exists.** Plan changes are blocked during a gift (OQ-2), so there is no mid-gift
  downgrade to define behaviour for.

- **OQ-4 — Cycle boundary.** ✅ **From the end of the current period**, not from the
  grant. They already paid for the running cycle. This is what makes granting and
  starting two distinct moments, hence `courtesyStartsAt` (§7) and the three
  notifications (§8).

  The owner added the constraint that produced **R-6**: the grant has to be applied
  in time to stop the upcoming charge. Resolved with a lead-time requirement of 3
  days (AC-12).

- **OQ-5 — Cap on N?** ✅ **No cap for now.** The original concern — that an admin
  gifting 999 cycles is a back-door permanent `comp` without the audit trail — is
  mitigated by the grant being an audited admin action on a named subscription, and
  by `courtesyCyclesGranted` recording exactly what was given.

### OQ-1 — where the three columns live (STILL OPEN)

`billing_subscriptions` is **not defined by Hospeda**: it comes from
`@qazuor/qzpay-drizzle` (`^2.0.0`), consumed from npm with no local override. So
option (a) — typed columns in the external package, the route `product_domain`
(HOS-73) took — requires **publishing a new qzpay release**, and
`pnpm-workspace.yaml:13-45` warns that the five qzpay siblings ship in coordinated
waves rather than one at a time. That is an owner call, not an implementation
detail.

**So the implementation does not wait on it.** The three fields are read and written
exclusively through `courtesy-fields.ts`, a small module with a typed accessor pair.
Every other layer — derivation, transitions, predicates, endpoint, cron,
notifications, UI — is written against that interface and never touches storage
directly. The provisional backing is `metadata` jsonb, which needs no migration and
no package release.

Moving to (a) later changes **that one file**. The cost of the provisional choice is
that the cron's `courtesyEndsAt <= now` sweep reads a jsonb path instead of an
indexed column — irrelevant at the current subscription volume, and the reason this
is provisional rather than final.

## 12. Implementation notes

- **Do not touch `paused`.** Every change is additive: a new enum member, a new
  derivation, new edges in the transition map, one more entry in
  `ENTITLEMENT_GRANTING_STATUSES`.
- The status needs **no DB migration**; the two new fields do (OQ-1).
- `deriveCourtesyStatus` must be pure and unit-testable in isolation, like
  `deriveTrialingStatus`. All the interesting cases are boundary conditions on a
  date.
- Order in the webhook matters: courtesy derives off `PAUSED`, trialing off
  `ACTIVE`, so the two derivations do not compete. Assert this with a test rather
  than relying on it.
- Reuse `billing.subscriptions.pause/resume`. No new MercadoPago plumbing.
- The MP experiment is reproducible: create a preapproval on a **daily** cadence to
  compress a full cycle into 24 h. Beware the sandbox trap documented in
  `docs/migration/mercadopago-sandbox-runbook.md` §3.3-3.4 — a **saved card** breaks
  every subscription checkout, and creating preapprovals via the API leaves the card
  saved, poisoning the next checkout.

## 13. Linear

Canonical tracking:
HOS-180
