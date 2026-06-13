---
specId: SPEC-221
title: QZPay Test-Control Hardening & Deferred E2E Coverage
slug: qzpay-test-control-hardening
type: test
complexity: low
status: completed
owner: qazuor
created: 2026-06-13
base: staging
tags:
  - e2e
  - billing
  - qzpay
  - test-control
  - follow-up
relatedSpecs:
  - SPEC-217
  - SPEC-092
  - SPEC-143
linearIssues: []
---

# SPEC-221 — QZPay Test-Control Hardening & Deferred E2E Coverage

## 1. Origin

Follow-up findings surfaced during SPEC-217 (PR #1586, merged to staging at
`4f374036a`). SPEC-217 wired the QZPay test-control adapter so the gated paywall E2E
specs run deterministically in CI, and closed two parallel-execution blockers. The
adversarial review of that PR surfaced three residual items that were intentionally
left out of SPEC-217's scope to keep it shippable. This spec captures them so they
are not lost.

None of these block production. They are test-infrastructure robustness and coverage
items.

## 2. Findings to address

### F-1 — Scope `delayNextQueue` by ownerId (latent parallel contamination)

SPEC-217 fixed cross-worker contamination of the **failure** queue by scoping
`failNext` entries by `ownerId` (see `packages/billing/src/adapters/qzpay-test-control.ts`,
`extractScope` + the operation+scope match in `applyTestControl`). The **delay** queue
(`delayNextQueue`) is still keyed by operation only, so any future E2E spec that arms
`delayNext` under the 4-worker CI matrix will hit exactly the same cross-worker
contamination that `failNext` just escaped.

- **Where**: `packages/billing/src/adapters/qzpay-test-control.ts` (`delayNextQueue`,
  `delayNext`, `applyTestControl`).
- **Fix shape**: mirror the `failNext` scoping — accept an optional `scope` on the
  delay entry, match operation + scope, with `scope === undefined` matching any caller
  (backward-compat). Thread `scope` through the `/delay-next` test route and the e2e
  fixture, same as `failNext`.
- **Trigger to prioritize**: the first new spec that needs a scoped `delayNext`. Until
  then it is latent (no current spec arms scoped delays).

### F-2 — Make `extractScope` extensible across all controllable operations

`extractScope(args)` today only understands the two arg shapes actually wired through
`applyTestControl`: an object with a string `ownerId` (`startTrial`) and a bare string
(`cancelTrial` = `subscriptionId`). The `ControllableOperation` union also lists five
operations that are **declared but not yet wired**: `createPaymentPreference`,
`capturePayment`, `refundPayment`, `cancelSubscription`, `updateSubscription`. When one
of those is wired and passes, e.g., `{ subscriptionId }` or `{ paymentId }` (no
`ownerId`), `extractScope` returns `undefined`, so a *scoped* entry silently fails to
match while an *unscoped* one matches any caller.

- **Where**: `packages/billing/src/adapters/qzpay-test-control.ts` (`extractScope`).
- **Fix shape**: document explicitly that `extractScope` only knows `ownerId` /
  string-arg shapes, and extend it (per-operation scope-key resolution) whenever a new
  operation is wired through `applyTestControl`. Add a unit case per newly-wired
  operation proving its scope key is extracted.

### F-3 — Complete the deferred host-07d E2E (SPEC-217 T-012)

SPEC-217 T-012 (`host-07d`) was deferred. It exercises the `updateSubscription`
failure path (partial-failure / compensation), which is covered today only by
service-core unit tests, not by a deterministic E2E. Completing it depends on F-1/F-2
if it needs scoped delay/failure on `updateSubscription`.

- **Where**: `apps/e2e/tests/host/host-07d-*.spec.ts` (deferred), the
  `updateSubscription` path in the QZPay adapter + `applyTestControl`.
- **Fix shape**: wire `updateSubscription` through `applyTestControl` with a correct
  scope key (F-2), add a scoped `failNext`/`delayNext` if needed (F-1), and un-defer the
  spec.

