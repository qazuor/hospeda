---
title: Paid checkout success resolution + MP preapproval hygiene (post-HOS-108)
linear: HOS-151
statusSource: linear
created: 2026-07-11
type: fix
areas:
  - web
  - api
  - billing
---

# Paid checkout success resolution + MP preapproval hygiene (post-HOS-108)

## 1. Summary

Close the three defects left after HOS-108 fixed backend activation of recurring
MercadoPago (MP) subscriptions:

- **A** — the checkout success page never resolves for a paid conversion (it
  never polls), so it hangs on "Verificando estado del pago..." even after the
  subscription activates.
- **B** — the `abandoned-pending-subs` cron marks stale subscriptions `abandoned`
  locally but never cancels the MP preapproval, leaving live chargeable
  authorizations orphaned on MP's side.
- **C** — a paid subscription row can be persisted with an empty
  `mp_subscription_id` when MP returns a partial (id-less) success, producing a
  row that can never activate and whose preapproval can never be located or
  cancelled.

## 2. Problem

Surfaced 2026-07-11: the owner (customer `28be2fdc-4ea0-49b4-9c5b-46703678fa2f`,
the same customer named in HOS-108's data-recovery section) tried to publish a
new accommodation, had already used their trial, picked the `owner-test-daily`
plan, was charged by MP, was redirected back — and the page stayed **stuck on
"Verificando estado del pago..." forever**. Navigating to `/mi-cuenta` showed the
plan active.

HOS-108 (PR #2191, deployed) fixed the **backend** activation bug (the transition
guard rejecting qzpay's `incomplete` source status). The DB confirms it works:
the last attempt (`3e890bee`, 16:40:52) activated via the polling cron
(`billing_subscription_polling_jobs` row `succeeded` in 1 attempt at 16:41:23).

So the backend now activates. But the incident still happened, because three
independent defects remain — none of which HOS-108 addressed. Together they mean
every paid conversion has a broken confirmation UX (A), and any abandoned or
partially-created checkout can leak real money via an orphaned MP preapproval
(B, C). This is pre-beta critical: the owner tests on prod with real charges, and
real hosts will convert to paid the same way.

Two read-only code audits confirmed all three fix directions with file:line
evidence (recorded in §5 and §12).

## 3. Goals

- **G-1 (Bug A)** — The paid checkout success page resolves to a success (or
  explicit fallback) state on its own, without the user manually reloading or
  navigating away, by polling the subscription status until it activates.
- **G-2 (Bug B)** — When `abandoned-pending-subs` reaps a stale subscription that
  holds a live `mp_subscription_id`, the MP preapproval is cancelled (and
  verified cancelled) before/at the point the local row is marked `abandoned`, so
  no orphaned chargeable authorization survives.
- **G-3 (Bug C)** — The paid-subscription create path never persists a row with an
  empty/absent `mp_subscription_id`; a partial MP response fails the create loudly
  instead of leaving an unlinkable row.
- **G-4** — Regression tests reproduce each defect before the fix (per project
  testing policy).

## 4. Non-goals

- **NG-1** — The backend activation guard / qzpay→Hospeda status normalization.
  Owned and fixed by HOS-108. Not touched here.
- **NG-2** — Web calling `/admin/*` endpoints with role HOST (`/admin/reviews`,
  `/admin/users/:id`). Separate routing bug, filed separately.
- **NG-3** — Entitlement-denial log noise on `/host/dashboard` etc. Backlog / same
  family as PR #2276.
- **NG-4** — Cloudflare revalidation 404s (missing web env vars in Coolify). Ops,
  separate.
- **NG-5** — One-off data recovery of already-stuck prod rows. The owner already
  cancelled the orphaned MP preapprovals manually; HOS-108 owns the historical
  recovery. This spec fixes the systemic cause so it stops recurring.
- **NG-6** — Redesign of the MP checkout/return-URL scheme beyond threading the
  local subscription id needed by Bug A.

## 5. Current baseline

### Bug A — success page (frontend)

- `apps/web/src/pages/[lang]/suscriptores/checkout/success.astro` — one-shot SSR
  render, **zero client JS**. Computes `isApproved = collection_status ===
  'approved' || effect ∈ {trial,comp}` once, then renders success or the
  "verifying" branch via `apps/web/src/components/billing/CheckoutResult.astro`
  (pure markup). No poll, no timeout.
- `collection_status` is a Checkout-Pro (one-time) param. A recurring MP
  **preapproval** redirect never sets it — see `buildPaymentMethodReturnUrl`
  (`apps/api/src/routes/billing/checkout-return-urls.ts:66-78`). The doc comment
  there claims the page reads `?status=`/`?preapproval_id=`, but the page only
  reads `collection_status`/`effect` (doc/impl drift). So the success condition is
  structurally unreachable for any paid conversion.
- A working, unused endpoint already exists:
  `GET /api/v1/protected/billing/subscriptions/:localId/status`
  (`apps/api/src/routes/billing/subscription-status.ts`), documented "front polls
  every ~2s until active". It is never called from `apps/web` (grep-confirmed).

### Bug B — abandoned cron (backend)

- `apps/api/src/cron/jobs/abandoned-pending-subs.job.ts:151-165` — bare
  `UPDATE billing_subscriptions SET status='abandoned'`, no MP call. Hourly,
  30-min TTL, advisory lock 1006.
- `ABANDONED` is terminal (empty transition set):
  `packages/service-core/src/services/billing/subscription/subscription-status-transitions.ts:120-123`.
  A late webhook confirming the preapproval hits `processSubscriptionUpdated`,
  whose guard rejects `abandoned → active`
  (`apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts:567-588`) and
  only logs to Sentry → permanent split-brain (MP charging, local row dead).
- Correct cancel primitives + patterns already exist:
  - `apps/api/src/services/subscription-cancel.service.ts:261-309` — call
    `billing.subscriptions.cancel(id, {cancelAtPeriodEnd})`, rollback on failure.
  - `apps/api/src/services/billing/reactivation-supersession-complete.ts:284-366`
    — call cancel, then **re-verify** against the live provider via
    `paymentAdapter.subscriptions.retrieve()` before writing the audit row.
  - qzpay-core orchestrator: `billing.subscriptions.cancel/pause` are **no-ops**
    unless `providerSubscriptionIds[provider]` is non-empty — so the cron must
    gate on a non-empty `mp_subscription_id`.
- Hospeda config sets `providerSyncErrorStrategy: 'throw'`
  (`apps/api/src/middlewares/billing.ts:146-152`) — provider failures surface as
  thrown errors, not silent swallows.

### Bug C — empty `mp_subscription_id` create

- `@qazuor/qzpay-mercadopago`'s `mapToProviderSubscription` defaults
  `id: preapproval.id ?? ""` without throwing on an id-less 2xx.
- `createPaidSubscription`
  (`apps/api/src/services/billing/paid-subscription-create.ts:130-137`) throws
  `MISSING_INIT_POINT` only when the checkout URL is absent; it does not require a
  non-empty provider id. Result: a live `incomplete` row with
  `mp_subscription_id = ''`.
- The webhook lookup is `eq(billingSubscriptions.mpSubscriptionId,
  preapprovalId)` (`subscription-logic.ts:406`) — never matches `''`, so such a
  row can never activate, and its preapproval id was never captured so it can
  never be cancelled. Prod had 4 such rows for this customer.

## 6. Proposed design

### Bug A — poll the status endpoint from the success page

1. Thread the local subscription id into the paid return URL:
   `buildPaymentMethodReturnUrl` (`checkout-return-urls.ts`) appends the local
   `subscriptionId` (e.g. `?sub=<localId>`) for the paid-preapproval branch.
2. `success.astro` renders an initial "verifying" state and mounts a small client
   island (web app convention: native + small custom hook, CSS Modules — NOT
   Tailwind/React-heavy). The island:
   - Reads `sub` from the URL.
   - Polls `GET /api/v1/protected/billing/subscriptions/:localId/status` every
     ~2s.
   - On `active` (or `trialing`/`comp` as applicable) → swap to the success state
     (and/or redirect to the account/dashboard success view).
   - On a bounded timeout (~90s / ~45 attempts) → render an explicit fallback:
     "Está tardando más de lo normal — el pago puede seguir procesándose; revisá
     tu cuenta", with a link to `/mi-cuenta`. Never spin forever.
   - Keep the existing `effect ∈ {trial,comp}` fast-path (those resolve
     immediately without polling).
3. **D-1 (decided):** branch on which params are present — `collection_status ===
   'approved'` stays as the immediate-success fast-path for the one-time (annual)
   Checkout-Pro path, and polling is the path for recurring preapprovals (keyed on
   the local subscription id in the return URL). Do not unify everything on
   polling.

### Bug B — cancel + verify before abandoning

In `abandoned-pending-subs.job.ts`, before writing `abandoned` for a row:

- If `mp_subscription_id` is **non-empty**: call the cancel primitive
  (`billing.subscriptions.cancel(id)` or the lower-level
  `paymentAdapter.subscriptions.cancel(mpSubscriptionId, false)` for a hard
  cancel), then **verify** via `paymentAdapter.subscriptions.retrieve()` that MP
  reflects `cancelled`/`canceled`/`paused`. Only then flip local status to
  `abandoned`. Mirror `reactivation-supersession-complete`'s verify-before-write.
- If `mp_subscription_id` is empty: abandon locally (nothing to cancel) — but this
  case should become rare once Bug C is fixed.
- Failure handling (**D-2, decided**): a cancel/verify failure must NOT abandon the
  row with a live preapproval. Leave the row for the next hourly run, capture the
  failure to Sentry, and continue the per-row best-effort loop for the remaining
  rows. No new "abandon-blocked" enum value / transition / migration.
- Late-webhook edge (OQ-3): once we cancel the preapproval on MP, a subsequent
  webhook cannot resurrect it, which is the desired outcome; confirm the terminal
  `ABANDONED` guard rejection then becomes correct (no live MP side) rather than a
  split-brain.

### Bug C — require a non-empty provider id at create

- Extend the `createPaidSubscription` guard (or add a sibling to
  `MISSING_INIT_POINT`) to also require a non-empty `mp_subscription_id`
  (`providerResult.id`) for the paid-preapproval branch. On absence, throw a typed
  error (`MISSING_PROVIDER_SUBSCRIPTION_ID`) so the create fails loudly and the
  checkout surfaces a retryable "try again" to the user, instead of persisting an
  unlinkable row. **D-3 (decided):** no automatic re-create — the user retries
  manually (avoids a double-preapproval if the first partially landed).
- Verify the qzpay-core create-then-delete path: on a thrown create the local row
  is soft-deleted (`deletedAt` set), so throwing here does not leave a live row.

## 7. Data model / contracts

- **No schema migration expected.** All three fixes operate on existing tables
  (`billing_subscriptions`, `billing_subscription_polling_jobs`) and existing
  columns.
- `GET /billing/subscriptions/:localId/status` — existing contract, reused as-is.
  Confirm its response shape carries the status the island needs.
- Return URL contract change: `buildPaymentMethodReturnUrl` gains a `sub` query
  param on the paid-preapproval branch. Update the doc comment (currently drifted).
- If Bug B needs a non-terminal intermediate state for abandon-blocked rows
  (OQ-2), that would touch `SubscriptionStatusEnum` + transition table — to be
  decided; preferred design avoids a new enum value.

## 8. UX / UI behavior

- Paid checkout success page: shows "Verificando estado del pago..." with a
  progress affordance, resolves to success automatically within seconds of MP
  confirming, and after ~90s degrades to an explicit, non-alarming fallback that
  points to `/mi-cuenta`. i18n keys under `billing.checkout.success.*` (reuse
  existing `verifyingStatus`, add fallback/timeout copy in es/en/pt).
- No change to the trial/comp path (already resolves immediately).

## 9. Acceptance criteria

- **AC-1 (A)** — After a real paid preapproval checkout, the success page resolves
  to the success state on its own (no manual reload) once the subscription
  activates, verified in the prod clean-test.
- **AC-2 (A)** — If activation does not occur within the timeout, the page shows
  the explicit fallback (not an infinite spinner).
- **AC-3 (A)** — The trial/comp fast-path still resolves immediately without
  polling.
- **AC-4 (B)** — After `abandoned-pending-subs` reaps a row that held a live
  `mp_subscription_id`, the corresponding MP preapproval is `cancelled`/`paused`
  on MP (verified via `retrieve()`), and the local row is `abandoned`. A regression
  test asserts the cancel call happens for populated-id rows and is skipped for
  empty-id rows.
- **AC-5 (B)** — A cancel/verify failure does not record the row as successfully
  abandoned; it is retried or flagged, and the sweep continues for other rows.
- **AC-6 (C)** — A create where MP returns a 2xx without a preapproval id throws a
  typed error and persists NO live row (soft-deleted or never inserted). A
  regression test reproduces the id-less MP response.
- **AC-7** — Each bug has a regression test that fails before the fix and passes
  after. Lint + typecheck + tests green.

## 10. Risks

- **R-1** — Polling from the success page adds authenticated load; bound attempts
  and interval to avoid hammering the API.
- **R-2** — Cancelling the MP preapproval in the cron introduces a network call
  inside a job that currently runs a single bulk UPDATE in a transaction.
  Redesign the job to fetch candidate rows, then cancel+verify per row OUTSIDE the
  DB transaction (like the notification loop already does post-commit), to avoid
  holding a long transaction across MP calls.
- **R-3** — Hard-cancel vs pause on MP: choose the semantics that guarantees no
  further charge for an abandoned checkout (likely hard `cancelled`), and confirm
  it is irreversible in a way that matches "abandoned".
- **R-4** — Real-MP-only validation: the MP sandbox is unreliable, so the gate is
  a prod clean-test with real charges. Small blast radius (owner's card,
  daily-plan minimal amount) but must be executed before Done.
- **R-5** — Return-URL param change must not break the annual (Checkout-Pro) path
  that legitimately uses `collection_status`.

## 11. Open questions

### Resolved (owner decisions, 2026-07-11)

- **OQ-1 → D-1 (Bug A)** — **Branch on present params.** If the return URL carries
  the local subscription id (recurring preapproval) → poll the status endpoint.
  If it carries `collection_status=approved` (annual / one-time Checkout-Pro) →
  immediate success fast-path. Each flow keys on the param MP actually sends; the
  annual path keeps resolving instantly. Do NOT unify everything on polling.
- **OQ-2 → D-2 (Bug B)** — **Retry next run + Sentry capture; never abandon on a
  failed cancel.** If cancel/verify against MP fails, the row is NOT marked
  `abandoned` (left for the next hourly run), the failure is captured to Sentry,
  and the per-row loop continues for the remaining rows. No new
  `SubscriptionStatusEnum` value / transition-table / migration.
- **OQ-4 → D-3 (Bug C)** — **Throw a typed error, no auto-retry.** The create
  throws `MISSING_PROVIDER_SUBSCRIPTION_ID` (or similar), persists no live row, and
  the checkout surfaces a retryable "there was a problem, try again" to the user.
  No automatic re-create (avoids a double-preapproval risk if the first partially
  landed).

### Remaining — resolve during implementation (technical, not owner decisions)

- **OQ-3 (Bug B)** — Confirm that cancelling the preapproval on MP fully
  neutralizes the terminal-state late-webhook edge: once MP shows `cancelled`, a
  later webhook cannot resurrect it, so the existing `ABANDONED` guard rejection
  becomes correct (no live MP side) rather than a split-brain. Verify in code +
  the prod clean-test.
- **OQ-5 (Bug A)** — Verify the `subscription-status.ts` GET response already
  exposes everything the polling island needs (status + enough to redirect); add a
  minimal field only if a gap is found.

## 12. Implementation notes

- Fix patterns to copy for Bug B live at
  `subscription-cancel.service.ts:261-309` (call + rollback) and
  `reactivation-supersession-complete.ts:284-366` (call + retrieve-verify).
- qzpay-core cancel/pause are no-ops without a non-empty provider id — always gate.
- Web app conventions: Astro + small client island, native HTML + small hooks (NOT
  TanStack Form), CSS Modules (NOT Tailwind), i18n via `@repo/i18n`.
- Implementation happens in a dedicated worktree (Phase 2). This doc is Phase 1
  (no worktree).
- Validation is a prod clean-test (MP sandbox unreliable): cancel active sub →
  `hops --target=prod logs-clear api` → fresh paid conversion → capture the exact
  MP return-URL params (this resolves the doc/impl drift on what MP actually
  sends) + final sub state. Labels `status-needs-smoke-prod` +
  `status-needs-smoke-staging` apply.

## 13. Linear

Canonical tracking:
HOS-151

Related: HOS-108 (backend activation, done — this is its follow-up), HOS-114
(reactivate-endpoint subscription-creation gaps, same family), HOS-54 (billing
go-live master).
