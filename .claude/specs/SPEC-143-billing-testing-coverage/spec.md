---
spec-id: SPEC-143
title: Billing Testing Coverage (e2e + manual smoke)
type: testing
complexity: high
status: in-progress
created: 2026-05-17T23:55:00Z
effort_estimate_hours: 50-65
tags: [billing, testing, e2e, mercadopago, smoke, observability, runbooks, go-live-gate]
extracted_from: SPEC-141 post-launch follow-ups (only unit tests with mocks, no e2e validation)
depends_on: []
blocks: [real-money-go-live]
first_allocated_via_engram_protocol: true
priority: high
worktree: /home/qazuor/projects/WEBS/hospeda-spec-143-billing-testing-coverage
branch: spec/SPEC-143-billing-testing-coverage
base: staging
---

# SPEC-143: Billing Testing Coverage (e2e + manual smoke)

## Context

SPEC-141 (Subscription post-launch follow-ups) merged via PR #1139 added unit-level coverage for the post-launch billing fixes, but two structural gaps remain:

1. **No e2e validation of real billing flows.** SPEC-141 only had unit tests with mocks. There is zero automated proof that, after a real checkout, the customer's entitlements actually load for the new plan, the webhook idempotency holds, the downgrade cron applies the queued change, or the addon credit is granted post-payment.

2. **Existing e2e billing infra is aspirational.** Files under `apps/api/test/e2e/flows/billing/*` have comments that describe full flows (`createCheckoutPreference`, `processWebhookActivation`, `triggerDowngradeCron`) but only GET endpoints are actually exercised. The infra to run real flows against a real Postgres + a stubbed MercadoPago provider does not exist yet.

This spec closes both gaps so real-money charging can begin with fundamented confidence rather than aspirational.

