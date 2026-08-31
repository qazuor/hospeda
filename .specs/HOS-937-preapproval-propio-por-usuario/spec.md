---
title: Per-user preapproval — replace the shared share link with POST /preapproval
linear: HOS-937
statusSource: linear
created: 2026-08-31
type: fix
areas:
  - api
  - web
  - billing
  - db
---

# Per-user preapproval — replace the shared share link with `POST /preapproval`

## 1. Summary

All four of Hospeda's subscription checkouts — accommodation monthly and annual,
commerce, and partner — currently send the user to MercadoPago's **shared share link**
for a `preapproval_plan`, with the checkout nonce hung off the URL as
`external_reference`. **MercadoPago discards that parameter**: the preapproval is born
with `external_reference: null`, leaving the system with no deterministic signal to tie
the MP object back to the local row. Everything built on top of that gap — ~2.550 lines
of three-tier heuristic correlation plus ~2.178 lines of tests — is the consequence.

This spec replaces that redirect with one to a preapproval **owned by that user**: we
create it ourselves with `POST /preapproval`, the `external_reference` travels in the
**body** (where it does survive), and we send the user to **their own** `init_point`. We
know the `preapproval_id` **before** the redirect, so correlation stops being a problem
instead of being solved better.

It is the same checkout the user sees today: MercadoPago's hosted screen, zero card data
on our side, every payment method (account money included), and guest payment with no
MercadoPago account. The only things that change are who creates the object and where the
reference travels.

## 2. Problem

### 2.1 The proven root cause

`buildPreapprovalPlanShareLink`
(`apps/api/src/services/billing/mp-plan-provisioning.service.ts:557-566`) builds
`https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=<id>&external_reference=<nonce>`.
MercadoPago **discards** the `external_reference`.

Two payments completed in the browser (sandbox, test-buyer session):

| Case | URL sent | Preapproval created | Its `external_reference` |
| -- | -- | -- | -- |
| No session → login → pay | `…&external_reference=PRUEBAFINAL31082026XYZ` | `18a474b99983450c94131d4d8a42168f` | **null** |
| Already logged in → pay | `…&external_reference=YALOGUEADO31082026` | `2ea48a68432e42039f64a69ea4d959b8` | **null** |

The contrast that closes it, two rows from the same plan:

```text
2ea48a68  extref = null                   ← sent in the share-link URL
10d33fc5  extref = optd-plan-1788145070   ← sent in the POST /preapproval BODY
```

**In the URL it is lost. In the body it survives.** Without a session the mechanism is
visible to the naked eye (MP's login redirect strips the query param and the URL comes
back bare), but it is lost when already logged in too.

The code sends it correctly: verified by running the real function, with mutation. If the
nonce arrived empty the parameter would disappear from the URL entirely, not travel as
`null`.

### 2.2 Our own database corroborates it

`billing_pending_checkouts` has a `linked` state, written when correlation resolves by
exact nonce (Tier 2) — the very mechanism the nonce-in-URL was meant to enable.

The status enum carries five values — `pending`, `linked`, `reconcile_assisted`,
`reconcile_ambiguous`, `superseded` (a varchar validated in TS, not a Postgres enum) —
and `linked` sits at zero:

| Environment | Total | `pending` | `reconcile_assisted` | `superseded` | **`linked`** |
| -- | -- | -- | -- | -- | -- |
| staging | 26 | 8 | 16 | 2 | **0** |
| production | 5 | 3 | 2 | 0 | **0** |

**It never fired, in any environment.** The 4 `external_reference` values that do appear
in staging are our own nonces written after the fact (+97 s, +100 s, +2 s, +2 days).

`buildPreapprovalPlanShareLink`'s own docstring admitted it — *«Whether MP actually stamps
it is deferred to a real-MP smoke (HOS-174)»* — and that smoke was never run.

### 2.3 What it costs

`linkPreapprovalToLocalSub` resolves through three descending tiers of certainty
(`apps/api/src/services/billing/link-preapproval.service.ts:198-344`):

- **Tier 1** — ownership-verified: the front-end remembers `localSubscriptionId` in
  `sessionStorage` and posts it back. Depends on the browser completing the round-trip.
- **Tier 2** — exact nonce via `external_reference`. **This is the one that never worked.**
- **Tier 3** — heuristic: `preapproval_plan_id` + `payer_email` inside a time window. With
  exactly 1 candidate it links; with 0 or >1 it refuses to guess, marks each candidate
  `reconcile_ambiguous` and returns `reconcile_assisted` — real money charged that needs
  manual reconciliation (HOS-276, HOS-765).

Staging's 16 `reconcile_assisted` rows are exactly that: Tier 3 refusing to guess because
Tier 2 was never available.

## 3. Goals

- **G-1** — All **four** checkouts that use the share link today (accommodation monthly
  and annual, commerce, partner — §5.3) redirect to the `init_point` of a preapproval we
  created for that user, with our own `external_reference` preserved in the body.
- **G-2** — We know the `mp_subscription_id` **before** the redirect and persist it on the
  local row in the same transaction that creates it.
- **G-3** — The three-tier heuristic correlation is retired entirely:
  `link-preapproval.service.ts`, `pending-provider-subscription-create.ts`, the
  `link-preapproval.ts` route, the `billing_pending_checkouts` model and schema, and their
  tests.
