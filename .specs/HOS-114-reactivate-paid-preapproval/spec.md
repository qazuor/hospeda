---
linear: HOS-114
statusSource: linear
title: Route paid reactivation through the card-collecting checkout (real MP preapproval)
created: 2026-07-09
type: fix
area: [billing, api]
---

# HOS-114 — Route paid reactivation through the card-collecting checkout

## 1. Summary

The two "reactivate" service methods create a subscription **without** a real
MercadoPago preapproval, leaving the customer with a locally-`active`
subscription that has no card on file and no recurring-billing mechanism behind
it (a "phantom-active" sub, same class as HOS-108). Fix: reactivation to a
**paid** plan must go through the same card-collecting checkout contract as
`/start-paid` — `mode:'paid'` + `priceId` + `paymentMethodReturnUrl`, redirect
to MercadoPago, fail-closed if no checkout URL, and cancel the old subscription
only **after** the new preapproval is confirmed.

## 2. Problem

`TrialService.reactivateFromTrial` (`apps/api/src/services/trial.service.ts:840-847`)
and `TrialService.reactivateSubscription` (`:1031-1039`) — the methods behind
`POST /billing/trial/reactivate` and `POST /billing/trial/reactivate-subscription`
— both call:

```ts
this.billing.subscriptions.create({ customerId, planId, metadata });
```

with **no** `mode`, **no** `priceId`, **no** `paymentMethodReturnUrl`. Neither
method inspects the returned subscription for a `providerInitPoint` / checkout
URL, and neither throws when one is absent — they treat `.id` as success, then
proceed to cancel the old subscription(s), write audit rows, and clear the
entitlement cache **as if reactivation fully succeeded**.

**Root cause (confirmed against the compiled external package)**:

- `@qazuor/qzpay-core@1.12.0` documents `mode?: 'trial' | 'paid'` with `'trial'`
  as the **default** — "storage-only record, no provider call"
  (`node_modules/.pnpm/@qazuor+qzpay-core@1.12.0/.../dist/index.d.ts:1033-1043`).
- The runtime gate is the only branch that creates a real MP preapproval:
  `if (input.mode === "paid" && paymentAdapter?.subscriptions) { ... }`
  (`.../qzpay-core/dist/index.js:2644`). With `mode` omitted the payment adapter
  is **never** called — no MP request, no preapproval, no `initPoint`.
- The storage adapter `@qazuor/qzpay-drizzle@1.11.0` computes
  `initialStatus = input.mode === "paid" ? "incomplete" : hasTrial ? "trialing" : "active"`
  (`.../qzpay-drizzle/dist/index.js:6237`). For the reactivate call shape
  (no `mode`, no `trialDays`) `hasTrial` is `false`, so the row is written
  **`active`** immediately.

Net effect: the customer looks fully `active` in the DB but has no card, no
`providerSubscriptionIds.mercadopago`, and is never routed to authorize
recurring billing. **Not a stub artifact**: the real `createMercadoPagoAdapter`
runs in prod/staging (`apps/api/src/middlewares/billing.ts:134-136`) and the gate
lives inside qzpay-core upstream of whichever adapter is wired, so the bug
reproduces identically in production.

## 3. Goals

- **G-1** Reactivation to a **paid** plan produces a real MercadoPago preapproval
  and redirects the user to authorize recurring billing, exactly like
  `/start-paid`.
- **G-2** Fail closed: if the provider returns no checkout URL, the reactivation
  errors (mirror `MISSING_INIT_POINT`) instead of silently leaving a
  card-less subscription.
- **G-3** The old subscription is cancelled/superseded **only after** the new
  preapproval is confirmed, so an abandoned checkout never leaves the user with
  no subscription at all.
- **G-4** Any phantom-active subscriptions already created by the buggy path in
  staging/prod are identified (§12 query) and remediated if present — expected
  zero, since the endpoints are currently unwired (§11 OQ-4).

## 4. Non-goals

