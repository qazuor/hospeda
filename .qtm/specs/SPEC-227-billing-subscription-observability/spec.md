---
specId: SPEC-227
title: Billing Subscription Observability — trial↔accommodation↔owner linkage logging + creation-time MP reference enrichment
slug: billing-subscription-observability
type: feat
complexity: low
status: completed
owner: qazuor
created: 2026-06-13
base: staging
tags:
  - billing
  - observability
  - sentry
  - logging
  - mercadopago
  - subscriptions
relatedSpecs:
  - SPEC-221
  - SPEC-217
  - SPEC-143
  - SPEC-180
linearIssues: []
---

# SPEC-227 — Billing Subscription Observability

## 1. Origin

Reshaped from SPEC-221's F-3. SPEC-221 explored wiring `updateSubscription` through the
QZPay test-control adapter to enable the deferred `host-07d` E2E. Investigation showed
there is **no synchronous, failable `updateSubscription` in the publish flow**, and
adding one purely to enable a test would be contrived production code (an extra
MercadoPago round-trip + 8s timeout on every first publish, for zero user value). That
path was dropped.

But it surfaced a **legitimate need**: when something goes wrong with a host's trial
subscription, you want to trace it back to the accommodation/owner that triggered it —
fast, from where you actually debug. This spec delivers that, **without any async MP
update and without touching the publish hot path's latency profile**.

## 2. Background (current state)

- The publish flow creates a trial subscription per **owner** (not per accommodation)
  via `startTrial({ ownerId })` (`apps/api/src/services/accommodation-publish-deps.ts`).
- MercadoPago subscriptions/payments already carry an `external_reference` = the local
  checkout-session UUID assigned by the qzpay-core orchestrator
  (`apps/api/src/services/subscription-checkout.service.ts:~612`), which traces MP → local
  DB → customer → owner. So the **owner linkage already exists** MP-side.
- What is awkward today: there is no single, searchable place that ties a given trial
  `subscriptionId` to the **accommodation** that triggered it and the **owner**, at the
  moment of publish. Debugging requires manual multi-table joins.

## 3. Scope — two non-blocking parts

### Part 1 — Structured logging + Sentry context (primary value)

At publish/trial time, emit a single structured log line + Sentry context (breadcrumb /
tag) that ties together the full linkage:

- `subscriptionId` (trial subscription created by `startTrial`)
- `accommodationId` (the accommodation being published)
- `ownerId`
- `checkoutId` / `external_reference` (if available at that point)
- plan slug / eligibility outcome (`first_publish` etc.)

Goal: searching the observability stack (logs / Sentry) by ANY of these ids surfaces the
whole linkage. This is where debugging actually happens, costs zero MP calls, and works
even though the trial is per-owner. Use `@repo/logger` (never `console.log`) and the
existing Sentry setup; respect SPEC-180 (Sentry hardening) conventions if landed.

### Part 2 — Creation-time MP `external_reference` / metadata enrichment

Enrich what is written to MercadoPago **at subscription creation** (NOT via a follow-up
update). If we want extra MP-side context (e.g. an environment marker, or correlation
fields beyond the checkout UUID), add it to the `external_reference` / `metadata` payload
when the subscription/preapproval is created in the checkout/trial path. This is the
canonical MP pattern, adds no extra API call, and no new failure surface.

> Constraint: trials are **per-owner**, so do NOT pretend a subscription belongs to a
> single accommodation. Any accommodation context in MP metadata is informational
> ("triggered by accommodation X") and must be clearly labelled as such, or omitted if it
> would mislead reconciliation.

## 4. Out of scope (hard constraints)

- **No async/follow-up `subscriptions.update`** to "tag for debugging" — explicitly
  rejected: duplicates the existing `external_reference` linkage at the cost of an extra
  MP call, a failure surface, and a queue/cron. The whole point of reshaping F-3.
- **No change to publish latency / blocking behaviour.** Part 1 is logging only; Part 2
  rides the existing creation call. Neither adds a synchronous remote round-trip to the
  publish hot path.
- **host-07d stays `test.fixme`** — this spec does not resurrect the sync-updateSubscription
  E2E premise.

## 5. Acceptance criteria (high level — to be atomized)

- **AC-1**: At first publish, a single structured log entry (via `@repo/logger`) records
  `{ subscriptionId, accommodationId, ownerId, checkoutId?, planSlug }`. Verified by a
  unit/integration test asserting the log payload shape.
- **AC-2**: Sentry receives the same linkage as context (tag/breadcrumb) on the publish
  path, so an error during/after publish carries the linkage. Verified by a test asserting
  the Sentry scope enrichment (mock the Sentry client).
- **AC-3**: The MP subscription creation payload includes the agreed enrichment in
  `external_reference` / `metadata` at creation time; no new MP call is added. Verified by
  a unit test on the creation payload builder.
- **AC-4**: No regression to the publish flow's control flow, timing, or compensation
  semantics — existing `publish.test.ts` stays green; no new synchronous remote call in
  the publish hot path.

## 6. Open questions — RESOLVED

- **OQ-1** (Part 2 field set) → **RESOLVED**: environment marker + `triggeredByAccommodationId`
  in the MP `metadata` at creation. The accommodationId is referential ("triggered by"),
  labelled as such since trials are per-owner. (User decision, 2026-06-13.)
- **OQ-2** (Sentry convention) → **RESOLVED**: reused the existing API Sentry context API
  (`Sentry.setContext`/`setTag`/`addBreadcrumb` via a new `addPublishLinkageContext` helper
  in `apps/api/src/lib/sentry.ts`, mirroring `setBillingContext`). Per-request scope
  isolation is provided automatically by `@sentry/node` httpIntegration + AsyncLocalStorage
  (verified — no cross-request leak). The env marker reuses `HOSPEDA_SENTRY_ENVIRONMENT ??
  NODE_ENV` (no new env var).
- **OQ-3** (PII) → **RESOLVED**: only the env marker + the internal accommodation UUID go to
  MercadoPago. No names/emails/personal data; a test guards metadata keys against `name`/`email`.

## 7. Implementation status (DONE — pending PR/merge)

- **Part 1 / AC-1 + AC-2**: structured linkage log in `accommodation.service.ts publish()`
  (`@repo/logger`) + Sentry context in `accommodation-publish-deps.ts` via
  `addPublishLinkageContext`. `accommodationId` threaded through
  `AccommodationPublishDeps.startTrial({ ownerId, accommodationId })`.
- **Part 2 / AC-3**: `triggeredByAccommodationId` + `environment` added to the trial
  subscription `metadata` AT creation (`trial.service.ts`), riding the existing
  `subscriptions.create` — no async update, no new MP call. `accommodationId` optional in
  `StartTrialInput` (auto-start-on-registration path omits it).
- **AC-4**: publish control-flow / compensation untouched; existing `publish.test.ts` green.
- Adversarial review: GO, no Critical/High/Medium findings.

## 7. Notes

Low-complexity, observability-first. Detail and the decision trail that produced this spec
live in the engram topic `spec/SPEC-221-qzpay-test-control-hardening/active` and the
SPEC-221 F-3 final disposition.