- **G-4** — Double-click idempotency stays standing across all three layers that make it
  up: two untouched and one replaced by something simpler (§6.6).
- **G-5** — Before the redirect the user sees the email they will be able to pay with —
  pre-filled and editable — and that email is stored on `billing_customers` once it works.
- **G-6** — A checkout that is not completed (`pending`) is retried against the **same**
  object. One MercadoPago cancelled over a card rejection (`cancelled`) produces a **new**
  object, because `payer_email` is not mutable.
- **G-7** — The card-rejection cancellation webhook is handled: we know the id, so we find
  out immediately and can offer a fresh attempt.
- **G-8** — The coexistence window drains the in-flight `pending_provider` rows from the
  old path without breaking them.

## 4. Non-goals

- **NG-1** — `qzpay` is not touched. The MercadoPago adapter already builds the body with
  `payer_email` and `external_reference` and returns the `init_point`
  (`packages/mercadopago/src/adapters/subscription.adapter.ts:225-255`).
- **NG-2** — No PCI surface is added. MercadoPago still collects the card on its hosted
  screen; Hospeda never sees card data.
- **NG-3** — The payment front-end (MercadoPago's own screen) is not touched. A screen of
  our own is added **before** the redirect (§8).
- **NG-4** — **Trial reactivation** is not touched
  (`trial.service.ts:1138,1192,1383,1440`): it already uses `createPaidSubscription`,
  which is precisely the path this spec generalizes. The **annual** checkout, by contrast,
  **is in scope** — see §5.3.
- **NG-5** — Pre-existing orphans are not reconciled by hand. Production's
  `f6d89f718c1d4e2287a9aa0e5da209bb` is pending an owner decision; HOS-765 covers the
  manual-linking tool.
- **NG-6** — The `billing_pending_checkouts` table is not dropped in the same release that
  retires its code. See §12.3 (expand/contract).

## 5. Current baseline

### 5.1 Today's path, end to end

`POST /api/v1/protected/billing/subscriptions/start-paid`
(`apps/api/src/routes/billing/start-paid.ts:497-533`, handler `:103-488`) →
`initiatePaidMonthlySubscription`
(`apps/api/src/services/subscription-checkout.service.ts:331-618`):

1. Resolves the plan by slug via `billing.plans.listAll()` (`:339-343`).
2. Resolves the monthly price (`:354-363`) and rejects `unitAmount === 0` (`:372-377`).
3. Resolves the promo code (`:391-399`); the `comp` branch returns here and never touches
   MercadoPago (`:410-433`).
4. Resolves the trial (`:435-483`, one trial per customer for life — HOS-226) and the
   cycle-1 discount (`:489-523`, HOS-244).
5. `resolveCheckoutMpPlanId` (`:537-558`) provisions/caches MP's `preapproval_plan` for the
   exact variant (amount, cadence, trial days).
6. `createPendingProviderSubscription` (`:568-595`) inserts, in **one** transaction: the
   `billing_subscriptions` row as `pending_provider` **without** `mp_subscription_id`, the
   `productDomain` UPDATE, `supersedePendingForCustomerPlan`, the
   `billing_pending_checkouts` row carrying the nonce, and the domain link row when it
   applies (`apps/api/src/services/billing/pending-provider-subscription-create.ts:281,294-332,379-398`).
7. `buildPreapprovalPlanShareLink` (`:605-608`) assembles the share-link URL.

The front-end (`apps/web/src/components/billing/PlanPurchaseButton.client.tsx:902-965`)
stores `localSubscriptionId` in `sessionStorage` and performs `window.location.href`.

On return, `/{lang}/suscriptores/checkout/success/` mounts `CheckoutStatusPoller`, which
calls `POST /billing/subscriptions/link-preapproval` (Tier 1) and then polls with a
~3-minute budget.

### 5.2 What already exists and helps

- **`createPaidSubscription`** (`apps/api/src/services/billing/paid-subscription-create.ts:131-218`)
  already wraps `billing.subscriptions.create({ mode: 'paid', … })` and resolves
  `checkoutUrl = providerInitPoint ?? providerSandboxInitPoint`, with two guards this spec
  inherits: `MISSING_INIT_POINT` and `MISSING_PROVIDER_SUBSCRIPTION_ID` (HOS-151 bug C —
  MP returns 2xx with no id → cancel the local sub and fail loudly). Its 4 live call sites
  are in `trial.service.ts:1138,1192,1383,1440`, all reactivation flows. It is fully
  independent of the machinery being retired and survives untouched.
- **The qzpay adapter** already supports both sub-paths
  (`packages/mercadopago/src/adapters/subscription.adapter.ts:220-268`): plan-based
  (`preapproval_plan_id` in the body, no `auto_recurring`) and inline (`auto_recurring` +
  `free_trial`, no plan). **In both**, the body carries `payer_email` and
  `external_reference`.
- **The comment that must be corrected**: `subscription-checkout.service.ts:525-536` claims
  MercadoPago rejects `POST /preapproval` without a `card_token_id`, and that is the stated
  reason the checkout uses the share link. HOS-937 measured it and **it is false** for a
  preapproval created in `status: pending`: MP returns a usable `init_point` and the user
  authorizes there. That comment is the belief everything else grew out of.

### 5.3 The real scope is FOUR flows, not one

`createPendingProviderSubscription` has **four** call sites, all in the same orchestrator,
`apps/api/src/services/subscription-checkout.service.ts`:

| Line | Flow |
| -- | -- |
| `:568` | accommodation **monthly** |
| `:827` | accommodation **annual** |
| `:1040` | **commerce** |
| `:1367` | **partner** |

The issue talks about the monthly checkout because that is where the root cause was
measured, but all four share the exact same mechanism: `preapproval_plan` + share link +
nonce in the URL. **All four have the same bug and all four migrate.** Leaving any one
behind would force keeping the entire correlation machinery alive for its sake, which is
precisely what this spec retires.

### 5.4 Real volume (measured 2026-08-31)

| | Production | Staging |
| -- | -- | -- |
| `billing_subscriptions` total | 7 | 41 |
| with `mp_subscription_id` | — | 5 |
| `pending_provider` **in flight** | **0** | 0 recent |
| `active` / `trialing` / `comp` | 0 / 2 / 2 | — |
| `billing_pending_checkouts` | 5 | 26 |

The migration breaks no live subscription: `billing_subscriptions` has no column that
distinguishes the creation mechanism, and once `active`/`trialing` the system treats them
identically. Production's 2 `trialing` rows are charged through their MercadoPago
preapproval, which does not depend on the share link.

## 6. Proposed design

### 6.1 The new flow

Steps 1 through 5 of §5.1 are **unchanged**. Steps 6 and 7 change:

```text
6'. createOwnPreapprovalSubscription (replaces createPendingProviderSubscription)
    a. Resolve payerEmail (§6.3) and validate it.
    b. POST /preapproval via billing.subscriptions.create({ mode:'paid', … }):
         payer_email        ← the resolved email                (BINDING)
         external_reference ← the localSubscriptionId            (survives in the body)
         preapproval_plan_id← the mpPreapprovalPlanId from (5)   (§6.2)
         back_url           ← buildPaymentMethodReturnUrl(locale)   NO query params
         notification_url   ← buildNotificationUrl()
    c. MP responds { id, init_point, status: 'pending' }.
    d. In ONE transaction: INSERT billing_subscriptions with mp_subscription_id ALREADY
       set, UPDATE productDomain, domain link row when it applies.
       (No billing_pending_checkouts row, no nonce, no supersede.)
7'. checkoutUrl = the init_point of our own preapproval.
```

`external_reference` becomes the `localSubscriptionId` — a UUID that already exists and is
already unique — instead of a dedicated nonce. A second identifier is unnecessary: the
nonce existed so the local id would not be exposed in a public URL, and the reference now
travels in the body of a server-to-server call.

### 6.2 Plan-based, not inline — and why it matters

The adapter offers both paths. **Use plan-based** (`preapproval_plan_id` in the body, no
`auto_recurring`), for three reasons:

1. It preserves HOS-191's mechanism: the trial is baked into the `preapproval_plan`, which
   is the shape MercadoPago actually authorizes card-first.
2. It preserves MercadoPago's own backstop against trial-hopping (one trial per payer +
   plan). The inline path **has no such rule** and grants unlimited trials to the same
   payer.
