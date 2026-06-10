---
spec-id: SPEC-128
title: Billing cleanup + E2E smoke + ops runbook (Phase F+G)
type: chore
complexity: medium
status: completed
created: 2026-05-15T00:00:00Z
effort_estimate_hours: 6-10
tags: [hospeda, qzpay, cleanup, smoke, e2e, runbook, ops]
parent: SPEC-193
parent_legacy: SPEC-122
phase: F+G
depends_on: [SPEC-126, SPEC-127]
priority: medium
target_repo: /home/qazuor/projects/WEBS/hospeda
first_allocated_via_engram_protocol: true
---

# SPEC-128: Billing cleanup + E2E smoke + ops runbook (Phase F+G)

## Realignment (2026-06-09) — scope reconciled to SPEC-193 reality

This spec was authored for the legacy SPEC-122 / SPEC-109 world. At execution time the current billing master is **SPEC-193**, which changed how several SPEC-128 items are handled. The spec was completed with this reconciled scope (owner-approved 2026-06-09):

- **F1 dead-code (DONE)**: deleted the 3 confirmed-dead `@deprecated` re-export shims in `apps/api/src/services/` (`addon-status-transitions.ts`, `promo-code.crud.ts`, `promo-code.redemption.ts`). The `addon-status-transitions` test was the only coverage for those re-exports, so it was migrated to `packages/service-core/test/billing/addon-status-transitions.test.ts` (canonical source) rather than dropped. The originally-listed candidates (`addon-downgrade-detection`, `addon.admin`, `reactivateFromTrial`) are NOT dead and were kept (see "Dead-code list correction" below). qzpay `vendor.types.ts` is cross-repo and out of scope here.
- **F2 docs (DONE)**: refreshed hospeda billing architecture pointers — root `CLAUDE.md`, `apps/api/CLAUDE.md`, `packages/db/CLAUDE.md` (`mp_subscription_id` note), plus runbook backlinks. qzpay READMEs are cross-repo, out of scope.
- **G2 runbook (DONE)**: authored `docs/migration/mercadopago-sandbox-runbook.md` as the operator entry point, cross-referencing (NOT duplicating) the SPEC-143 staging/prod smoke checklists + mp-test-cards-reference and the SPEC-193 batched-smoke list.
- **G1 — 10 manual MP sandbox smokes (SUPERSEDED)**: the standalone "10 smokes" model is replaced by SPEC-193's batched-smoke approach. The billing smokes are accumulated in `.qtm/specs/SPEC-193-billing-go-live-readiness-master/docs/pending-staging-smoke.md` and executed once by the owner before the staging → main promotion. Not executable as part of this code/docs spec.
- **G3 — SPEC-122 / SPEC-109 closure ceremony (SUPERSEDED)**: SPEC-122 is the legacy parent; the active master is SPEC-193. No SPEC-122 "6-children closure" is performed here. The production toggle / Coolify / homologation handoff remains owner-owned under SPEC-109/SPEC-193 promotion.

## Dead-code list correction (SPEC-193 audit 2026-06-03)

The original Task F1 candidate list included files that, after code audit, have active callers and are NOT dead code:

- `apps/api/src/services/addon-downgrade-detection.service.ts` — has an active caller in `addon-plan-change.service.ts:578`. Do NOT delete.
- `apps/api/src/services/addon.admin.ts` — imported by `customer-addons.ts:23`. Do NOT delete.
- `apps/api/src/services/trial.service.ts reactivateFromTrial()` — called from `trial.ts:338`. Do NOT delete.

The REAL dead-code candidates (confirmed 0 imports in `apps/api/src/` non-test files) are 3 `@deprecated` shims that are re-exports toward `@repo/service-core` with no remaining callers:

1. `apps/api/src/services/addon-status-transitions.ts`
2. `apps/api/src/services/promo-code.crud.ts`
3. `apps/api/src/services/promo-code.redemption.ts`

These three shims are safe to delete. Verify with `grep -rn '<filename>' apps/api/src --include='*.ts' | grep -v test` before deleting, per the existing F1 procedure.

### Cross-reference SPEC-193

