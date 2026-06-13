---
specId: SPEC-217
title: Deterministic Billing for E2E — wire the QZPay test-control adapter for fault injection and produce real terminal subscription states so the gated paywall specs run in CI
slug: qzpay-test-control-e2e-wiring
type: test
complexity: high
status: in-progress
owner: qazuor
created: 2026-06-11
base: staging
tags:
  - e2e
  - billing
  - testing
  - qzpay
  - test-control
  - entitlements
  - ci
relatedSpecs:
  - SPEC-143
  - SPEC-092
linearIssues: []
---

# SPEC-217 — Deterministic Billing for E2E (QZPay test-control wiring + terminal subscription state)

## 1. Origin & problem statement

Six P0 e2e specs that exercise the billing paywall are permanently skipped in CI, so
the most security-relevant billing behaviour (write-blocking for lapsed hosts, and
transactional safety under payment-provider failure) has **zero deterministic
coverage**. Real validation is deferred to a manual staging smoke against the
MercadoPago sandbox, which is slow, human-gated, and easy to skip.

The skipped specs split into two groups with **different** root causes (verified
against `origin/staging` HEAD `5ac77dd94`):

### Group A — lapsed-host write-blocking (host-03, host-04, host-07b)

These assert that a host whose trial **expired** / whose subscription was
**cancelled+lapsed** is blocked from publishing (`PATCH /api/v1/admin/accommodations/:id`
with `lifecycleState=ACTIVE` → 403, accommodation stays DRAFT).

The publish gate is **not** the entitlement middleware. It is
`AccommodationService.publish()` → `checkEligibility(ownerId)`
(`packages/service-core/src/services/accommodation/accommodation.service.ts:1409-1414`,
impl in `accommodation-publish-deps.ts:71-94`). `checkEligibility` runs a **direct local
DB query** on `billing_subscriptions` and returns `subscription_required` (→ `FORBIDDEN`
/ 403) unless a row has `status IN ('active','trialing')`. It never calls MercadoPago.

The blocker is that the e2e helpers cannot produce the correct **terminal status**.
`forceTrialExpired()` (`apps/e2e/fixtures/db-helpers.ts:122-134`) only moves `trial_end`
and `current_period_end` into the past — it leaves `status = 'trialing'` (and even
requires `status='trialing'` in its WHERE clause). Because `checkEligibility` keys on
**status, not dates**, an "expired" trial still reads as active → publish is allowed →
the assertion fails. In production the `trialing → expired` (and cancellation-lapse)
status transition is performed by billing crons (`apps/api/src/cron/jobs/trial-expiry`,
`finalize-cancelled-subs`), not by a date mutation.

The current skip guard (`if (process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED !== 'true')
test.fixme(...)`) and its comment blame the *entitlement middleware draft-defaults
fallback*. That mental model is **wrong** — the draft-defaults fallback grants
`owner-basico` entitlements (which include `PUBLISH_ACCOMMODATIONS`) but the admin PATCH
route has no `requireEntitlement` gate, so that fallback is irrelevant. The real
dependency is the **status transition**, not the entitlement set and not fault injection.

### Group B — fault injection / transactional safety (host-07c, host-07d, res-01)

These assert that when a QZPay adapter operation **fails or times out** mid-publish, the
system behaves safely (publish returns 5xx, no orphan subscription row, compensation
`cancelTrial` runs, retry succeeds). They drive failures through the QZPay **test-control
adapter** via an HTTP fixture (`apps/e2e/fixtures/qzpay-test-control.ts` →
`POST /api/v1/test/qzpay-control/fail-next`).

The mechanism is **half-built**: `applyTestControl()`
(`packages/billing/src/adapters/qzpay-test-control.ts:111`) is defined and exported but
has **zero callers** — it is never wired into the real adapter in
`packages/billing/src/adapters/mercadopago.ts`. The HTTP endpoint, the in-memory state
machine, and the fixture all exist, but no adapter method routes through
`applyTestControl`, so queued faults are never injected. The three specs self-skip via
`test.fixme` when the endpoint 404s (the route only mounts when
`HOSPEDA_QZPAY_TEST_CONTROL_ENABLED === 'true'` AND `NODE_ENV !== 'production'`).

### Why now