- **NG-1** Changing the **no-card trial** semantics (owned by HOS-110). Granting
  or extending a trial is out of scope; this spec is strictly about the *paid*
  reactivation path.
- **NG-2** Changing the webhook activation logic itself (HOS-108). This spec
  reuses the existing confirmation path; it does not redesign it.
- **NG-3** New UI surfaces. The web reactivation buttons already exist; only their
  resulting behavior (redirect to MP) changes.
- **NG-4** **Annual** (one-time) reactivation. Out of scope — annual uses a
  structurally different checkout path and is rejected here (§6.1); it is deferred
  to **HOS-123**.

## 5. Current baseline

- **Bug sites**: `apps/api/src/services/trial.service.ts`
  - `reactivateFromTrial` — create at `:840-847`, return used only as `.id` at
    `:853`, `:955`, `:961`; cancels old sub + audits + `clearEntitlementCache`
    inline.
  - `reactivateSubscription` — create at `:1031-1039`, `.id` used at `:1045`,
    `:1114`, `:1122`; same inline cancel/audit/cache pattern.
- **Correct pattern to mirror**: `initiatePaidMonthlySubscription`
  (`apps/api/src/services/subscription-checkout.service.ts:654-680`) —
  `mode:'paid'` + `priceId` + `paymentMethodReturnUrl` + `notificationUrl`, then
  `checkoutUrl = subscription.providerInitPoint ?? subscription.providerSandboxInitPoint`
  and `throw new SubscriptionCheckoutError('MISSING_INIT_POINT', ...)` if absent.
- **Adapter wiring**: `apps/api/src/middlewares/billing.ts:134-136` — real MP
  adapter unless `HOSPEDA_QZPAY_TEST_CONTROL_ENABLED` (`isTestControlEnabled()`).
- **Routes**: `POST /billing/trial/reactivate`,
  `POST /billing/trial/reactivate-subscription` (web-called; confirm exact route
  files during implementation).
- **Return contract today**: both endpoints return the new subscription id and a
  success shape with no `checkoutUrl`, so the web currently assumes reactivation
  is synchronous/complete.

## 6. Proposed design

### 6.1 Plan resolution + validation guard (DECIDED — OQ-2 / OQ-5)

Both endpoints today accept a fully user-supplied, **unvalidated** `planId`
string (`apps/api/src/routes/billing/trial.ts:83-85` and `:458-460`) — no catalog
check, no interval check, no paid-plan restriction. The fix adds a server-side
guard as the first step of both reactivate methods:

1. Resolve `planId` against the plan catalog (`packages/billing/src/config/plans.config.ts`).
   If it is unknown → throw (fail-closed).
2. If it is a **free** plan (`monthlyPriceArs === 0`, e.g. `TOURIST_FREE_PLAN`) →
   **reject** (`INVALID_REACTIVATION_PLAN`). Reactivation is only meaningful onto a
   paid accommodation plan; the previous "free branch" is dropped as a real path
   (there is no live caller for it, and trials are HOST-only paid plans). This
   removes the accidental phantom-`active`-on-a-free-plan path entirely.
3. If it is an **annual** plan → **reject** (`ANNUAL_REACTIVATION_UNSUPPORTED`).
   Annual is architecturally incompatible with `billing.subscriptions.create()`
   (see OQ-5 below); annual reactivation is deferred to **HOS-123**.

So HOS-114 is scoped to **monthly, paid** reactivation only, enforced explicitly
rather than left to chance.

### 6.2 Shared paid-create helper (DECIDED — OQ-1)

`subscription-checkout.service.ts` already imports `TrialService`
(`subscription-checkout.service.ts:50`), so having `trial.service.ts` import
`initiatePaidMonthlySubscription` back would create a **circular ESM import**.
`initiatePaidMonthlySubscription` is also first-subscription-oriented (promo/trial
logic inline; the `ALREADY_SUBSCRIBED` guard at the route level is the opposite of
the reactivation case), so it must NOT be reused wholesale.

