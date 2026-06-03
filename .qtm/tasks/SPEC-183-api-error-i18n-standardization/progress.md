# SPEC-183 — API Error i18n Standardization — Progress

**Status**: in-progress (0/14)
**Created**: 2026-06-02
**Linear**: BETA-63

## Phase Summary

| Phase | Tasks | Done |
|---|---|---|
| phase-1-centralize (move helper to @repo/i18n) | T-001, T-002, T-003, T-004 | 0/4 |
| phase-2-web-migration (migrate remaining web sites) | T-005, T-006 | 0/2 |
| phase-3-admin-adoption (wire admin sites) | T-007, T-008, T-009, T-010 | 0/4 |
| phase-4-key-coverage (keys + guard + docs + closeout) | T-011, T-012, T-013, T-014 | 0/4 |

## Critical Path

T-001 → T-002 → T-003 → T-004 → T-005 → T-006 → T-013 → T-014
T-002 → T-007 → T-010 → T-013
T-002 → T-008 → T-010 → T-013
T-002 → T-009 → T-010 → T-013
T-011 → T-012 → T-013 → T-014

## Owner Decisions — ALL RESOLVED

| # | Decision | Resolution |
|---|----------|-----------|
| Q1 | Where does the helper live? | `@repo/i18n` — owner approved |
| Q2 | Migration breadth? | Both apps, genuine API errors only |
| Q3 | Admin call pattern? | Use `useTranslations()` `t` function |
| Q4 | Key coverage mechanism? | CI guard test in `packages/i18n/test/` |

Implementation is unblocked on all phases.

## Owner Actions Required (non-automatable)

- None at this time — all decisions resolved.
- PR review + merge to staging after implementation completes.

## Notes

- No tasks started yet. Spec authored 2026-06-02.
- BETA-63 closes when Phase 3 ships (admin shows localized API errors).
- Phase 1 and Phase 4 (T-011) can begin in parallel.
- Phase 2 and Phase 3 are both blocked on Phase 1 (T-002) completing.
- The web re-export shim (T-004) is zero-behavior-change for existing callers — no web
  component imports need updating.
- Explicitly excluded from migration: apps/admin/src/lib/cache/**, error-boundaries,
  error-reporter, validation hooks, native JS Error instances in web.
- Missing i18n keys to add in T-011: INVALID_PAGINATION_PARAMS, NOT_IMPLEMENTED,
  CONFIGURATION_ERROR, QUOTA_EXCEEDED, ENTITLEMENT_REQUIRED.
