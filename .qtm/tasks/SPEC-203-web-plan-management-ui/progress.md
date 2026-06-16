# SPEC-203 — Self-serve plan management UI (web) — Progress

**Status**: in-progress (0/11)
**Created**: 2026-06-15
**Parent**: SPEC-193
**Depends on**: SPEC-167, SPEC-147

## Phase Summary

| Phase | Tasks | Done |
|---|---|---|
| setup (schemas) | T-001 | 0/1 |
| core (API endpoint + web client) | T-002, T-003 | 0/2 |
| integration (UI components) | T-004, T-005, T-006, T-007, T-008, T-009, T-010 | 0/7 |
| testing (integration tests + staging smoke) | T-011 | 0/1 |

## Critical Path

T-001 → T-002 → T-003 → T-004 → T-010 → T-011
T-003 → T-005 → T-007 → T-008 → T-009 → T-010 → T-011
T-003 → T-006 → T-010 → T-011

Longest chain: T-001 → T-002 → T-003 → T-005 → T-007 → T-008 → T-009 → T-010 → T-011 (9 steps)

## Parallel Tracks

**Track A (Backend)**: T-001 → T-002
**Track B (Web client, unblocks all UI)**: T-001 + T-002 → T-003

After T-003 completes, three tracks open in parallel:

- **Track C (view/dashboard)**: T-004 (scheduled-change banner)
- **Track D (plan change)**: T-005 → T-007 → T-008 → T-009
- **Track E (cancel flow)**: T-006

All three tracks converge at T-010 (i18n) → T-011 (integration tests + staging smoke).

## Task List

| ID | Title | Phase | Status | Complexity | Blocked By |
|----|-------|-------|--------|------------|------------|
| T-001 | Add DowngradePreview Zod schema to @repo/schemas | setup | pending | 2 | — |
| T-002 | Implement GET /downgrade-preview endpoint | core | in_progress | 4 | T-001 |
| T-003 | Fix and extend billingApi in endpoints-protected.ts | core | pending | 5 | T-001, T-002 |
| T-004 | Add scheduled-change banner to SubscriptionDashboard | integration | pending | 3 | T-003 |
| T-005 | Implement PlanPicker component | integration | pending | 4 | T-003 |
| T-006 | Implement cancel flow (wire to SPEC-147 soft-cancel) | integration | pending | 4 | T-003 |
| T-007 | Implement DowngradePreviewRenderer + KeepIdsSelector | integration | pending | 5 | T-005 |
| T-008 | Implement plan-change confirm step + result state | integration | pending | 5 | T-007 |
| T-009 | Wire full plan-change flow into SubscriptionDashboard | integration | pending | 4 | T-008 |
| T-010 | Add i18n keys (es/en/pt) for all new subscription UI copy | integration | pending | 3 | T-004, T-006, T-009 |
| T-011 | Write integration tests + execute staging smoke | testing | pending | 4 | T-010 |

## Risk Notes

- **T-003 cancelSubscription repoint**: fix changes behavior; verify no other caller depends
  on the hard-cancel path before repointing to the SPEC-147 soft-cancel endpoint.
- **T-006 graceful degradation**: HOSPEDA_USER_CANCEL_ENABLED defaults off — the 404 path
  MUST show the email fallback, not an error page.
- **T-007 KeepIdsSelector defaults**: the selector must default to `keepByDefault` items to
  avoid restricting the wrong resources at period end.
- **T-002 (in-progress)**: backend endpoint is being implemented in parallel; T-003 is blocked
  until T-002 is done but schemas (T-001) can proceed first.

## Owner Actions Required

- None blocking at start. T-002 is already in progress.
- Before T-011 staging smoke: confirm HOSPEDA_USER_CANCEL_ENABLED is set to `true` on staging
  (or run the 404-fallback smoke with it off first, then toggle on for the happy-path smoke).
- PR review + merge to staging after T-011 smoke sign-off is filed.