**Decision**: extract the low-level `mode:'paid'` create block
(`subscription-checkout.service.ts:657-674` — the `subscriptions.create({...mode:'paid'})`
call, the `checkoutUrl = providerInitPoint ?? providerSandboxInitPoint` resolution,
and the `throw MISSING_INIT_POINT` fail-closed) into a **new shared low-level module** (e.g.
`apps/api/src/services/billing/paid-subscription-create.ts`). Both
`initiatePaidMonthlySubscription` and the two reactivate methods import that
helper — one source of truth for the paid contract, no cycle. The helper takes a
resolved `planId` + `priceId` (bridging the `planSlug` vs `planId` input
mismatch: reactivate carries `planId`, the existing checkout function carries
`planSlug`).

### 6.3 Paid reactivation flow

Using the §6.2 helper, each reactivate method (after the §6.1 guard):

1. Ensure the customer exists.
2. Resolve the monthly `priceId` for the target plan.
3. Call the shared helper → real MP preapproval, `checkoutUrl`, fail-closed if
   absent.
4. Return `{ checkoutUrl, subscriptionId, status:'incomplete' }` so the web
   redirects the user to MercadoPago. The created sub is `incomplete` until the
   webhook confirms (grants no entitlements meanwhile — see §6.4 / OQ-3).

### 6.4 Old-subscription supersession ordering (the important part)

Today reactivate cancels the previous subscription(s) **synchronously**, right
after the (fake-active) create. With a real paid checkout the new subscription is
`incomplete` until the webhook confirms, so cancelling the old one immediately
would leave the user with **nothing** if they abandon the MercadoPago page.

Required change: **defer** the old-subscription cancellation and the "converted /
reactivated" audit + `clearEntitlementCache` to the **webhook confirmation** of
the new preapproval (the same event that flips `incomplete → active`). Carry the
"supersedes subscription X" intent in the new subscription's `metadata` (e.g.
`supersedesSubscriptionId`) so the webhook handler can complete the swap
atomically. Confirm exactly where in the webhook path this belongs during
implementation (`subscription_authorized_payment.created` / the activation
handler that HOS-108 touched).

### 6.5 Entitlement continuity during the `incomplete` window (DECIDED — OQ-3)

