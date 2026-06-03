---
spec-id: SPEC-193
title: Billing Go-Live Readiness — Master
type: epic
complexity: high
status: draft
created: 2026-06-03T00:00:00Z
effort_estimate_hours: 200-280
tags: [billing, master-plan, go-live, entitlements, lifecycle, enforcement, observability, catalog, multi-currency]
children: [SPEC-145, SPEC-147, SPEC-148, SPEC-149, SPEC-150, SPEC-167, SPEC-192, SPEC-194, SPEC-127, SPEC-128, SPEC-131]
relates_to: [SPEC-122, SPEC-143, SPEC-168, SPEC-109]
blocks: [real-money-go-live]
priority: high (pre-go-live critical path)
first_allocated_via_engram_protocol: true
worktree: null
branch: null
base: staging
---

# SPEC-193: Billing Go-Live Readiness — Master

> Parent tracking spec for **all remaining work to close the billing system for real-money production**.
> Created 2026-06-03 after a full audit of 11 billing specs against the codebase. This master organizes
> the children, fixes scope overlaps, defines the execution order, the cross-cutting invariants, and the
> go-live acceptance criteria. It does NOT re-specify the children — each child owns its own detail.

## 1. Why this exists

There are two prior master efforts in billing:

- **SPEC-122** (2026-05-15) — "Production-Ready Billing — Master Plan" — took recurring subscriptions from
  dead code to working end-to-end. Children SPEC-123/124/125/126 are **closed**; SPEC-127/128 remain open.
  122 was scoped to *wiring the recurring flow*; it is **historical** and closes when 127/128 close.
- **SPEC-143** (testing) — built the billing e2e harness (mp-stub, billing-factories, withRollback/clean)
  and tested the *existing* flows. Surfaced ~20 enforcement and lifecycle gaps that became new specs.

Since then, billing work fragmented into ~9 new specs with **overlapping scopes, one product conflict,
a duplicated ADR, a shared bug, and ~18 ownerless lifecycle bugs**. This master is the single place that
says: what each spec owns, in what order, against which invariants, and what "billing is done" means.

It supersedes nothing in 122; it is the **go-live umbrella** that 122's closure feeds into.

## 2. Product & organization decisions (resolved 2026-06-03)