3. It reuses `resolveCheckoutMpPlanId` and its `billing_mp_plans` cache unchanged.

The associated risk, with its detection, is in §10 (R-2).

### 6.3 The payer's email

`payer_email` is **binding**: only whoever uses or types that exact email can pay. Today
anyone can pay with any account. Measured with a control across all four cells (logged
in/guest × matching/different email). MercadoPago **never shows the user which email it
expects** and tells them to *«contact the seller»*.

Resolution order:

1. `billing_customers.mp_payer_email` when set (§7.4) — the last email that actually worked
   for that customer.
2. `billing_customers.email` (the signup address).
3. Whatever the user typed on the pre-redirect screen (§8.1), which wins over both.

The chosen value is persisted to `billing_customers.mp_payer_email` **only once the
preapproval reaches `authorized`**, never at creation time. An email that did not work is
not stored.

`sanitizeEmailForMercadoPago` (`apps/api/src/utils/mp-email.ts:75-87`) is **NOT applied
here**. See §11 (OQ-1): its own docblock documents that it produces a dead mailbox, and the
email is now binding and must be something the user can type.

### 6.4 The two recoveries

On return from checkout, `GET` the preapproval by its id — a deterministic signal, not a
heuristic. `authorized` is the happy path; the other two are different and cannot be
treated alike:

| Status read | What happened | Recovery |
| -- | -- | -- |
| `pending` | Not completed, or failed on the email | **Same object**: send them back to its `init_point`, with the expected email visible and editable. |
| `cancelled` | MP cancelled over a card rejection | **New object**: `payer_email` is not mutable (the `PUT` is ignored), so there is no way to retry on the same one. |

Every read of a cancellation is confirmed with a **deferred `GET`**, never an immediate
one. See §10 (R-3).

### 6.5 The cancellation webhook

MercadoPago does send a webhook when it cancels over a card rejection — verified in the
staging logs, within a second of the rejection. Because the id is ours from before the
redirect, the local row is found by `mp_subscription_id` on the primary path
(`subscription-logic.ts:496-508`) and no fallback is needed.

On receiving `cancelled` for a row that never reached `authorized`:

1. Move the local row to its corresponding terminal state.
2. Mint the fresh attempt (a new preapproval, per §6.4) and notify the user with the link,
   instead of leaving them in the infinite loop of §10 (R-1).

### 6.6 Idempotency: three mechanisms, not one

MercadoPago **ignores** `X-Idempotency-Key` (measured). qzpay sends it anyway
(`subscription.adapter.ts:107`), but it is decorative. The defense is entirely ours — and
it is **three** distinct layers with three distinct fates:

**(A) The `/start-paid` idempotency header — SURVIVES UNTOUCHED.**
`idempotencyKeyMiddleware({ operation: 'hospeda.start_paid' })`
(`apps/api/src/routes/billing/start-paid.ts:529`, SPEC-143 T-143-60) requires
`X-Idempotency-Key` and backs the response with qzpay-drizzle's
**`billing_idempotency_keys`** table (`apps/api/src/middlewares/idempotency-key.ts:29`).
Same key + same body → cached response; only 2xx responses are cached. **It never touches
`billing_pending_checkouts`.** It covers accommodation monthly and annual, both of which
enter through that route. This is the idempotency the issue says survives, and it does.

**(B) The commerce/partner share-link reuse — BREAKS, and gets replaced.**
`resolveReusableCommerceCheckout` / `resolveReusablePartnerCheckout`
(`apps/api/src/services/billing/checkout-idempotency.ts`, called from
`subscription-checkout.service.ts:808,1022`) read `billing_pending_checkouts` with a raw
`SELECT` (`:142-161`), and `decideCheckoutReuse` (`checkout-reuse-decision.ts:116-181`)
requires eight conditions before rebuilding the same MercadoPago URL byte for byte. **It is
built entirely on the table being retired.**

The replacement is simpler than what it replaces: in the new flow a `pending_provider` row
**always** carries `mp_subscription_id`, so "is there already a checkout in flight for this
customer + plan?" is answered by reading `billing_subscriptions` and returning the
`init_point` of the preapproval that already exists. It is the same object, not a
rebuilt URL — which is exactly the `pending` recovery of §6.4. The correlation table stops
being needed for this too.

**(C) The partial unique index — SURVIVES, but its handling must be preserved.**
`billing_subscriptions_mp_id_uniq`
(`packages/db/src/migrations/extras/031-billing-subscriptions-mp-id-unique.index.sql`) is a
`UNIQUE INDEX … ON billing_subscriptions (mp_subscription_id) WHERE mp_subscription_id IS
NOT NULL`. It lives on `billing_subscriptions`, **not** on the table being retired, so the
index itself stands.

What does not stand on its own is the code that catches its violation: the compare-and-set
with a SQLSTATE `23505` → `'already'` catch lives in `link-preapproval.service.ts:1102-1151`,
inside the file being deleted. **That logic must be preserved**, or a lost race goes from
resolving cleanly to blowing up with a raw Postgres error. And when rewriting it, the
SQLSTATE predicate must **walk the `cause` chain**: Drizzle wraps every query failure and
does not copy `code` onto the outer error.

In the new flow (C) gains importance rather than losing it: it is the only thing preventing
two local rows from carrying the same `mp_subscription_id`.

**What disappears with no replacement** is `supersedePendingForCustomerPlan` (HOS-276),
which existed to retire rival rows for the same customer+plan when heuristic correlation
could confuse them. With no correlation there are no rival rows to confuse.

## 7. Data model / contracts

### 7.1 Retired

Counts are real `wc -l` figures taken on 2026-08-31 against `origin/staging`:

| File | Lines |
| -- | -- |
| `apps/api/src/services/billing/link-preapproval.service.ts` | 1210 |
| `apps/api/src/services/billing/pending-provider-subscription-create.ts` | 412 |
| `apps/api/src/routes/billing/link-preapproval.ts` | 191 |
| `packages/db/src/models/billing/billing-pending-checkout.model.ts` | 527 |
| `packages/db/src/schemas/billing/billing_pending_checkout.dbschema.ts` | 147 |
| `packages/schemas/src/api/billing/link-preapproval.schema.ts` | 63 |
| **Source subtotal** | **2550** |
| `apps/api/test/services/billing/link-preapproval.service.test.ts` | 1203 |
| `apps/api/test/services/billing/pending-provider-subscription-create.test.ts` | 409 |
| `apps/api/test/routes/billing/link-preapproval-routing.test.ts` | 265 |
| `apps/api/test/routes/billing/link-preapproval.test.ts` | 191 |
| `packages/db/test/models/billing/billing-pending-checkout.status-guard.test.ts` | 110 |
| **Test subtotal** | **2178** |
| **Total** | **4728** |

The counts carried in the issue (1,195 / 374 / 368+135 / 191) come from an earlier
measurement and are superseded by these.

### 7.2 Survives but must be rewritten — the full inventory

Deleting §7.1's files without touching this list leaves the repo not compiling. None of
these files are on the deletion list, and every one of them calls or depends on something
that is:

| File | What it depends on |
| -- | -- |
| `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts:516` | F3 fallback of the `subscription_preapproval` webhook |
| `apps/api/src/routes/webhooks/mercadopago/subscription-payment-handler.ts:1002` | same fallback for `subscription_authorized_payment` |
| `apps/api/src/cron/jobs/webhook-retry.job.ts:306` | same fallback when reprocessing the dead-letter queue |
| `apps/api/src/cron/jobs/abandoned-pending-subs.job.ts:238,259` | `findByLocalSubscriptionId` / `findUnlinkedChargeByLocalSubscriptionId` (branches `:224-265`) |
| `apps/api/src/services/subscription-checkout.service.ts:568,827,1040,1367` | the 4 call sites of §5.3 |
| `apps/api/src/services/billing/checkout-idempotency.ts` + `checkout-reuse-decision.ts` | §6.6 (B) |
| `apps/api/src/routes/billing/index.ts:40,183,286` | import + mount of `linkPreapprovalRouter` |
| `packages/seed/src/data-migrations/helpers/billingCleanupGuards.ts:28,82,208,264-270` | HOS-749 production cleanup guard |
| `apps/web/src/lib/api/endpoints-protected.ts:933-944` | the client's `linkPreapproval()` method |
| `apps/web/src/components/billing/CheckoutStatusPoller.client.tsx:38,251` | calls the route before polling |
| `apps/web/src/components/billing/strip-checkout-return-params.snippet.ts` | strips `?preapproval_id=` |
| `apps/web/src/pages/[lang]/suscriptores/checkout/success.astro:27,86` | the return page |

The three webhook fallbacks (the first three rows) are the same pattern repeated: "I could
not find the row by `mp_subscription_id`, let's try correlating." In the new flow that case
**cannot occur for a checkout of ours**, because the id is persisted before the redirect.
The right move is to replace the call with structured logging: a preapproval that matches
no local row becomes an anomaly to report, not a normal case to guess at.

Barrels that each lose one line: `packages/db/src/schemas/billing/index.ts:6`,
`packages/db/src/models/billing/index.ts:1`,
`packages/schemas/src/api/billing/index.ts:13`.

### 7.3 Guards and tests that break

- **`apps/api/test/services/inv1-cache-invalidation.guard.test.ts`** — the
  `BILLING_SUBSCRIPTIONS_WRITERS` registry has one entry for `link-preapproval.service.ts`
  and another for `pending-provider-subscription-create.ts`. The test *«every registry entry
  still corresponds to a discovered writer (no stale entries)»* (`:531`) fails if the files
  are deleted without removing both entries **in the same change**.
- **`apps/api/test/middlewares/endpoint-gate-matrix.guard.test.ts`** — runs `existsSync`
  over the `file` column of every row in `docs/billing/endpoint-gate-matrix.md`. The
  `link-preapproval` row (doc `:237`) must be removed.
- **`apps/api/test/routes/billing/link-preapproval-routing.test.ts`** — a **mount-order**
  regression guard (`routes/billing/index.ts:168-182` names it explicitly: the router must
  mount before `cancelWrapper`/`qzpayWrapper`, because those wrappers'
  `billingAdminGuardMiddleware` runs for anything under `/subscriptions`). Deleted along
  with the route.
- **Nine test files** that mock `createPendingProviderSubscription` and are not on the
  deletion list: `checkout-idempotency-by-entity.test.ts`,
  `commerce/start-subscription.service.test.ts`, `subscription-checkout.service.test.ts`,
  `subscription-checkout-annual-wiring.test.ts`,
  `subscription-checkout-test-daily-plan.test.ts`,
  `subscription-checkout-promo-branches.test.ts`,
  `partners/start-subscription.service.test.ts`, `start-paid-plan-disabled.test.ts`,
  `routes/start-paid.test.ts`.
- **Four test files** that mock `linkPreapprovalToLocalSub` to exercise the surviving
  fallbacks: `webhooks/subscription-logic.test.ts`,
  `webhooks/subscription-payment-handler.test.ts`, `cron/webhook-retry.job.test.ts`,
  `routes/billing/collection-listing-exposure.test.ts`.
- **`apps/web/test/components/billing/CheckoutStatusPoller.test.tsx`** — describes
  *«HOS-191 Path C — link-preapproval before polling»*.
- **Docs**: `docs/billing/endpoint-gate-matrix.md:237` (mandatory — a guard verifies it) and
  `docs/billing/hos-749-prod-billing-cleanup-runbook.md:352` (an audit query counting the
  table). No `CLAUDE.md` at any level mentions this machinery.

**`apps/admin` has zero references**, and `packages/service-core` has no inbound
dependency — the coupling runs inward only.

### 7.4 Added

**`billing_customers.mp_payer_email`** (varchar, nullable) — the last payer email
MercadoPago accepted for that customer. Distinct from `email`, which is the real address
Hospeda writes to and which is **not overwritten** (HOS-581: eight of our own sends read
that column).

`billing_customers` is owned by `@qazuor/qzpay-drizzle`
(`packages/db/src/billing/schemas.ts:14` re-exports the whole package), so the column goes
through the extras lane (`packages/db/src/migrations/extras/`), idempotent, following the
precedent of `036-billing-customers-external-id-unique.index.sql`.

### 7.5 Contracts that change

- **`POST /billing/subscriptions/start-paid`** — the response gains
  `mpSubscriptionId: string` (we know it before the redirect) and `payerEmail: string` (so
  the pre-redirect screen can show it). `checkoutUrl`, `localSubscriptionId`, `expiresAt`,
  `appliedEffect`, `trialGranted` and `promoCodeIgnored` are unchanged.
