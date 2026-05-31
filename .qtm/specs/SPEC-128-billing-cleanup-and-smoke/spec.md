---
spec-id: SPEC-128
title: Billing cleanup + E2E smoke + ops runbook (Phase F+G)
type: chore
complexity: medium
status: draft
created: 2026-05-15T00:00:00Z
effort_estimate_hours: 6-10
tags: [hospeda, qzpay, cleanup, smoke, e2e, runbook, ops]
parent: SPEC-122
phase: F+G
depends_on: [SPEC-126, SPEC-127]
priority: medium
target_repo: /home/qazuor/projects/WEBS/hospeda
first_allocated_via_engram_protocol: true
---

# SPEC-128: Billing cleanup + E2E smoke + ops runbook (Phase F+G)

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

- [ ] All dead code candidates verified + handled (deleted or documented as kept)
- [ ] All docs updated to reflect post-SPEC-122 architecture
- [ ] Ops runbook at `docs/migration/mercadopago-sandbox-runbook.md` complete
- [ ] 10/10 smokes executed against MP sandbox, results documented in engram
- [ ] SPEC-109 updated with current status (ready for Phases 3-7)
- [ ] SPEC-122 + all 6 children marked `completed` in `.qtm/specs/index.json` + engram
- [ ] Final engram observation `spec/spec-122/closure-summary` saved with the full story

## Engram references

- `spec/spec-122/master-plan-decisions`
- `spec/spec-122/audit-summary`
- `spec/spec-122/execution-order`
- `spec/spec-109/state` — handoff back to SPEC-109 for Phases 3-7
