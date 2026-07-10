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
- **G-4** Existing phantom-active subscriptions already created by the buggy path
  in staging/prod are identified and remediated (see OQ-4).

## 4. Non-goals

- **NG-1** Changing the **no-card trial** semantics (owned by HOS-110). Granting
  or extending a trial is out of scope; this spec is strictly about the *paid*
  reactivation path.
- **NG-2** Changing the webhook activation logic itself (HOS-108). This spec
  reuses the existing confirmation path; it does not redesign it.
- **NG-3** New UI surfaces. The web reactivation buttons already exist; only their
  resulting behavior (redirect to MP) changes.

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

### 6.1 Paid vs free branch

Resolve the target plan first. If the plan is **paid** (has a monthly price),
route through the card-collecting checkout contract; if the plan is **free**
(no price), the current local-only create is actually correct — keep it, but
make the intent explicit rather than accidental.

### 6.2 Paid reactivation

Mirror `initiatePaidMonthlySubscription`:

1. Ensure the customer exists.
2. Resolve the monthly `priceId` for the target plan.
3. `subscriptions.create({ customerId, planId, priceId, mode:'paid',
   billingInterval:'monthly', paymentMethodReturnUrl, notificationUrl,
   metadata: { source:'reactivate-from-trial' | 'reactivate-subscription', ... } })`.
4. `checkoutUrl = providerInitPoint ?? providerSandboxInitPoint`; if absent
   → throw (fail-closed).
5. Return `{ checkoutUrl, subscriptionId, status:'incomplete' }` so the web
   redirects the user to MercadoPago.

**Strong candidate**: instead of duplicating steps 1–4 into `trial.service.ts`,
have both reactivate methods **delegate** to a shared paid-checkout entry point
(`initiatePaidMonthlySubscription` or a small extracted helper) so there is one
source of truth for the paid contract. This is a real architecture decision —
see OQ-1.

### 6.3 Old-subscription supersession ordering (the important part)

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

### 6.4 Free reactivation

Keep the local-only `subscriptions.create` (no `mode`), but assert the plan is
free before taking this branch, and keep the synchronous cancel/audit/cache
(no external dependency, so no ordering hazard).

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
- Free-plan reactivation (if any) stays instant.

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
- **AC-6** Existing phantom-active subs from the buggy path are remediated
  (OQ-4 resolution), with a documented, reversible procedure.

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
- **R-4** Data remediation (OQ-4) may need to touch live prod rows — must be
  scripted, reviewed, and reversible.

## 11. Open questions

- **OQ-1 (architecture — needs decision)** Delegate both reactivate methods to
  the existing `initiatePaidMonthlySubscription` (single source of truth for the
  paid contract) vs extract a shared helper vs duplicate the args inline? Owner
  picked "route through paid checkout" for behavior; the code-sharing shape is
  still open. Watch for a service-to-service coupling/cycle between
  `trial.service.ts` and `subscription-checkout.service.ts`.
- **OQ-2** Does `reactivateFromTrial` ever legitimately target a **free** plan,
  or is it always trial→paid? Determines whether the free branch (§6.4) is dead
  code we should drop or a real path to keep.
- **OQ-3** Grace / entitlement continuity: while the new sub is `incomplete`
  (user mid-checkout), what entitlements does the user have — the lapsed/old
  ones, or none? Confirm this matches the `/start-paid` behavior and doesn't grant
  paid features before payment is authorized.
- **OQ-4 (data remediation)** How many phantom-active subs already exist in
  staging/prod from the buggy path (query: `status='active'` AND
  `mp_subscription_id IS NULL` AND created via reactivate metadata), and what's
  the remediation — cancel + re-prompt for card, or migrate? This likely needs
  its own follow-up + owner sign-off.
- **OQ-5** Is `reactivateSubscription` reachable for **annual** (one-time) plans,
  not just monthly? If so the paid contract differs (annual has no preapproval).
  Confirm which billing intervals reach these methods (cf. HOS-115 annual-trial
  branch).

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
  webhook side.

## 13. Smoke gate

Billing CORE change (checkout + webhook path) ⇒ this spec carries:

- `status-needs-smoke-staging` — real MP sandbox reactivation smoke.
- `status-needs-smoke-prod` — prod smoke before promoting `staging → main`.

Do not mark the issue Done while either label is present.

## 14. Linear

Canonical tracking: HOS-114
<https://linear.app/hospeda-beta/issue/HOS-114>