> **Finding during implementation (2026-06-13)**: `updateSubscription` (and
> `createPaymentPreference`, `capturePayment`, `refundPayment`, `cancelSubscription`)
> are declared in the `ControllableOperation` union and accepted by the test-control
> HTTP route, but are **NOT wired through `applyTestControl` in any production billing
> path** — only `startTrial` and `cancelTrial` are (`accommodation-publish-deps.ts`).
> So host-07d cannot inject a deterministic `updateSubscription` failure today: F-3
> first requires wiring the real subscription-update flow (plan-change / cancel) through
> `applyTestControl`, which is a **billing-CORE production change**, not test-infra, and
> falls outside this spec's "low-complexity, test-infra-only" scope. **Decision: F-3 is
> re-deferred** (AC-3 permits it). F-1 and F-2 — the actual hardening — ship in this spec.
>
> **Final disposition (2026-06-13)**: host-07d's underlying premise — a *synchronous,
> failable* `updateSubscription` inside the publish hot path — will NOT be built: there
> is no such operation today, and adding one purely to enable a test would be contrived
> production code (extra MP round-trip + 8s timeout on every first publish, zero user
> value). The post-trial compensation contract host-07d targeted is already covered by
> unit tests (`publish.test.ts`). The *legitimate* debugging need that motivated it
> (tracing a trial subscription back to its accommodation/owner) is addressed by
> **SPEC-227** (non-blocking observability of the trial↔accommodation↔owner↔checkout
> linkage via structured logs + Sentry, plus creation-time MP `external_reference` /
> metadata enrichment — no async MP update). host-07d stays `test.fixme` with this note.

## 3. Out of scope

- The SPEC-217 `publish()` visibility fix is DONE and not revisited here. The robust
  variant (promote only `PRIVATE` → `PUBLIC`, never clobber `RESTRICTED` or an explicit
  caller visibility) shipped in PR #1586 with regression tests.
- No production code paths change as a result of this spec beyond the test-control
  adapter and E2E suites.

## 4. Acceptance criteria (high level — to be atomized)

- **AC-1**: `delayNext` can be scoped by `ownerId`; an unscoped delay still matches any
  caller; a scoped delay is consumed only by the matching scope. Proven by a billing
  unit test analogous to `qzpay-test-control.scope.test.ts`.
- **AC-2**: `extractScope` has explicit per-operation scope-key handling (or a
  documented, tested fallback) for every `ControllableOperation` that is wired through
  `applyTestControl` at the time this spec lands.
- **AC-3**: `host-07d` runs deterministically in CI (no `.skip`), asserting the
  `updateSubscription` failure/compensation contract, OR is formally re-deferred with a
  documented reason if F-1/F-2 prove insufficient. → **RE-DEFERRED** (see the F-3
  finding above): `updateSubscription` is not wired through `applyTestControl` in any
  production path, so wiring it is billing-core work outside this spec's scope.

## 5. Status

- **F-1 (AC-1)**: DONE — `delayNext` scoped by ownerId/subscriptionId (array queue
  mirroring `failNext`), FIFO + scope match, unscoped matches any. Unit tests added in
  `packages/billing/test/qzpay-test-control.scope.test.ts` (cases d1-d3).
- **F-2 (AC-2)**: DONE — `extractScope` documented with an explicit extensibility note
  for the unwired operations; the documented `undefined` fallback is tested (case b2).
- **F-3 (AC-3)**: RE-DEFERRED → see the Final disposition above. host-07d's
  sync-`updateSubscription` premise is dropped (contrived prod code); the legitimate
  debugging need it gestured at moves to **SPEC-227** (non-blocking observability +
  creation-time MP enrichment). host-07d stays `test.fixme`.

SPEC-221 ships with F-1 + F-2 (PR #1586 era follow-up; merged to staging via PR #1602).

## 6. Notes

This is a low-complexity, test-infra-only spec. Detail and root-cause history live in the
SPEC-217 engram topic `spec/spec-217-qzpay-test-control-e2e-wiring/ci-fixes`.