This spec was allocated through the engram-backed spec-registry protocol (CLAUDE.md § "Spec Number Allocation"). Number 143 was reserved on 2026-05-17 (engram observation #537) after the SPEC-141 collision was resolved by renumbering the draft design-token spec to SPEC-144 (engram #536, PR #1141).

## Goal

Provide automated + manual testing coverage over the full billing surface (checkout, webhook activation, plan-change, downgrade cron, addons, dunning, cancel/pause/resume, refunds, promo codes, sponsorships, customer overrides, admin ops, observability) so real-money production charging can begin with verified end-to-end correctness and operational visibility.

## Workstreams

- **A — E2E automated tests** (`vitest` e2e against real Postgres + MercadoPago stub). Runs in CI on every billing-touching PR.
- **B — Manual STAGING smoke checklists** (against real MercadoPago sandbox). Executed before merging any billing-touching PR.
- **C — Manual PROD smoke checklists** (abbreviated, safe, with rollback). Executed in a controlled window before go-live and on major releases.
- **D — Observability + Runbooks** (Sentry alerts for failed webhook handler / MP signature validation / cron job failure / dunning cron failure; ops runbooks for incident response; dashboards for billing health).

## Phases (priority = financial risk)

### Phase 1 — CRITICAL (blocks go-live with real money)

~12 flows. Workstream A + B + C.

Annual checkout, monthly checkout, plan upgrade with delta calculation, plan downgrade scheduling, downgrade cron execution, addon one-time purchase, webhook idempotency, webhook signature validation, failed payment webhook handler, subscription activation (annual + monthly), entitlement load post-activation.

### Phase 2 — HIGH

~12 flows. Workstream A + B.

Trial activation, trial expiration cron, trial → paid conversion, subscription cancel, subscription pause, subscription resume, dunning cron retry, addon expiration cron, addon cancel + price recalc, authorized payment (D4 flow), refund flow, dispute flow.

### Phase 3 — IMPORTANT

~15 primary flows + ~8 secondary auth/redirect flows. Workstream A + B + D.

Promo code apply/validate/expire, sponsorship grant/revoke, customer override apply/expire, entitlement cache hit/miss/invalidation/TTL, admin billing ops (list/customer-detail/subscription manual ops/addon manual ops), admin cron trigger, exchange rate cron, plus the D1..D8 secondary flows around auth, redirects, cancellation.

### Phase 4 — Polish

Workstream D complete, CI tuning, coverage gap analysis.

Runbooks, Sentry alerts, dashboards, coverage report verification against 80% target, CI parallelisation/time-budget tuning, MP test cards reference docs, e2e infrastructure design doc, mp-stub architecture doc.

## Decisions sealed (approved by user 2026-05-17 — engram #532)

These five decisions are part of the approved scope and not subject to re-litigation inside this spec:

1. **Stub vs sandbox in CI**: STUB MercadoPago in CI/automated tests via a `createMercadoPagoAdapter` factory returning canned responses. REAL MP sandbox is used only in manual staging checklists (Workstream B). CLAUDE.md rule to add as part of Phase 4: any billing-touching PR must execute the relevant manual checklist before merge.

2. **Coverage target**: 80% line coverage on:
   - `apps/api/src/services/*billing*`
   - `apps/api/src/routes/billing/*`
   - `apps/api/src/routes/webhooks/mercadopago/*`

3. **Go-live gate criteria** (agent recommendation, approved):
   - Phase 1 Workstream A complete (all ~12 critical flows green in CI).
   - Phase 1 Workstream B complete (manual staging checklists executed end-to-end and signed off by user).
   - Phase 1 Workstream C completed for at least 3 most critical flows (annual + monthly + addon one-time) with real prod credentials in a controlled window.
   - Sentry alerts configured for: failed payment webhook handler, MP signature validation failure, cron job failure, dunning cron failure.
   - One real prod smoke transaction (small charge by user) successful end-to-end.
   - Rollback procedure documented if any of the above fails post-go-live.

4. **Manual checklist executor**: user (qazuor) solo. No team yet.

5. **MP sandbox test users**: dedicated test users per flow type (clean-state user for resettable flows, persisted user for cross-flow accumulating state, etc.). Per-user assignment defined in `docs/staging-smoke-checklist.md` once the checklist is authored.

## Acceptance criteria

- [ ] **Infra**: `apps/api/.env.test` correct creds, `hospeda_test` schema pushed + postgres-extras applied, minimal seed (≥ 2 plans, monthly + annual prices), `mp-stub.ts` working, smoke "list plans" e2e green.
- [ ] **Phase 1 Workstream A**: all 12 critical flows green in CI (annual + monthly checkout, upgrade with delta, downgrade scheduling, downgrade cron, addon one-time, webhook idempotency, webhook signature validation, failed payment webhook, subscription activation × 2, entitlement load).
- [ ] **Phase 1 Workstream B**: `docs/staging-smoke-checklist.md` authored AND executed end-to-end against MP sandbox; user signs off.
- [ ] **Phase 1 Workstream C**: `docs/prod-smoke-checklist.md` authored with rollback procedure AND executed for annual + monthly + addon (3 flows) on real prod with small charges; user signs off.
- [ ] **Phase 2 Workstream A**: 12 high-priority flows green in CI.
- [ ] **Phase 2 Workstream B**: relevant staging checklist sections executed + signed off.
- [ ] **Phase 3 Workstream A**: 15 + 8 flows green in CI.
- [ ] **Phase 3 Workstream B**: relevant staging checklist sections executed + signed off.
- [ ] **Phase 3 Workstream D (partial)**: observability noise for promo / sponsorship / override edge cases captured in Sentry filters.
- [ ] **Phase 4 Workstream D**: 4 Sentry alerts active, billing health dashboard live, billing-runbooks.md complete, MP test cards reference doc complete, CLAUDE.md rule added.
- [ ] **Coverage**: 80% line coverage on the 3 target directories, verified via `vitest --coverage` and reported in the final task.

## Out of scope

- Refactor of existing billing code (this spec is coverage-only — bugs surfaced may produce follow-up specs).
- Provider change (stays QZPay + MercadoPago).
- DB schema migrations.
- Perf/load tests (future spec).
- Beta tester ops (handled in beta-doc specs).

## Deliverables structure

```
.claude/specs/SPEC-143-billing-testing-coverage/
├── spec.md                                 (this file)
├── metadata.json
└── docs/
    ├── e2e-infrastructure-design.md        (Phase 4)
    ├── mp-stub-architecture.md             (Phase 4)
    ├── staging-smoke-checklist.md          (Workstream B, Phase 1)
    ├── prod-smoke-checklist.md             (Workstream C, Phase 1)
    ├── billing-runbooks.md                 (Workstream D, Phase 4)
    └── mp-test-cards-reference.md          (Phase 4)

.claude/tasks/SPEC-143-billing-testing-coverage/
├── state.json
└── progress.md                             (created lazily as work lands)

apps/api/test/e2e/
├── helpers/
│   ├── mp-stub.ts                          (NEW — stub factory)
│   ├── billing-fixtures.ts                 (NEW — test data)
│   └── billing-factories.ts                (NEW — DB factories)
└── flows/billing/
    ├── annual-checkout.test.ts             (Phase 1)
    ├── monthly-checkout.test.ts            (Phase 1)
    ├── plan-upgrade.test.ts                (Phase 1)
    ├── plan-downgrade.test.ts              (Phase 1)
    ├── downgrade-cron.test.ts              (Phase 1)
    ├── addon-purchase.test.ts              (Phase 1)
    ├── webhook-idempotency.test.ts         (Phase 1)
    ├── webhook-signature.test.ts           (Phase 1)
    ├── webhook-failed-payment.test.ts      (Phase 1)
    ├── subscription-activation.test.ts     (Phase 1)
    ├── entitlement-load.test.ts            (Phase 1)
    ├── trial-lifecycle.test.ts             (Phase 2)
    ├── subscription-cancel.test.ts         (Phase 2)
    ├── subscription-pause-resume.test.ts   (Phase 2)
    ├── dunning-cron.test.ts                (Phase 2)
    ├── addon-expiration-cron.test.ts       (Phase 2)
    ├── addon-cancel-recalc.test.ts         (Phase 2)
    ├── authorized-payment.test.ts          (Phase 2)
    ├── refund.test.ts                      (Phase 2)
    ├── dispute.test.ts                     (Phase 2)
    ├── promo-code.test.ts                  (Phase 3)
    ├── sponsorship.test.ts                 (Phase 3)
    ├── customer-override.test.ts           (Phase 3)
    ├── entitlement-cache.test.ts           (Phase 3)
    ├── admin-billing-ops.test.ts           (Phase 3)
    ├── exchange-rate-cron.test.ts          (Phase 3)
    └── auth-redirect-cancel-flows.test.ts  (Phase 3, D1..D8 secondary)
```

## Risks

| Risk | Mitigation |
|---|---|
| MP stub diverges from real MP responses, producing false-green CI | Workstream B (staging smoke against real sandbox) is mandatory on every billing PR. The CLAUDE.md rule (Phase 4) enforces this. |
| 50-65h estimate slips under real exploration | Phases are independently shippable. Phase 1 closure alone unblocks go-live; later phases can land iteratively. |
| Coverage target too strict for some areas | If 80% is unreachable on a specific file due to defensive code paths, document the exception in the final task and exclude with `/* istanbul ignore */` comments. Do NOT lower the global target. |
| Real prod smoke transaction (Phase 1 C go-live gate) fails | Rollback procedure documented in `docs/prod-smoke-checklist.md` is the safety net. Spec does NOT close without this artifact. |
| Schema drift between `hospeda_test` and `hospeda` (dev) | `apps/api/.env.test` + `hospeda_test` push will be re-run on every schema change via a CI step (Phase 4 polish) or documented as a manual step. |

## Workflow conventions

- **Branch**: `spec/SPEC-143-billing-testing-coverage` from `staging`. PR targets `staging`.
- **Commits**: Conventional Commits; one commit per user-OK'd unit of work. NO `Co-Authored-By` lines.
- **Quality gate**: typecheck + lint + vitest unit green; new e2e flows must run locally with `pnpm --filter hospeda-api test:e2e` against `hospeda_test`.
- **MP stub**: implemented via the existing `createMercadoPagoAdapter` factory pattern. Stubbed responses live in `apps/api/test/e2e/helpers/mp-stub.ts`.
- **Manual smoke artifacts**: each executed checklist run is captured in `docs/staging-smoke-checklist.md` (Workstream B) and `docs/prod-smoke-checklist.md` (Workstream C) with date, executor, results.

## Related

- engram `spec/spec-143/proposal` (#532) — approved scope (canonical)
- engram `spec/spec-143/reserved` (#537) — formal reservation
- engram `spec/spec-141/collision-resolved` (#536) — collision context that freed 143
- engram `spec-registry/hospeda/allocations` — registry source of truth
- engram `gotcha_mercadopago_credentials` — APP_USR- prefix applies to both test and prod tokens
- engram `gotcha_mercadopago_test_credentials_architecture` — test-user tokens cannot call `/v1/customers`; affects sandbox flow design
- SPEC-141 (completed) — predecessor that closed unit gaps but left e2e gaps
- SPEC-109 (open) — MercadoPago production readiness (separate concern, but go-live gate intersects)
- SPEC-121 (in-progress) — E2E MP secrets + nightly suite reactivation (separate suite at `apps/e2e/`, NOT this spec's `apps/api/test/e2e/`)
- `apps/api/test/e2e/` — target directory for Workstream A artifacts
- `packages/billing/` — service code under test
- `apps/api/src/routes/billing/`, `apps/api/src/routes/webhooks/mercadopago/` — route code under test
