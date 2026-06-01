---
spec-id: SPEC-122
title: Production-Ready Billing — Master Plan
type: epic
complexity: high
status: draft
created: 2026-05-15T00:00:00Z
effort_estimate_hours: 60-100
tags: [billing, mercadopago, qzpay, subscriptions, preapproval, addons, promo-codes, master-plan]
children: [SPEC-123, SPEC-124, SPEC-125, SPEC-126, SPEC-127, SPEC-128]
depends_on: [SPEC-109]
priority: high (pre-beta critical path)
first_allocated_via_engram_protocol: true
---

# SPEC-122: Production-Ready Billing — Master Plan

## Context

Hospeda is pre-beta. The billing system is the part of the product that absolutely cannot ship broken — it touches money, accounting, and user trust. Two exhaustive audits (qzpay library + Hospeda billing layer, 2026-05-15) revealed that the recurring subscription flow is not just incomplete: it is unwired end-to-end. The qzpay MercadoPago subscription adapter is dead code, the local DB column that links to MP preapprovals is never populated, and the webhook handler that processes subscription updates always falls through "no local subscription found".

This master plan captures the full set of changes required to take the billing system from "addons work, trials work, recurring subs are a stub" to "robust production-ready billing across all required surfaces". It is split into 6 phase-specific children specs so each phase is reviewable and shippable independently.

The original SPEC-109 (MercadoPago Production Readiness) Phase 1 has shipped its 4 code-hardening commits in PR #1102 to staging. SPEC-109 stays open for Phases 3-7 (Coolify env, prod toggle, homologation), which run AFTER SPEC-122 closes. This spec supersedes the original SPEC-109 Phase 2 (qzpay audit) and reshapes its remaining acceptance criteria.

## User-facing capabilities the system must support

1. **Trial subscription without card on file** (HOST signup → 14 days free, no payment data required).
2. **Monthly recurring paid subscription** (trial conversion or direct paid signup).
3. **Annual paid subscription with discount applied upfront** (one-time charge for 12 months, no auto-renewal).
4. **Plan changes mid-cycle** (upgrade with prorated one-time charge; downgrade applied at next period end).
5. **Cancellation** (immediate by user request; access until period end).
6. **One-time addon purchases** (already working post SPEC-109 Phase 1).
7. **Promo codes** on one-time payments (% discount, fixed-amount discount, validity windows, usage caps) AND as `free_trial` extension on monthly preapproval.
8. **Sandbox** with MP test cards for QA.
9. **Webhook-driven entitlement/limit application** (everything is post-payment, post-MP-confirmation).
10. **Dunning observation** (MP retries failed charges natively; Hospeda observes via webhooks and notifies the user, no custom retry cron in MVP).

## Out of scope for MVP (deferred post-launch)

- Custom dunning with saved-card retry logic (MP handles natively).
- Promo codes that apply % off or fixed-amount to monthly recurring charges (only `free_trial` extension is supported on monthly).
- Marketplace / split payments (already dead code in qzpay).
- Multi-currency (only ARS).
- 3DS challenge custom flow (MP handles transparently in their hosted checkout).
- Fixed-amount discount type on promo codes (only % off in MVP; can be added later).
- Multi-trial per user (one trial per user account, regardless of plan).

## Architecture decisions (12 total)

Captured in engram with topic_key `spec/spec-122/master-plan-decisions`. Summary:

