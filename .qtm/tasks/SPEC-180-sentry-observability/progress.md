# SPEC-180 — Progress Tracker

Sentry Observability Hardening — source maps, environments, and logger-driven capture

Generated: 2026-06-01 | Linear: BETA-66, BETA-50, BETA-64

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 14 |
| Completed | 0 |
| In progress | 0 |
| Pending | 14 |
| Avg complexity | 1.5 |

## Phase Breakdown

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 — Source maps (BETA-66) | T-001, T-002, T-003 | pending |
| Phase 2 — Logger capture (BETA-64) | T-004, T-005, T-006, T-007, T-008, T-009 | pending |
| Phase 3 — Environments + ops (BETA-50) | T-010, T-011, T-012 | pending |
| Phase 4 — Closeout | T-013, T-014 | pending |

## Critical Path

```
T-001 → T-002 → T-003 ──────────────────────────────────────────────┐
                                                                      │
T-004 → T-005 → T-006 → T-007 → T-008 → T-009 ─────────────────────┤
                                                                      │
T-010 (independent) ────────────────────────────────────────────────┤
T-011 (independent) ────────────────────────────────────────────────┤
                                                                      ↓
                                                               T-012 (merge point)
                                                                    ↓
                                                             T-013 → T-014
```

Critical path length: T-004 → T-005 → T-006 → T-007 → T-008 → T-009 → T-012 → T-013 → T-014 (9 tasks deep).

## Parallel Tracks

```
Track A (source maps — BETA-66):
  T-001 → T-002 → T-003

Track B (logger capture — BETA-64):
  T-004 → T-005 → T-006 → T-007 → T-008 → T-009

Track C (environment + ops — BETA-50, can run in parallel with A+B):
  T-010 (independent, no blockedBy)
  T-011 (independent, no blockedBy)

Merge point: T-012 (all tracks converge — full test suite + smoke)
Closeout: T-013 (PR) → T-014 (indexes + Linear close)
```

Track A and Track B can proceed in parallel. Track C (T-010, T-011) has no dependencies and can be done at any time before T-012.

## Task Status

| ID | Title | Status | Complexity | Blocked By |
|----|-------|--------|-----------|------------|
| T-001 | Add ARG SENTRY_AUTH_TOKEN to all three Dockerfiles | pending | 1 | — |
| T-002 | Fix web Sentry plugin gate (DSN → AUTH_TOKEN) | pending | 1 | T-001 |
| T-003 | Verify source map upload via Coolify build (manual) | pending | 1 | T-001, T-002 |
| T-004 | Add capture?: boolean flag + registerCaptureHook() to @repo/logger | pending | 2 | — |
| T-005 | Write tests for capture hook + beforeSend filter (RED first) | pending | 2 | T-004 |
| T-006 | Register Sentry forwarder in apps/api after Sentry.init() | pending | 1 | T-005 |
| T-007 | Extend beforeSend denylist in sentry.ts | pending | 2 | T-005, T-006 |
| T-008 | Tag ~15 actionable call sites with { capture: true } | pending | 3 | T-006, T-007 |
| T-009 | Rate-limit subscription-poll cron Sentry captures | pending | 1 | T-008 |
| T-010 | Harden environment derivation + startup warning | pending | 1 | — |
| T-011 | Fix docs/runbooks/sentry-setup.md stale var names + consent gate | pending | 1 | — |
| T-012 | Full test suite + integration smoke — all GREEN | pending | 1 | T-009, T-010, T-011 |
| T-013 | Open PR to staging + Coolify ops checklist handoff | pending | 1 | T-003, T-012 |
| T-014 | Post-merge: flip indexes to completed, close Linear issues | pending | 1 | T-013 |

## Notes

- T-001 and T-004 have no blockers — can start in parallel immediately.
- T-003 is a manual verification by the owner. It cannot be automated (requires a real Coolify build with a valid Sentry auth token). T-013 blocks on T-003 to ensure source maps are confirmed working before closing the spec.
- T-005 follows the bug-fix test-first rule: write RED tests before implementing the forwarder (T-006) and before-send extension (T-007).
- T-008 has the highest complexity (3) due to the audit of all logger.error() call sites. Estimated ~1-2 hours including review.
- T-010 and T-011 have no dependencies and can be knocked out early in any session.
- `SENTRY_AUTH_TOKEN` is ALREADY in `packages/config/src/env-registry.hospeda.ts` — the registry step is done. No env-registry update needed in this spec.
- The web Sentry plugin gate fix (T-002) is a one-line change but has outsized impact — it's been silently blocking source map uploads for the web app since SPEC-146.