- **`POST /billing/subscriptions/link-preapproval`** — **removed**. Nothing replaces it:
  there is nothing left to link.
- **A retry endpoint** (name to be settled during implementation) implementing §6.4: it
  reads the preapproval by id and returns the `init_point` of the same object (`pending`)
  or of a fresh one (`cancelled`).

### 7.6 States that change meaning

`pending_provider` stops meaning "we are waiting for the browser to tell us which
MercadoPago object it got" and comes to mean "the preapproval exists and is `pending`; the
user has yet to authorize it". Same label, far stronger guarantee behind it: the row
**always** has `mp_subscription_id`.

Direct consequence for the `abandoned-pending-subs` cron
(`apps/api/src/cron/jobs/abandoned-pending-subs.job.ts:144-329`): the "no
`mp_subscription_id`" branch (`checkout-in-progress`, `reconcile-assisted-manual`) stops
receiving new rows. It is kept for the duration of the coexistence window (§12.4) and
retired afterwards.

## 8. UX / UI behavior

### 8.1 The pre-redirect screen

Zero new fields for anyone whose email matches. Before sending the user to MercadoPago we
show the email they will be able to pay with: **pre-filled and editable**. If it is theirs,
one click and they carry on. If they intend to pay with a different MercadoPago account,
they type it there — which is exactly the information MercadoPago never gives them and the
reason they end up reading *«contact the seller»*.

The copy must say what it means, not just what it is: this is the email they will be able
to pay with, not a contact address.

### 8.2 The return

`/{lang}/suscriptores/checkout/success/` still exists, still reads `preapproval_id` from
the query, and still strips it with `StripCheckoutReturnParams` (HOS-209). What changes is
that polling starts already knowing which object to look at, and the preapproval `GET`
answers on the first pass instead of after ~3 minutes of backoff.

### 8.3 The card rejection

Today the user ends up in an infinite loop: MercadoPago cancels the preapproval but keeps
offering *«Pay with another method»* — a button that can never work, because
`cancelled → authorized` is a forbidden transition. It produces no orphans (verified: no
new object and no payment are created), but it loses the user.

With the webhook of §6.5 we find out within a second, mint the fresh attempt and send them
the link. The user does not have to discover on their own that the button in front of them
is dead.

## 9. Acceptance criteria

- **AC-1** — Each of the four checkouts in §5.3 redirects to an `init_point` whose
  preapproval has `external_reference === localSubscriptionId`. Verified with a `GET`
  against the real API, not against the stub.
- **AC-2** — The `billing_subscriptions` row created by checkout has a non-null
  `mp_subscription_id` **before** the user is redirected.
- **AC-3** — A payment completed in the sandbox activates the subscription through the
  primary path (`findLocalSubscriptionByMpId`), touching no correlation fallback.
- **AC-4** — Checkout retains every payment method, account money included, and allows
  paying with no MercadoPago account (`Sin cuenta de Mercado Pago → Tarjeta`).
- **AC-5** — The trial is honored: `next_payment_date - date_created ≈ the plan's trial
  days`. Asserted on `next_payment_date`, **never** on `free_trial` or
  `first_invoice_offset` (§10, R-2).
- **AC-6** — A double click on the purchase button creates **one** preapproval, not two.
  Holds for all four flows, not only the two that go through `/start-paid`.
- **AC-6b** — A race that tries to write the same `mp_subscription_id` onto two local rows
  resolves cleanly (`'already'`), not with a raw Postgres error. The test must trigger a
  real violation of the `billing_subscriptions_mp_id_uniq` index, and the SQLSTATE predicate
  must be exercised against an error **wrapped by Drizzle** (the `cause` chain), not
  against a bare `pg` error.
- **AC-7** — An abandoned checkout (`pending`) is retried on the same
  `mp_subscription_id`: the retry creates no new object at MercadoPago.
- **AC-8** — A checkout cancelled over a card rejection (`cancelled`) mints a **new**
  preapproval, and the user receives the link to the fresh attempt.
- **AC-9** — The email that worked ends up in `billing_customers.mp_payer_email`, and
  `billing_customers.email` is **not modified**.
- **AC-10** — No `back_url` carries query params of our own. Enforced by a static guard
  (§10, R-1).
- **AC-11** — After the retirement, `rg` finds no live references to
  `linkPreapprovalToLocalSub`, `createPendingProviderSubscription`,
  `buildPreapprovalPlanShareLink` or `billingPendingCheckoutModel` outside the tests being
  deleted.
- **AC-11b** — The three guards in §7.3 pass **in the same commit** that deletes the files:
  `BILLING_SUBSCRIPTIONS_WRITERS` with no stale entries, the gate matrix without the
  `link-preapproval` row, and `routes/billing/index.ts` compiling without the router's
  import and mount. Run locally before opening the PR — CI is not where to find this out.
- **AC-12** — Coverage ≥ 90 % across every new or modified module.
- **AC-13** — In-flight `pending_provider` rows from the old path drain without hanging and
  without being abandoned prematurely (§12.4).

## 10. Risks

The issue's five landmines, all measured, plus two that surfaced while writing this spec.