| # | Decision | Implication |
|---|----------|-------------|
| 1 | Monthly recurring → MP Preapproval (native recurring) | MP holds card + charges; Hospeda only listens to webhooks |
| 2 | Annual → One-time Checkout Pro for full annual amount | No preapproval, no auto-renew; user prompted to renew at expiry |
| 3 | Trial → paid via D-3/D-1 reminder emails with CTA | Trial stays card-free; user pre-emptively starts preapproval before expiry |
| 4 | Promo codes: % off on one-time + free_trial extension on monthly | No % off on recurring charges |
| 5 | Plan changes: MP preapproval.update for amount + one-time prorated charge | Upgrade is two MP operations; downgrade is one |
| 6 | Out of MVP: custom dunning, promo on monthly recurring, marketplace, multi-currency, 3DS custom | See "Out of scope" above |
| 7 | qzpay holds generic billing primitives; Hospeda holds business domain | Library reusable for other projects |
| 8 | Migrate addon.checkout.ts to use qzpay's checkout adapter | After SPEC-125 ships, remove direct mercadopago SDK usage from apps/api |
| Sub-1 | MP preapprovals in ad-hoc mode (no preapproval_plan_id) | More flexible for free_trial extension promo |
| Sub-2 | Abandoned pending_provider subs expire after 30min (hourly cron) | User can retry from plan picker |
| Sub-3 | Upgrade proration → one-time Checkout Pro charge for delta, then preapproval.update for next month | Charge is visible and traceable in MP dashboard |
| Sub-4 | Return UX from MP → poll loader until webhook confirms | Avoids "optimistic success then webhook never arrives" trap |

## Target architecture

```
                    ┌────────────────────────────────────┐
                    │  Hospeda apps/api routes            │
                    │  - /trial/start (auto on signup)    │
                    │  - /subscriptions/start-paid        │  NUEVO en SPEC-126
                    │  - /subscriptions/change-plan       │  EXTENDIDO en SPEC-126
                    │  - /subscriptions/:id/status        │  NUEVO en SPEC-126
                    │  - /addons/purchase                 │  REFACTOR en SPEC-127
                    │  - /promo-apply                     │
                    └─────────────┬──────────────────────┘
                                  │
                    ┌─────────────▼──────────────────────┐
                    │  qzpay-core billing service        │
                    │  - subscriptions.create()          │  SPEC-124: mode='paid' invokes adapter
                    │  - subscriptions.update()          │  SPEC-124: propagates amount to MP
                    │  - subscriptions.linkProviderId    │  SPEC-124: nuevo
                    │  - checkout.create()               │  SPEC-125: enriquecido
                    │  - promoCodes.atomicRedeem()       │  SPEC-123: nuevo (race-safe)
                    └─────────────┬──────────────────────┘
                                  │
                    ┌─────────────▼──────────────────────┐
                    │  qzpay-mercadopago adapter         │
                    │  - subscription.create()           │  SPEC-124: full quality fields + idempotency + free_trial
                    │  - subscription.update()           │  SPEC-124: amount change
                    │  - checkout.create()               │  SPEC-125: category_id, payer fields, idempotency, descriptor
                    │  - payment.create()                │  SPEC-123: FIX idempotency key fuera del retry
                    │  - webhook.verifySignature()       │  SPEC-123: fail-closed config-aware
                    └─────────────┬──────────────────────┘
                                  │
                                  ▼
                           [ MercadoPago ]
                                  │
                                  ▼ webhooks
                    ┌──────────────────────────────────────┐
                    │  /api/v1/webhooks/mercadopago        │
                    │  - payment.*                          │  existing
                    │  - subscription_preapproval.created   │  SPEC-126: NUEVO — link mp_sub_id ↔ local
                    │  - subscription_preapproval.updated   │  EXISTE — ahora SÍ encuentra match
                    │  - subscription_authorized_payment.created  │  SPEC-126: NUEVO — process recurring charge
                    └──────────────────────────────────────┘
```

## Phased execution plan

```
[SPEC-109 Phase 1 — DONE in PR #1102]
   ↓ merge to staging
[SPEC-123] qzpay foundation fixes ──┐
[SPEC-125] qzpay checkout parity   ─┤── bundled in 1 PR to qzpay
                                    │
                                    ├──► [SPEC-124] qzpay subscription preapproval wire-up (PR to qzpay)
                                    │       ↓ qzpay version bumped in Hospeda
                                    └──► [SPEC-126] Hospeda subscription flow real
                                              ↓
                                         [SPEC-127] migrate addon.checkout to qzpay
                                              ↓
                                         [SPEC-128] cleanup + smoke + runbook
                                              ↓
                                   close SPEC-122 master
                                              ↓
                              [continue SPEC-109 Phases 3-7]
                              env vars Coolify → smoke staging → prod toggle → homologation
```