The 10 smoke tests in Phase G (§ "In Phase G — smoke + runbook") validate the go-live readiness of the entire SPEC-193 master. SPEC-128 smokes are the acceptance gate for the integrated billing system — cross-ref SPEC-193 §6.

## Context

Final phase of SPEC-122. Once the full subscription flow is implemented (SPEC-126) and the addon checkout is migrated (SPEC-127), there's a residual cleanup of dead code, plus an E2E smoke run against MP sandbox to validate the full system, plus the operator runbook for MP testing and production cutover.

This phase closes the master spec.

## Scope

### In (Phase F — cleanup)

1. **Verify and remove dead code in Hospeda**:
   - `apps/api/src/services/addon-downgrade-detection.service.ts` — search for callers; if none, delete.
   - `apps/api/src/services/addon-status-transitions.ts` — search for callers; if none, delete.
   - `apps/api/src/services/addon.admin.ts` — verify if admin routes use it or call qzpay directly; if dead, delete.
   - `apps/api/src/services/trial.service.ts:reactivateFromTrial()` — never called by any route. Decide: delete (since the start-paid route from SPEC-126 replaces it) or keep + document.

2. **Verify and remove dead code in qzpay**:
   - Marketplace/split payments types in `qzpay-core/types/vendor.types.ts` — types defined but no implementation anywhere. Delete.
   - Any leftover `subscription.adapter.ts` code that's superseded by SPEC-124's rewrite.

3. **Update docs** across both repos:
   - `apps/api/docs/billing/` — new section on subscription lifecycle, webhook event handling, promo codes (free_trial extension).
   - `packages/billing/docs/` — update with the final architecture.
   - `qzpay/packages/mercadopago/README.md` — update with the new preapproval flow.
   - `qzpay/packages/core/README.md` — document `mode: 'paid'` parameter.

4. **CLAUDE.md updates**:
   - Project root `CLAUDE.md`: add a section on "How billing works" pointing to the runbook + key files.
   - `apps/api/CLAUDE.md`: update billing section.
   - `packages/db/CLAUDE.md`: note the `mp_subscription_id` column is now populated.

### In (Phase G — smoke + runbook)

5. **MP sandbox E2E smoke tests** (manual via runbook, NOT automated CI):
   - **Smoke 1**: Trial start → wait → D-3 notif simulated → start-paid (monthly preapproval) → user authorizes in MP → webhook arrives → sub active → entitlements applied. Verify in MP dashboard the preapproval has all quality fields (payer, external_ref, reason, notification_url, idempotency).
   - **Smoke 2**: Active monthly sub → cron simulates renewal → MP debits → `subscription_authorized_payment.created` webhook → payment recorded → sub stays active.
   - **Smoke 3**: Annual subscription start → user pays via Checkout Pro → webhook arrives → sub active with endDate=+365d.
   - **Smoke 4**: Plan upgrade with proration → delta charge via Checkout Pro → webhook → preapproval.update for new amount → sub on new plan.
   - **Smoke 5**: Plan downgrade → next-period-end scheduled → cron applies change.
   - **Smoke 6**: User cancellation → preapproval.update status='cancelled' → webhook → entitlements revoked at period end.
   - **Smoke 7**: Addon purchase (already working post Phase 1, but smoke once via qzpay-migrated path) → confirms SPEC-127 didn't regress.
   - **Smoke 8**: Promo code (% off addon) + promo code (free_trial extension on monthly preapproval) — both flows.
   - **Smoke 9**: Webhook signature failure (bad secret) → 401 returned, no state change.
   - **Smoke 10**: Abandoned pending_provider sub → 30min later cron marks abandoned.

6. **Ops runbook** at `docs/migration/mercadopago-sandbox-runbook.md`:
   - How to create test users in MP developer panel.
   - List of test cards for AR (with expected behaviors: approved, pending, rejected, etc.).
   - Step-by-step for each of the 10 smoke flows.
   - How to inspect webhook delivery in MP dashboard.
   - How to inspect preapproval / payment objects.
   - Rollback procedures (if a smoke goes wrong in shared sandbox).
   - Pre-prod-toggle checklist (links back to SPEC-109 Phase 5).