The e2e suite was just repaired and re-armed for PR gating (SPEC-092 era, issue #1547 /
PR #1556). With the suite green and running on every PR, these six skips are the largest
remaining coverage gap, and they cover the highest-risk billing behaviour. Full
root-cause analysis is in engram topic `e2e/billing-paywall-gating`.

## 2. Goals & success criteria

- **G1** — host-03, host-04, host-07b run **for real** in the PR P0 suite and pass,
  validating that lapsed hosts are blocked from publishing, deterministically, without
  any MercadoPago round-trip.
- **G2** — host-07c, host-07d, res-01 run in the PR P0 suite with the test-control
  adapter actually injecting faults, validating transactional safety and compensation.
- **G3** — the skip-guard comments and messages reflect the **real** mechanism (no more
  "entitlement draft-defaults" mental model), so future readers aren't misled.
- **G4** — close the production correctness gap (OQ-1, decided 1a): make the publish
  gate date-aware so an expired-trial / lapsed host cannot publish during the cron-lag
  window. This is what lets host-03 be a faithful trial-expiry test.

Success = the six specs are un-skipped in their target suite and pass on three
consecutive CI runs with no flakiness; `applyTestControl` has real callers; no new
skips introduced elsewhere.

## 3. User stories & acceptance criteria

### US-1 — Lapsed host cannot publish (Group A)

**As** the platform, **when** a host's trial has expired or their subscription is
cancelled and lapsed, **then** a publish attempt returns 403 and the accommodation
stays DRAFT.

- **AC-1.1** host-03 (trial expired) runs un-skipped and asserts 403 + DRAFT + reads
  still work.
- **AC-1.2** host-04 (cancellation grace → lapse) runs un-skipped: write OK during
  grace, blocked after `current_period_end` passes.
- **AC-1.3** host-07b (cancelled+expired) runs un-skipped and asserts PATCH ACTIVE
  rejected.
- **AC-1.4** The terminal subscription status the test produces equals the status a
  production billing cron produces for the same lifecycle event (no fictional status).

### US-2 — Safe failure under adapter faults (Group B)

**As** the platform, **when** a QZPay operation fails or times out during publish,
**then** no partial state is persisted and compensation runs.

- **AC-2.1** host-07c: `failNext(startTrial, TIMEOUT)` → PATCH returns 5xx, accommodation
  stays DRAFT, no `billing_subscriptions` row.
- **AC-2.2** host-07d: `failNext(updateSubscription)` → `cancelTrial` recorded as
  compensation.
- **AC-2.3** res-01: first publish 5xx (no sub row), retry with no fault queued succeeds.
- **AC-2.4** `applyTestControl` is invoked for every `ControllableOperation` on the real
  adapter path; a queued fault deterministically changes the operation's outcome.

### US-3 — Honest gating

**As** a maintainer, **then** the skip guards and comments describe the real dependency.

- **AC-3.1** No test comment attributes Group A blocking to the entitlement
  draft-defaults fallback.
- **AC-3.2** Any remaining skip states the real precondition (e.g. "fault injection
  requires test-control adapter wired").

## 4. Out of scope

- Real MercadoPago sandbox/checkout validation (host-02, trial→paid conversion, webhook
  signature) — stays in the manual staging billing smoke.
- Changing the billing plan model, entitlement keys, or `owner-basico` definition.
- Re-enabling the disabled nightly cron schedule (separate ops decision).
- host-07e (cron-demote) unless it shares the same state mechanism (assess in Phase 1).

## 5. Architecture & technical approach

### 5.1 Group A — deterministic terminal subscription state

The fix does **not** need the test-control adapter. Two candidate mechanisms (decide in
Phase 1, see OQ-2):

- **Approach A1 (preferred): faithful helper.** Replace `forceTrialExpired` /
  cancellation SQL with helpers that set the exact terminal `status` a production cron
  produces (e.g. `status='expired'` for a lapsed trial, the cancelled-lapsed status for
  host-04/07b), plus the date columns. Cheap, deterministic, no cron runtime. Risk:
  helper drifts from real cron behaviour → mitigated by AC-1.4 + a unit assertion that
  the helper's target status is one the cron actually writes.
- **Approach A2: run the real cron.** Invoke the `trial-expiry` /
  `finalize-cancelled-subs` job in-process from the test after seeding the row. Most
  faithful; heavier and slower; couples e2e to cron internals.

Either way, `checkEligibility` is the gate; confirm it returns `subscription_required`
for the produced status.

**host-04 and host-07b are likely over-gated.** Both already set `status='cancelled'`
directly in their setup (host-04 line 109-116, host-07b line 86-94) — the exact terminal
status `finalize-cancelled-subs` produces. `checkEligibility` blocks `'cancelled'`
deterministically (it is not in `{active,trialing}`), with no MP and no date dependency.
They were gated uniformly with host-03 (identical copy-pasted env-guard) likely out of
caution. **Phase 1 must verify empirically**: remove their env-guard, run them — they
should pass as-is. If so, host-04/07b need only un-gating + an honest comment.

**host-03 is the only genuinely OQ-1-dependent spec.** `forceTrialExpired` leaves
`status='trialing'` (mirroring the cron-lag window), so `checkEligibility` does NOT block
and the publish succeeds → host-03 fails. Its design forks on OQ-1:

- If OQ-1 → **fix `checkEligibility` to be date-aware**, then host-03 (backdated
  `trial_end` + `status='trialing'`) blocks correctly and validates the gap is closed.
  This is the faithful test of "trial expired blocks writes".
- If OQ-1 → **defer the fix**, then host-03 can only pass by having the helper also set
  `status='cancelled'` (post-cron state) — but that makes host-03 a duplicate of
  host-07b, not a real trial-expiry test. Weaker; flag for product sign-off.

### 5.2 OQ-1 — `checkEligibility` date-blindness (RESOLVED: real production gap)

Investigated 2026-06-11. `checkEligibility` accepts `status IN ('active','trialing')` and
ignores `current_period_end` / `trial_end` (`accommodation-publish-deps.ts:90-93`). The
`trial-expiry` cron (`apps/api/src/cron/jobs/trial-expiry.ts`, schedule `0 2 * * *`, daily
2 AM) selects `status='trialing'`, JS-filters `trial_end < now`, then calls
`billing.subscriptions.cancel()` → leaves status **`'cancelled'`** (NOT `'expired'`; the
job's own header doc comment saying "expired" is wrong — `trial.service.ts
blockExpiredTrials` uses `cancel()`).

**Verdict: real production gap, ~0-24h window (avg ~12h).** Between `trial_end` passing and
the next 2 AM cron run, a host with `status='trialing'` but expired `trial_end` passes
`checkEligibility` and can publish. The grace-period source-of-truth doc
(`docs/billing/grace-period-source-of-truth.md`) defines three grace mechanisms (past-due
dunning 7d, cron-lag 6h for `active` only, soft-cancel) — **none covers lapsed trials**, so
this is not intentional grace. Bounded but real. Decision on whether to fix in-scope vs
follow-up spec: see OQ-1 in §10.

This date-blindness is ALSO why the e2e cron never runs (`HOSPEDA_CRON_ADAPTER` defaults to
`'manual'`, scheduler skips) and why `forceTrialExpired` leaving `status='trialing'` cannot
make host-03 block at the publish gate.

#### 5.2.1 The fix (OQ-1 decided 1a)

Make `checkEligibility` date-aware. Currently
(`accommodation-publish-deps.ts:90-93`):

```ts
const hasActive = subscriptions.some(
    (s) => s.status === 'active' || s.status === 'trialing'
);
```

Change to: a subscription only counts as "can publish" when its status is active/trialing
AND its relevant expiry date has not passed (beyond an allowed grace). For `trialing` →
gate on `trial_end`; for `active` → gate on `current_period_end`.

**Grace alignment (DECIDED 2026-06-11): reuse the existing 6h cron-lag grace.** The
entitlement middleware already applies a 6h cron-lag grace to `active` subs
(`BILLING_CRON_LAG_GRACE_HOURS = 6`, `docs/billing/grace-period-source-of-truth.md`).
`checkEligibility` MUST reuse the **same constant** (not a new one) and apply it uniformly
to both `current_period_end` (active) and `trial_end` (trialing), so there is one answer
to "is this sub live?". Net effect: an expired-trial host can publish for at most 6h past
`trial_end` (vs ~24h today), matching active-sub behaviour.

**Single-source-of-truth note:** prefer extracting the "is subscription live (status +
date + grace)" predicate into one shared helper used by BOTH the entitlement middleware
and `checkEligibility`, rather than duplicating the date/grace logic. Phase 1 to locate
the existing middleware grace check and decide the extraction shape.

#### 5.2.2 Scope expansion discovered during T-008/T-009 (write-gate)

Running host-03/04 un-gated revealed that `checkEligibility` was only consulted on the
DRAFT→ACTIVE **publish** transition (`AccommodationService.publish()`), NOT on plain
updates to an already-ACTIVE accommodation. host-03/04's titles ("blocks writes via UI +
API") specify that a lapsed host cannot **edit** existing listings, not just publish new
ones — so satisfying those approved P0 specs required a broader gate.

Implemented (decided with the user, "accept + harden"): a billing write-gate at the top of
`AccommodationService.update()` that rejects ALL updates with `FORBIDDEN /
subscription_required` for a HOST owner whose `checkEligibility` is `subscription_required`.
Excluded: admins (actor with `ACCOMMODATION_UPDATE_ANY`) and billing-exempt owner roles
(`BILLING_EXEMPT_ROLES`). The gate only fires when `publishDeps` are wired.

Two supporting changes:

- **Predicate `cancelled` case (soft-cancel grace)**: `isSubscriptionLive` now treats
  `cancelled` as live until `currentPeriodEnd` (0h extra grace, unlike active's 6h),
  matching the documented soft-cancel grace. Needed so host-04's "write OK during grace"
  step passes.
- **Perf**: the gate reuses `actor.role` when the actor is the owner (the common case),
  avoiding a redundant user lookup; only non-owner actors trigger `userModel.findById`.
  The remaining cost is one `checkEligibility` query per non-admin accommodation update —
  acceptable (updates are not a hot path).

Tested: 7 gate unit tests (`update-publish-routing.test.ts`), 6 added predicate tests for
the `cancelled` case, plus the three e2e specs. This expands SPEC-217 beyond the publish
path into the general accommodation write path — recorded here so the scope is explicit.

### 5.3 Group B — wire `applyTestControl` into the MP adapter

In `packages/billing/src/adapters/mercadopago.ts`, wrap the adapter returned by
`createMercadoPagoAdapter()` so each `ControllableOperation` method routes through
`applyTestControl(operation, args, () => realAdapter.method(args))`. Requires building the
**operation-name → adapter-method map** (currently undocumented — derive from
`@qazuor/qzpay-core` and the `ControllableOperation` enum in `qzpay-test-control.ts`).
Wrapping must be a no-op when `isTestControlEnabled()` is false (zero overhead in prod).

### 5.4 CI enablement

Add `HOSPEDA_QZPAY_TEST_CONTROL_ENABLED: 'true'` to `.github/workflows/e2e-pr.yml` (OQ-3
decided: PR P0 suite). Group A needs **no** env flag once 5.1 lands. The route gate
already requires `NODE_ENV !== 'production'`, satisfied in CI.

### 5.5 Layers touched

- `apps/e2e/fixtures/db-helpers.ts` (Group A helpers), the three Group A specs, the three
  Group B specs (remove/relax skip guards).
- `packages/billing/src/adapters/mercadopago.ts` (Group B wiring),
  `packages/billing/src/adapters/qzpay-test-control.ts` (op map, if needed).
- Possibly `packages/service-core/.../accommodation-publish-deps.ts` (only if OQ-1
  resolves to "fix checkEligibility").
- `.github/workflows/e2e-pr.yml` (and maybe `e2e-nightly.yml`).

## 6. Dependencies

- `@qazuor/qzpay-core` adapter method surface (for the op map). External package — read
  its types; do not modify.
- The billing crons (`trial-expiry`, `finalize-cancelled-subs`) as the source of truth
  for terminal statuses.

## 7. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Group A helper sets a status the cron never produces → test validates a fiction | AC-1.4 + assert target status ∈ cron's output set |
| Op-name→method map wrong → faults inject on wrong operation or not at all | Unit test per `ControllableOperation`: queue fault, call adapter method, assert interception |
| OQ-1 turns out to be a real prod bug | Scope decision: fix here or spin a follow-up spec, never ship Group A on top of a known-wrong gate silently |
| `applyTestControl` wrapper adds prod overhead | Guard wrap behind `isTestControlEnabled()`; benchmark no-op path |
| Group B in PR suite adds flakiness/time | Fault injection is deterministic (in-memory queue); Phase 4 3× green-run soak before trusting; easy to move to nightly if it flakes |

## 8. Testing strategy (no tests = not done)

- The six specs themselves are the integration coverage; "done" = they pass un-skipped,
  3 consecutive green runs.
- Unit test for the `applyTestControl` op map (one case per `ControllableOperation`).
- Unit/assertion that Group A helper target statuses match cron output.
- A regression guard that fails CI if any of the six specs is `test.fixme`/`test.skip`
  again without an explicit documented precondition.

## 9. Implementation approach (phases)

- **Phase 1 — Investigate & decide.** Terminal statuses already confirmed (trial-expiry →
  `cancelled`, finalize-cancelled-subs → `cancelled`). Remaining: confirm the trial grace
  value (OQ-1 sub-decision); locate the entitlement middleware's 6h cron-lag grace check
  and decide the shared "is-sub-live" predicate extraction shape; build the
  op-name→method map from qzpay-core (Group B). Output: decisions recorded here.
- **Phase 2 — Group A + gate fix.** Make `checkEligibility` date-aware (§5.2.1) via the
  shared predicate; first verify host-04/07b pass simply by un-gating (they already set
  `status='cancelled'`); fix host-03 helper (backdate `trial_end`, keep `status='trialing'`)
  so the now-date-aware gate blocks it; un-skip host-03/04/07b. Add a service-core unit
  test for the date-aware gate (active/trialing × within-grace/past-grace). Land first —
  higher-value, lower-risk, no env flag. Closes the prod gap (G4).
- **Phase 3 — Group B.** Wire `applyTestControl` + op map + unit tests; un-skip
  host-07c/07d/res-01; add CI env flag in the chosen suite.
- **Phase 4 — Polish.** Rewrite skip comments/messages (US-3); add the no-silent-skip
  regression guard; 3× green-run soak.

## 10. Open questions (require decision before/within Phase 1)

- **OQ-1 (product) — DECIDED 1a (2026-06-11): fix the gate in this spec (§5.2.1).** The
  gap is real — `checkEligibility` is date-blind, opening a ~0-24h window where an
  expired-trial host (`trial_end < now`, `status='trialing'`) can publish before the
  daily 2 AM `trial-expiry` cron flips status to `'cancelled'`. Not documented grace.
  **Sub-decision DECIDED**: trial grace = the existing 6h cron-lag grace
  (`BILLING_CRON_LAG_GRACE_HOURS`), reused (not a new constant), applied uniformly to
  `trial_end` and `current_period_end`. An expired trial can publish at most 6h past
  expiry.
- **OQ-2 (approach) — RESOLVED as a consequence of 1a.** With a date-aware gate, Group A
  needs only the "faithful helper" (A1): helpers set the terminal status + backdate the
  date column, and the gate blocks on the date. No real-cron invocation (A2) needed.
  host-04/07b already set `status='cancelled'`; host-03 keeps `status='trialing'` +
  backdated `trial_end`.
- **OQ-3 (CI placement) — DECIDED (2026-06-11): PR P0 suite.** Group B runs in the PR P0
  suite (`e2e-pr.yml` gets `HOSPEDA_QZPAY_TEST_CONTROL_ENABLED: 'true'`). Rationale:
  test-control fault injection is deterministic (in-memory queue, not real network
  timing), so the usual flakiness concern with gating tests barely applies; and it avoids
  depending on the currently-disabled nightly. Residual risk covered by the Phase 4 3×
  green-run soak.

**All open questions resolved — spec ready for task generation.**

## 11. Internal review notes

- The original premise ("wire the test-control adapter so the paywall specs run") was
  only half right: Group B needs the wiring; Group A needs deterministic **state**, not
  fault injection. Spec scoped accordingly.
- Forensic trail (three divergent test versions across staging/branches, the green-run
  results.json, the checkEligibility/entitlement split) lives in engram
  `e2e/billing-paywall-gating`. Do not re-derive — read it first.