- **R-1 — No query params in the `back_url`.** MercadoPago concatenates its own with `?`
  instead of `&`, and `preapproval_id` stops parsing. It does not fire today because the
  `back_url`s are clean (`checkout-return-urls.ts:103-105`), and that cleanliness is
  accidental, not defended. **Mitigation**: a static guard that fails if a constructed
  `back_url` contains `?` or `&`. Anchor the guard on the unavoidable token (the URL
  construction), not on a function name.
- **R-2 — The trial MercadoPago reports and will not honor.** A second subscription by the
  same payer to the same `preapproval_plan_id` gets no trial (MP's rule), yet the API
  response is byte-for-byte identical to one that does: `free_trial` and
  `first_invoice_offset` fully populated. The only field that betrays the immediate charge
  is `next_payment_date`, equal to `date_created`. **Mitigation**: derive the local trial
  from `next_payment_date - date_created`, never from `free_trial`. Same problem as HOS-936
  and it must be solved in the same direction.
- **R-3 — Confirm every cancellation with a deferred `GET`, not an immediate one.** Six
  preapprovals reported `cancelled` (on the `PUT` and on an immediate `GET`) and hours later
  read `authorized`/`pending`. **Mitigation**: no irreversible decision is taken on an
  immediate cancellation read.
- **R-4 — Match the public key's `live_mode` to the access token's.** Otherwise MP returns
  `404 Card token service not found`, which reads as a broken integration. **Mitigation**: a
  bootstrap check, with the same fail-loud stance `createBillingAdapter` already applies to
  `livemode` (`packages/db/src/billing/drizzle-adapter.ts:116-122`).
- **R-5 — MercadoPago's unpublished rate limit.** A sweep of ~60 consecutive `GET`s returns
  `429` on several; at 0.35 s between calls, zero failures. **Mitigation**: spacing in every
  loop that queries MP (crons, reconciliations, verification scripts).
- **R-6 — Choosing the inline path would forfeit MercadoPago's trial-hopping backstop.**
  That is why §6.2 picks plan-based. Even so, our own backstop (`hasAnyPriorSubscription`,
  one trial per customer for life, HOS-226) keys on `customerId` while MercadoPago's keys on
  the payer email: two Hospeda accounts sharing one MP payer defeat ours and are stopped by
  MP today. With `mp_payer_email` persisted (§7.4) that backstop becomes buildable locally.
  **Not blocking for this spec**; recorded so the thread is not lost.
- **R-7 — The local qzpay source is one patch behind.** What was read is
  `@qazuor/qzpay-mercadopago` 2.9.1; the lockfile installs 2.9.2. The body shape is
  long-standing, but confirming it against 2.9.2 is part of the implementation, not an
  assumption.

## 11. Open questions

- **OQ-1 — What to do about emails containing «+». PRODUCT DECISION, PENDING.**

  MercadoPago rejects them with `User bad request`, with no field name and no code.
  Isolated with a negative control: **it is the character, not the Gmail alias**. It did not
  matter until now because `payer_email` was never sent; with this spec it becomes binding.

  The repo already has a function for this and **it does not work here**:
  `sanitizeEmailForMercadoPago` (`apps/api/src/utils/mp-email.ts:75-87`) replaces `+` with
  `.` in the local part. Its own docblock (H-95) documents that the result is very likely a
  **dead mailbox**: Gmail ignores dots, so `user.tag@gmail.com` collapses to
  `usertag@gmail.com`, which is not `user@gmail.com`. That value must never escape its
  boundary or be shown to the user — and the email is now precisely what we must show them
  and what they must be able to type.

  Three real options:

  1. **Ask for an alternative email when theirs contains «+»** — on the pre-redirect screen
     of §8.1, which exists anyway. Guesses nothing, invents no identity, and the user sees
     and controls exactly what they will type at MercadoPago. **Recommended.** It costs one
     more case on a screen that has to be built regardless.
  2. **Normalize `local+tag@domain → local@domain`** — reaches the same inbox on Gmail; on
     other providers it is **a different identity**, and the user sees an address they never
     wrote.
  3. **Reuse `sanitizeEmailForMercadoPago`** — ruled out, per the above.

  Until a decision lands, the implementation leaves the extension point with an explicit
  `TODO` referencing this OQ and proceeds with everything else. **Corollary**: HOS-937
  answers half of the doubt the docblock leaves open (*«STILL UNVERIFIED: whether Checkout
  Pro rejects '+' at all»*) — for `/preapproval` it is verified that it **does** reject.

- **OQ-2 — What to do with production orphan
  `f6d89f718c1d4e2287a9aa0e5da209bb`.** Pending an owner decision; out of scope here
  (NG-5). HOS-765 covers the tooling.

- **OQ-3 — Whether `pending_provider` should be renamed.** Its meaning changes (§7.6).
  Renaming touches an enum with live production rows; probably not worth it, but the
  decision is better taken explicitly than by omission.

## 12. Implementation notes

### 12.1 Precondition: the day-N canaries

Authorizing a card and being able to charge it thirty days later are not the same thing,
and that holds for any integration path. State as of 2026-08-31 09:20 UTC:

| Canary | Status | `next_payment_date` | Charged |
| -- | -- | -- | -- |
| `c14da047d71e44248fdb2f91fe0bf7ab` | `authorized` | 2026-08-31 23:01 (-04) | `charged_quantity: null` |
| `48545a137c8a45a48ae5cf80ba6d4b02` | `authorized` | 2026-08-31 23:29 (-04) | `charged_quantity: null` |

Both healthy, both with their `external_reference` intact (`optd-canario-…`,
`canario2-…`) — further corroboration of §2.1. **The day-N charge has not happened yet**:
it falls tonight. The precondition is **pending, not failed**. It does not block writing
this spec; it **is** a gate on implementation. If the charge does not go through, the whole
premise changes and work must stop.

### 12.2 Order of work

1. Create our own preapproval and persist `mp_subscription_id` in the same transaction,
   **starting with accommodation monthly**. The old path stays alive behind a flag until
   this one passes the smoke.
2. The pre-redirect screen with the pre-filled email (§8.1) and persisting
   `mp_payer_email` on authorization.
3. The two recoveries (§6.4) and the cancellation webhook (§6.5).
4. Extend to the other three flows (annual, commerce, partner), including the §6.6 (B)
   replacement for commerce/partner.
5. The `back_url` guard (R-1) and call spacing (R-5).
6. Preserve the SQLSTATE 23505 handling outside the file being deleted (§6.6 (C)).
7. The retirement, across two releases (§12.3).

Steps 1-3 are one PR and 4-6 can be another; step 7 is necessarily a third, because the
retirement cannot land before all four flows have passed the smoke. Only the PR completing
step 7 carries `Closes HOS-937` in its description.

### 12.3 The retirement spans two releases (expand/contract)

A `DROP` breaks the code that is **already running**: Drizzle projects an explicit column
list, and removing the source in the same release that stops using it is exactly the
mistake HOS-433 measured in production. The repo's rule is expand/contract, and it applies
identically to a whole table:

- **Release N** — the new code stops writing and reading `billing_pending_checkouts`. The
  §7.1 files are deleted and §7.2 is rewritten. **The table stands, empty and with no
  readers.** The one remaining reader is the production cleanup guard
  `billingCleanupGuards.ts` (HOS-749), retired in this same release: if the table receives
  no new rows, no `pending` checkout can block a soft-delete.
- **Release N+1** — the table is dropped through the structural lane
  (`packages/db/src/migrations/`, `pnpm db:generate` + `pnpm db:migrate`). It was created in
  `0062_clammy_jigsaw.sql`, with `pending_trial_extension` added in
  `0063_small_archangel.sql`; it has nothing in the extras lane and no seed rows touching it
  (it is an operational table, not a catalogue one).

The audit query in `docs/billing/hos-749-prod-billing-cleanup-runbook.md:352`, which counts
the table, is cleaned up in that same release N+1.

### 12.4 The coexistence window

Production has **zero** in-flight `pending_provider` rows (§5.4), so the window is close to
theoretical there. The mechanism still has to exist, because staging does generate them and
because the deploy is not atomic.

Old rows are unambiguously distinguishable: **`pending_provider` with no
`mp_subscription_id`**. New ones always have it. During the window:

- The 3-hour TTL (`PENDING_CHECKOUT_TTL_MS`,
  `pending-provider-subscription-create.ts:67`) and the hourly `abandoned-pending-subs` cron
  (`0 * * * *`, `abandoned-pending-subs.job.ts:338`) are kept as-is for those rows.
- Three hours after the last deploy of the old path, none can remain: either it linked, or
  the cron marked it `abandoned` and cancelled its MercadoPago preapproval.
- Only then is the cron's "no `mp_subscription_id`" branch retired.

There is a duplicated constant worth not carrying forward: `PENDING_PROVIDER_TTL_MS`
(30 min) is declared separately, without either importing the other, in
`subscription-checkout.service.ts:71` and `abandoned-pending-subs.job.ts:82`. If the
retirement touches one, it must touch the other.

### 12.5 How to verify without fooling ourselves

- Anything asserted against MercadoPago is asserted with an **individual `GET`**, never with
  `search` — `search` omits fields (`payer_email`, `next_payment_date` and `free_trial` all
  came back empty while verifying the canaries) and that reads as "the field is not set".
- The e2e suite uses a MercadoPago stub and **cannot** detect a divergence from real MP. The
  gate is the staging smoke against the real sandbox.
- A `PUT` returning 200 proves nothing: `free_trial` and `start_date` are immutable and MP
  answers 200 while changing nothing. The signal is `last_modified`.

### 12.6 Smoke

This is billing **CORE** (it touches preapproval creation, the webhook and the cron). The
issue carries `status-needs-smoke-staging` **and** `status-needs-smoke-prod`, and the two
cover different things: staging covers the MercadoPago sandbox, production covers the real
charge and the cron's real timing. Neither satisfies the other.

Applicable sections of
[`staging-smoke-checklist.md`](../../.qtm/specs/SPEC-143-billing-testing-coverage/docs/staging-smoke-checklist.md)
and
[`prod-smoke-checklist.md`](../../.qtm/specs/SPEC-143-billing-testing-coverage/docs/prod-smoke-checklist.md):
the checkout, webhook and cron ones.

## 13. Linear

Canonical tracking:
HOS-937

Related: HOS-276 (the symptom this spec attacks at the root), HOS-936 (deriving the trial
from `next_payment_date`, same mechanism as R-2), HOS-191 (the `preapproval_plan` migration
that introduced the share link), HOS-209 (the nonce-in-URL that never worked), HOS-174 (the
smoke that was never run and would have caught this), HOS-765 (manual linking of an orphan).