7. **Production toggle preparation** (handoff back to SPEC-109):
   - Update SPEC-109 with the smoke results + new acceptance criteria status.
   - Confirm all 10 user-facing capabilities from SPEC-122 are validated.
   - Document the env vars and Coolify changes needed (SPEC-109 Phase 3-5).
   - Sign off on master SPEC-122 closure.

### Out

- Actual production toggle (SPEC-109 Phases 5-7).
- Coolify env var changes (SPEC-109 Phase 3).
- MP homologation submission (SPEC-109 Phase 6).
- 48h prod monitoring (SPEC-109 Phase 7).

## Implementation details

### Task F1 — Dead code verification + removal

For each candidate (`addon-downgrade-detection`, `addon-status-transitions`, `addon.admin`, `reactivateFromTrial`):

1. Search the codebase: `grep -rn '<file-or-export>' apps/ packages/ --include='*.ts' | grep -v test`.
2. If zero non-test references found: delete the file (and any test files for it).
3. If references exist but they're also dead: trace upward, document, decide collaboratively.
4. Commit with message: `chore(api): remove dead code <name> (SPEC-128 F1)`.

For `vendor.types.ts` in qzpay-core: same procedure. Likely safe to delete.

### Task F2 — Documentation updates

Pure content work. Each doc file gets the relevant sections updated with the post-SPEC-126/127 architecture. Use the architecture diagram from SPEC-122 spec.md as the canonical reference.

### Task G1 — Smoke testing

Each smoke is a manual step performed by the operator following the runbook. Results are captured:

- Smoke ID
- Date/time
- Tester
- Pass/fail
- Notes (anomalies, etc.)
- Engram observation saved per smoke

The smoke runs are NOT automated CI tests for two reasons:

1. They require interaction with MP's hosted pages (no headless automation viable).
2. They consume real money (sandbox or not, the operator wants visibility).

E2E automation can come post-MVP as a separate effort (it's complex and not blocking).

### Task G2 — Runbook authoring

Single markdown file at `docs/migration/mercadopago-sandbox-runbook.md`. Organized by:

1. Pre-requisites (MP dashboard config, test users, test cards).
2. Smoke flows (numbered, step-by-step).
3. Troubleshooting common failures.
4. Production cutover checklist.

### Task G3 — SPEC-109 update + SPEC-122 closure

After all smokes pass:

1. Update SPEC-109's spec.md with a "Status post SPEC-122" section, marking Phases 1-2 as done and Phases 3-7 as ready to execute.
2. Update SPEC-122 metadata: status `in-progress` → `completed`, `completedAt: <date>`, `completionRef: "All 6 children closed + 10/10 smokes passed"`.
3. Update engram allocations registry with the status changes.
4. Final session summary in engram.

## Acceptance criteria

(Reconciled to SPEC-193 reality — see "Realignment (2026-06-09)" above.)

- [x] All dead code candidates verified + handled (3 shims deleted, the 3 non-dead candidates kept + documented, coverage migrated to service-core)
- [x] Hospeda docs updated to reflect current (SPEC-193-era) architecture (qzpay READMEs out of scope — cross-repo)
- [x] Ops runbook at `docs/migration/mercadopago-sandbox-runbook.md` complete (entry point cross-referencing SPEC-143 + SPEC-193 smoke docs)
- [~] 10 manual MP sandbox smokes — SUPERSEDED: now batched in SPEC-193 `pending-staging-smoke.md`, owner-executed before staging → main promotion (not part of this code/docs spec)
- [~] SPEC-109 / SPEC-122 closure ceremony — SUPERSEDED: legacy parent; active master is SPEC-193. Production toggle handoff stays owner-owned under SPEC-109/SPEC-193 promotion
- [x] Realignment documented in this spec + the closeout commit

## Engram references

- `spec/spec-122/master-plan-decisions`
- `spec/spec-122/audit-summary`
- `spec/spec-122/execution-order`
- `spec/spec-109/state` — handoff back to SPEC-109 for Phases 3-7