`loadEntitlements` (`apps/api/src/middlewares/entitlement.ts:441-448`) grants
entitlements only for `active` / `trialing` / `comp` subscriptions — an
`incomplete` sub grants **nothing**. This is what makes §6.4's deferred
cancellation mandatory: `reactivateFromTrial` starts from an existing `trialing`
sub (which DOES grant entitlements). If the new paid sub is created `incomplete`
and the old `trialing` sub is cancelled immediately (today's ordering), the user
loses all entitlements during the MP-checkout window — a regression versus even
the current buggy behavior. The old sub therefore stays live (and keeps granting
entitlements) until the webhook confirms the new one `active`; only then is it
cancelled. This also correctly withholds paid features until payment is actually
authorized (the new sub never grants anything while `incomplete`).

## 7. Data model / contracts

- **No schema migration expected.** The fix is behavioral; it reuses existing
  billing columns (`status`, `mp_subscription_id`, `metadata`).
- **Endpoint response shape change**: `/billing/trial/reactivate` and
  `/billing/trial/reactivate-subscription` must now be able to return a
  `checkoutUrl` (redirect) for the paid branch. Update the Zod response schema in
  `@repo/schemas` and the web caller to follow the redirect — mirror how
  `/start-paid` responses are consumed. This is a **contract change** the web
  side must handle (today it assumes synchronous success).
- **Metadata**: add `supersedesSubscriptionId` (and keep the existing
  `convertedFromTrial` / `reactivatedFromCanceled` markers) so the webhook can
  finish the supersession.

## 8. UX / UI behavior

- Reactivating to a paid plan now **redirects to MercadoPago** to add a card /
  authorize recurring billing, instead of appearing to succeed instantly. On
  return + webhook confirmation the subscription becomes `active` and the old one
  is cancelled.
- If the user abandons the MP checkout: the new sub stays `incomplete`, the old
  subscription remains untouched (per G-3), and entitlements are unchanged.
- Reactivation onto a free, unknown, or annual `planId` is rejected with a clear
  error (§6.1) rather than silently creating a subscription.

## 9. Acceptance criteria

- **AC-1** Reactivating to a paid plan calls `subscriptions.create` with
  `mode:'paid'` + `priceId` + `paymentMethodReturnUrl` and returns a
  `checkoutUrl`; the created sub is `incomplete` (not `active`) until the webhook
  confirms.
- **AC-2** If the provider returns no checkout URL, the reactivation throws
  (fail-closed) and creates/leaves **no** card-less `active` subscription.
- **AC-3** The previous subscription is **not** cancelled until the new
  preapproval is confirmed by the webhook; abandoning checkout leaves the old
  subscription intact and entitlements unchanged.
- **AC-4** After webhook confirmation, the new sub is `active`, has a
  `mp_subscription_id`, the old sub is cancelled, the audit row is written, and
  the entitlement cache is cleared exactly once.
- **AC-5** Regression tests reproduce the original bug (a reactivate call that
  ends `active` with no `mp_subscription_id`) and prove it no longer happens.
- **AC-6** Reactivation onto an unknown `planId` throws (fail-closed); onto a
  **free** plan throws `INVALID_REACTIVATION_PLAN`; onto an **annual** plan throws
  `ANNUAL_REACTIVATION_UNSUPPORTED` (deferred to HOS-123). No subscription row is
  created in any of these cases.
- **AC-7** The `mode:'paid'` create + `checkoutUrl` + `MISSING_INIT_POINT` logic
  lives in exactly ONE shared helper module used by both
  `initiatePaidMonthlySubscription` and the reactivate methods (no duplication, no
  circular import).
- **AC-8** The detection query (§12) is run against staging/prod before merge; if
  it returns rows, they are remediated via a documented, reversible procedure with
  owner sign-off. If it returns zero (expected, since the endpoints are currently
  unwired), remediation is a no-op and this is recorded in the close-out.

## 10. Risks

- **R-1** Ordering regression: mishandling the deferred cancellation could either
  (a) cancel the old sub too early (user left with nothing) or (b) never cancel it
  (double subscription). Needs focused webhook-path tests.
- **R-2** Web contract drift: if the web caller isn't updated to follow the new
  `checkoutUrl` redirect, reactivation silently no-ops on the client. Ship the
  schema + web change together.
- **R-3** Billing CORE: this touches the checkout + webhook path → mandatory
  staging smoke against the real MP sandbox, and prod smoke before promotion
  (see labels below). The vitest MP stub cannot catch stub-vs-real divergence.
- **R-4** Data remediation may need to touch live prod rows — must be scripted,
  reviewed, and reversible. **Likely low/zero impact**: both endpoints are
  currently unwired (no live web caller — `endpoints-protected.ts:622-631` defines
  an unused wrapper; `/trial/reactivate` has none), so the phantom-sub count may be
  0. Confirm with the §12 query before writing any remediation.
- **R-5** Helper extraction (§6.2) touches the genuine `/start-paid` path (it now
  calls the extracted helper too). A regression here breaks first-time checkout, so
  the existing `/start-paid` tests + staging smoke must stay green after the
  refactor.

## 11. Resolved decisions

All open questions were resolved during spec review (2026-07-10) with owner
input; evidence gathered from a read-only investigation of the current code.

- **OQ-1 — code-sharing shape → EXTRACT a shared helper.** A direct
  `trial.service.ts → initiatePaidMonthlySubscription` import is impossible
  (circular ESM: `subscription-checkout.service.ts:50` already imports
  `TrialService`), and that function is first-subscription-oriented. Resolution:
  extract the low-level `mode:'paid'` create block into a new shared module both
  sides import (§6.2). Duplication rejected. *(Owner-decided.)*
- **OQ-2 — free-plan reactivation → REJECTED / branch dropped.** `planId` is
  user-supplied and unvalidated today, and a free plan (`TOURIST_FREE_PLAN`,
  `monthlyPriceArs:0`) is a real unguarded target. Reactivation is only meaningful
  onto a paid plan; the fix validates the catalog and rejects free/unknown plans
  (§6.1). The prior "free branch" is removed as dead code.
- **OQ-3 — entitlement continuity → old sub stays live until webhook-confirm.**
  `incomplete` grants no entitlements (`entitlement.ts:441-448`); the old
  `trialing`/active sub must not be cancelled until the new one is confirmed
  `active`, else the user loses entitlements mid-checkout (§6.5). This reinforces
  the §6.4 deferred-cancellation design (no longer optional).
- **OQ-4 — data remediation → run the query first; expected zero.** Both endpoints
  are currently unwired (no live web caller), so the phantom-sub count is likely 0.
  Detection query is in §12; remediation is conditional on it returning rows and
  needs owner sign-off (AC-8, R-4).
- **OQ-5 — annual → OUT OF SCOPE, rejected explicitly.** Annual is architecturally
  incompatible with `billing.subscriptions.create()` (it uses
  `billing.checkout.create({mode:'payment'})` + direct insert,
  `subscription-checkout.service.ts:1162`). HOS-114 is monthly-only and rejects an
  annual `planId` (§6.1); annual reactivation is deferred to **HOS-123**.
  *(Owner-decided.)*

## 12. Implementation notes

- Reuse `SubscriptionCheckoutError('MISSING_INIT_POINT', ...)` rather than a new
  error type, for consistency with the paid path.
- Keep the existing idempotency/guard behavior of the reactivate methods; only
  the create-args and the cancel/audit **timing** change.
- Tests: add a regression test asserting the pre-fix bug shape (reactivate →
  `active` + null `mp_subscription_id`) is gone, plus webhook-confirmation tests
  for the supersession ordering (R-1). Bug-fix ⇒ regression test first
  (project rule).
- Distinct from but adjacent to **HOS-108** (webhook activation) and **HOS-110**
  (no-card trial unification) — both stem from qzpay `mode:'paid'` create
  semantics. Reference their PRs (#2191 for HOS-108) when implementing the
  webhook side. Annual reactivation follow-up is **HOS-123**.
- **Route-level guard note**: the genuine `/start-paid` route blocks with
  `ALREADY_SUBSCRIBED` when the customer already has an active/trialing/comp
  accommodation sub (`apps/api/src/routes/billing/start-paid.ts:274-293`). That
  guard is route-level, so it does NOT block the `TrialService`-mediated
  reactivation path — but it confirms the extracted helper must be the *low-level*
  create block, not the guarded route handler.

### Phantom-sub detection query (AC-8 / OQ-4)

Run against staging and prod before merge. Metadata markers are written by the
two buggy methods (`convertedFromTrial:'true'` / `reactivatedFromCanceled:'true'`,
`trial.service.ts:946-949` and `:1137-1141`):

```sql
SELECT id, customer_id, plan_id, status, mp_subscription_id, metadata, created_at
FROM billing_subscriptions
WHERE status = 'active'
  AND mp_subscription_id IS NULL
  AND (
    metadata->>'convertedFromTrial' = 'true'
    OR metadata->>'reactivatedFromCanceled' = 'true'
  );
```

Zero rows ⇒ remediation is a no-op (record in close-out). Rows present ⇒ scripted,
reversible remediation with owner sign-off.

## 13. Smoke gate

Billing CORE change (checkout + webhook path) ⇒ this spec carries:

- `status-needs-smoke-staging` — real MP sandbox reactivation smoke.
- `status-needs-smoke-prod` — prod smoke before promoting `staging → main`.

Do not mark the issue Done while either label is present.

## 14. Linear

Canonical tracking: HOS-114
<https://linear.app/hospeda-beta/issue/HOS-114>