| # | Decision | Owner-confirmed |
|---|----------|-----------------|
| O-1 | New master (this spec, 193); 122 stays historical and closes with 127/128 | yes |
| O-2 | **Downgrade over-limit policy = grandfather + restrict** (industry standard): no hard-block of the downgrade; premium content (rich text, video, extra photos) is grandfathered but read-only for new edits; published listings over the new cap move to a restricted state on apply (auto-unpublished/locked, reversible on re-upgrade, host chooses which to keep); creating/publishing new over the cap is blocked. | yes |
| O-3 | The ~18 ownerless lifecycle bugs get a dedicated spec (SPEC-194), not scattered | yes |
| O-4 | SPEC-145 reverts to **pure entitlement/limit enforcement** scope (it had been over-widened to end-to-end on 2026-06-03 and must not duplicate 149/167/192/194) | yes |
| O-5 | The billing-entitlement-and-limit catalog ADR is **single**, owned by SPEC-192 (not duplicated in 145) | yes |
| O-6 | Webhook error-handling / dead-letter gaps are owned by **SPEC-149** (not 145) | yes |
| O-7 | Multi-currency stays **post-MVP** (consistent with 122's out-of-scope) but is a tracked child (150) | yes |

## 3. The child map (who owns what — no overlap)

| Spec | Owns | Status | Reorg action |
|---|---|---|---|
| **SPEC-192** | Billing catalog → DB (addons catalog DB-backed, residual plan/promo reads to DB), the **single catalog ADR**, the **FR-4 plan-lookup bug** (`addon-entitlement.service.ts:160`, slug vs UUID post-168) | draft, ~10% | Confirm ownership of ADR + FR-4; cross-ref 145/127 |
| **SPEC-194** | Billing lifecycle robustness: refund revoke+cache, trial-expiry advisory-lock no-op (G-02), dunning non-payment cache (G-03), scheduled-change double-apply (G-05), addon split-state (G-08), downgrade price normalization, `/change-plan` idempotency, ABANDONED dual-vocab, partial-refund modeling, state-machine transition guard | NEW | Create |
| **SPEC-145** | Entitlement & limit **enforcement**: endpoint-gate-matrix, gate wiring, unified error contract (Pattern B → ServiceError), admin/staff bypass, limit-counter plumbing, enforcement e2e (block/allow/limit/upgrade/downgrade/override/addon/cancel/trial/staff/stale-cache), route snapshot guard, enforcement docs. Consumes the catalog; does not own it. | reserved | Revert from over-wide rewrite to pure enforcement |
| **SPEC-149** | Provider error propagation + Sentry context + retry policy + **webhook error-handling/dead-letter** (handlers swallow errors → mark processed; retry-job omits `subscription_preapproval.created` + `subscription_authorized_payment.*`) | draft, 0% | Add webhook-error ownership; cross-ref 194 |
| **SPEC-167** | Downgrade **remediation** under the grandfather+restrict policy (O-2): restrict/lock the over-cap listings on apply, block-new, premium read-only, host-choice UI + the **public-listing cache revalidation** (Cloudflare ISR) on pause/downgrade/suspend (was 145 D-5) | draft, 0% | Rewrite: drop preflight hard-block; adopt grandfather+restrict |
| **SPEC-147** | User self-service subscription cancellation (soft-cancel, MP preapproval pause, finalize cron, `USER_CANCELED` event, UI) | draft, 0% | Keep; cross-ref 145 cache-clear + 194 state-machine |
| **SPEC-148** | Cron-lag defensive grace (`active` + `currentPeriodEnd` past) + plan-disable lifecycle (reject new signups on disabled plan, preserve existing) | draft, 0% | Keep; cross-ref 145 (past_due transition) + 149 (Sentry) |
| **SPEC-150** | Multi-currency (per-customer currency, multi-currency plan prices, FX fallback, stale-rate handling, addon currency match). Post-MVP. | draft, 0% | Keep; cross-ref 192 (plan price schema), invert regression-guard test on land |
| **SPEC-127** | Migrate `addon.checkout.ts` from direct mercadopago SDK to qzpay `billing.checkout.create()`; drop `mercadopago` direct dep | draft, 0% | Keep (122 child); run BEFORE 192 FR-2 (same file) |
| **SPEC-128** | Billing cleanup (real dead code = 3 shims) + MP-sandbox smoke + ops runbook; closes 122 | draft, 0% | Fix dead-code list; its 10 smokes validate the whole go-live |
| **SPEC-131** | Re-enable PlanPurchaseButton async-state tests broken by the Astro 6 bump | draft, 0% | Keep; autonomous, no billing coupling |

## 4. Cross-cutting invariants (every child must respect)

These are the contracts that, if any child violates, break billing system-wide. The master tracks them;
the children implement against them.

- **INV-1 cache invalidation.** Every money/subscription-mutating event calls `clearEntitlementCache(customerId)`
  synchronously after its DB write. Owned distributively (145 wiring + 194 lifecycle fixes); the transversal
  guard test (145 T-145-66) and stale-cache regression test (145 T-145-65) prove completeness.
- **INV-2 error contract.** Entitlement/limit denials return `ENTITLEMENT_REQUIRED` / `LIMIT_REACHED` with a
  structured `details` body — never `FORBIDDEN` with a stringified JSON message. Owned by 145 (gate refactor)
  and 149 (provider error mapping).
- **INV-3 catalog single source of truth.** No `as EntitlementKey` / `as LimitKey` casts in production source;
  every key is enum-validated; the catalog ADR is single (192). 145 consumes; 192 owns.
- **INV-4 state-machine.** Subscription status changes go through a validated transition table (194), not
  free-form `UPDATE ... SET status`. Refund/dispute/dunning/cancel all use it.
- **INV-5 grandfather+restrict.** Downgrade never destroys user data and never hard-blocks the downgrade;
  over-cap resources are restricted (reversible), not deleted (167, O-2).
- **INV-6 staff bypass.** Platform staff (`SUPER_ADMIN/ADMIN/EDITOR/CLIENT_MANAGER`) bypass all gates
  (already implemented SPEC-171; 145 documents + tests it).

## 5. Execution order & dependencies

```
[122 historical: 123-126 done] ──► SPEC-127 ──► SPEC-128 (smokes validate everything) ──┐
                                                                                          │
SPEC-192 (catalog→DB, fixes FR-4 bug) ──► SPEC-145 (enforcement, consumes catalog) ──────┤
        │                                        │                                        │
        └──► (single catalog ADR)                ├──► SPEC-167 (downgrade grandfather+restrict)
                                                  │                                        │
SPEC-194 (lifecycle bugs) ──► SPEC-149 (errors/sentry/webhook) ──────────────────────────┤──► GO-LIVE
        │ (refund/trial/dunning/scheduled)        │ (webhook error-handling coordinates w/194)   gate
        │                                                                                  │
SPEC-147 (self-cancel) ─┐                                                                  │
SPEC-148 (grace+disable)┘── (lifecycle UX, after 194 state-machine)                        │
                                                                                          │
SPEC-150 (multi-currency, post-MVP) ──────────────────────────────────────────────────────┤
SPEC-131 (test fix, independent) ──────────────────────────────────────────────────────────┘
```

**Hard ordering constraints:**

1. **192 before 145** — enforcement consumes the DB-backed catalog; 192 also fixes the FR-4 bug that 145/194 would otherwise hit.
2. **127 before 192 FR-2** — both touch `addon.checkout.ts`; migrate to qzpay first, then redirect catalog reads.
3. **194 state-machine (INV-4) before 147/148/167** — they all change subscription status.
4. **194 + 149 coordinate on webhook errors** — 194 changes whether handlers re-throw/mark-failed; 149 adds Sentry capture; sequence 194's mark-processed fix before 149's webhook Sentry wiring.
5. **128 last** — its smokes are the go-live validation; needs 126/127 + the rest green.

**Suggested batching (each = its own staging PR train):**

- Batch 1: 192 (catalog) + 127 (addon checkout) — foundation, mostly mechanical.
- Batch 2: 194 (lifecycle correctness) — highest financial-correctness value.
- Batch 3: 145 (enforcement) + 149 (errors/observability).
- Batch 4: 167 (downgrade) + 147 (cancel) + 148 (grace).
- Batch 5: 150 (multi-currency, optional pre-go-live) + 131 (test fix).
- Batch 6: 128 (cleanup + smoke + runbook) → close 122 → close 193 → start SPEC-109 Phases 3-7.

## 6. Go-live acceptance criteria (the master closes when ALL true)

- [ ] 192 closed — addon catalog DB-backed, no residual config reads in runtime, single catalog ADR merged, FR-4 bug fixed.
- [ ] 194 closed — every lifecycle bug fixed with a regression test; INV-4 state-machine in place; refund revokes + clears cache.
- [ ] 145 closed — every gated route from the matrix has block+allow e2e; INV-1/INV-2 proven; snapshot guard in CI; enforcement docs.
- [ ] 149 closed — provider errors propagate with Sentry context; webhook handlers no longer swallow; dead-letter complete; retry policy.
- [ ] 167 closed — grandfather+restrict implemented; over-cap listings restricted (reversible); premium read-only; cache revalidation on pause/downgrade.
- [ ] 147 closed — user self-service cancel works (soft-cancel + MP pause + finalize cron + UI).
- [ ] 148 closed — cron-lag grace + plan-disable lifecycle.
- [ ] 127 + 128 closed → 122 master closed (mercadopago SDK no longer a direct apps/api dep; 10/10 MP-sandbox smokes signed off; ops runbook published).
- [ ] 131 closed — PlanPurchaseButton tests re-enabled and green.
- [ ] 150 — closed OR explicitly deferred post-go-live with sign-off (multi-currency is the only optional item).
- [ ] All cross-cutting invariants (INV-1..INV-6) verified by tests.
- [ ] Manual staging smoke + prod smoke (for billing-core) executed and signed off per the SPEC-143 checklist process (CLAUDE.md billing-testing rule).
- [ ] Hospeda ready to start SPEC-109 Phases 3-7 (Coolify env, prod toggle, MP homologation).

## 7. Risks

| Risk | Mitigation |
|------|------------|
| Scope re-overlap as children evolve | This master is the arbiter; any new billing work registers here first |
| 192↔145↔194 touch the same files (`entitlement.ts`, `addon-entitlement.service.ts`) | Hard ordering §5; 192 first, then 145/194 build on the fixed catalog |
| Cache-invalidation completeness (INV-1) | Transversal test (145 T-145-66) + stale-cache guard (145 T-145-65) |
| Webhook-error coordination 194↔149 | §5 constraint 4; 194's mark-processed fix lands before 149's webhook Sentry |
| Downgrade restrict (O-2) is reversible-state, not delete | 167 must use soft/restricted states; 194 state-machine (INV-4) backs it |
| Test runtime / OOM with full coverage | Reuse SPEC-143 chunked coverage (engram #636) |

## 8. Cross-references

- Specs: SPEC-122 (historical master), SPEC-143 (test harness + gap origin), SPEC-168 (plans→DB, prereq of 192), SPEC-171 (staff bypass), SPEC-109 (MP prod readiness, resumes after this).
- Engram: `billing/spec-reorg-2026-06` (this reorg), `spec/spec-122/master-plan-decisions`, `spec/spec-143/t-143-09-checkpoint` (#564), `#817` (smoke F-findings), `#636` (coverage).
- ADRs: 013 (deferred limit enforcement — 145 activates), 016 (fail-open), 019 (tx isolation/locks), 020→168 (plans DB SoT), 021 (type-cast policy), 026 (collections limit). New: catalog ADR (192).