**Execution order rationale**:
- **SPEC-123 + SPEC-125 first** (bundled in one PR to qzpay): both are safe, isolated, additive, no breaking changes. Build confidence + unblock SPEC-127.
- **SPEC-124 second**: the core feature work. Bigger PR. Breaking-ish but backwards-compat preserved via opt-in `mode` parameter.
- **SPEC-126 third**: depends on SPEC-124 in qzpay being merged + published to npm. Hospeda bumps the dep and implements the real flow.
- **SPEC-127 fourth**: depends on SPEC-125. Refactor only after the qzpay checkout adapter is production-ready.
- **SPEC-128 last**: cleanup + smoke validation + ops runbook. Closes the master spec.

## Operator pre-requisites (not code work — these block testing)

1. **MercadoPago merchant account**: KYC complete, CBU registered for receiving payments.
2. **MP webhook configuration** in the developer panel: ensure ALL of these topics deliver to `https://api.hospeda.com.ar/api/v1/webhooks/mercadopago`:
   - `payment` (already configured for addon checkout)
   - `subscription_preapproval` (NEW — required for preapproval lifecycle)
   - `subscription_authorized_payment` (NEW — required for each successful monthly charge)
3. **MP test users**: 1 seller + 2 buyers in the MP developer panel for sandbox smoke testing.
4. **Test cards documented**: MP Argentina test cards (Master 5031, Visa 4509, Amex 3711, etc.).
5. **`HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET`** set in Coolify (both staging and prod) — SPEC-109 Phase 1 made this required in prod.

## Acceptance criteria for the master spec

The master closes when ALL of the following are true:

- [x] SPEC-123 closed (qzpay foundation fixes merged + published) — qzpay 1.4-1.6, drift fix 2026-05-17
- [x] SPEC-124 closed (qzpay subscription preapproval wire-up merged + published) — qzpay 1.6+, drift fix 2026-05-17
- [x] SPEC-125 closed (qzpay checkout adapter parity merged + published) — qzpay 1.6+, drift fix 2026-05-17
- [x] SPEC-126 closed (Hospeda subscription flow merged to staging) — PR #1115 (2026-05-16)
- [ ] SPEC-127 closed (addon.checkout migrated to qzpay path, mercadopago SDK no longer a direct dependency of apps/api)
- [ ] SPEC-128 closed (dead code removed, E2E smoke passing, runbook published)
- [ ] All 10 user-facing capabilities (above) verified end-to-end against MP sandbox
- [ ] Hospeda is ready to start SPEC-109 Phases 3-7 (Coolify env, staging smoke, prod toggle, MP homologation)

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| qzpay version bumps in Hospeda break unrelated billing code | Use changesets in qzpay so each phase ships its own version; Hospeda bumps incrementally |
| Mid-implementation we discover a decision needs to change | Update `spec/spec-122/master-plan-decisions` engram observation; update relevant child specs; document in their status field |
| MP webhook event types not configured in panel | Operator pre-requisite #2 above; document in SPEC-128 runbook |
| Test user credentials exhausted during smoke testing | SPEC-128 runbook documents how to create additional test users |
| qzpay breaking changes to consumers other than Hospeda | qzpay is internal-use today; if another consumer appears, coordinate via semver and changesets |

## Engram references

- `spec/spec-122/master-plan-decisions` — the 12 product/architecture decisions
- `spec/spec-122/audit-summary` — consolidated findings from the two parallel audits
- `spec-registry/hospeda/allocations` — SPEC numbers 122-128 reservation
- `spec/spec-109/state` — kickoff of the bridge spec; SPEC-109 Phase 1 merge unblocks SPEC-122 start
- `gotcha_mercadopago_credentials` — APP_USR- vs (nonexistent) TEST- prefix
- `gotcha_mercadopago_test_credentials_architecture` — test user token limitations
