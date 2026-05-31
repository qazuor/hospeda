# SPEC-176 — Progress Tracker

**Web color-system fallback for older browsers (oklch/@supports) + admin browser gate**

Generated: 2026-05-30 | Driver: Linear BETA-44

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 16 |
| Completed | 0 |
| In progress | 1 (T-001) |
| Pending | 15 |
| Avg complexity | 2.1 |

## Phase Breakdown

| Phase | Tasks | Status |
|-------|-------|--------|
| setup (Phase 0) | T-001, T-001B | in_progress / pending |
| core (Phase 1+2+3) | T-002, T-003, T-004, T-005, T-006 | pending |
| integration (Phase 4+dark-mode) | T-007, T-008, T-009, T-010, T-011 | pending |
| testing | T-012, T-013 | pending |
| cleanup | T-014, T-015 | pending |

## Critical Path

```
T-001 → T-001B → T-002 → T-003 → T-004 → T-005 → T-007 → T-008 → T-012 → T-013 → T-014 → T-015
```

Longest chain: 12 tasks deep.

## Parallel Tracks

```
Track A (main — design-tokens + codemod + icons):
  T-001 → T-001B → T-002 → T-003 → T-004 → T-005 ──────────────────┐
                                              └→ T-006               │
                                                                      │
Track B (visual parity + CI guard):                                  │
  T-001 ──────────────────────────── T-010                           │
  T-005 → T-011                             │                        │
                                            └────────────────────────┤
Track C (admin gate — parallel to T-005+T-006):                     │
  T-004 → T-009                             │                        │
  T-005+T-006 → T-007 → T-008 ─────────────┘                        │
                                                                      ↓
                                                              T-012 (merge point)
                                                                   ↓
                                                            T-013 → T-014 → T-015
```

T-001B is inserted between T-001 and T-002 on Track A. T-010 (Playwright) depends on T-001 directly
(not T-001B) — its script was scaffolded in T-001 and does not wait for the baseline-fix.
Track B and Track C run in parallel after T-004/T-005 complete. Merge point: T-012 (integration smoke).

## Task Status

| ID | Title | Status | Complexity | Blocked By |
|----|-------|--------|-----------|------------|
| T-001 | Write failing regression guards (RED) | in_progress | 2 | — |
| T-001B | Fix alien token-count baseline in design-tokens (restore green) | pending | 2 | T-001 |
| T-002 | Add culori devDep + formatSRGB() | pending | 2 | T-001B |
| T-003 | Define VARIANT_TOKEN_MAP (42 entries) + Zod schema | pending | 4 | T-002 |
| T-004 | Extend generate-css.ts + regenerate dist/tokens.css | pending | 3 | T-003 |
| T-005 | Run codemod (679 call-sites) + manual cleanup | pending | 4 | T-004 |
| T-006 | Fix @repo/icons subtle variant to emit var(--token) | pending | 2 | T-004 |
| T-007 | Add i18n keys for admin gate banner (es/en/pt) | pending | 1 | T-005, T-006 |
| T-008 | Create BrowserGateBanner + mount in admin root | pending | 3 | T-007 |
| T-009 | Verify dark-mode token fallback correctness | pending | 2 | T-004 |
| T-010 | Playwright visual parity check post-codemod | pending | 2 | T-001, T-005 |
| T-011 | Wire CI guard to turbo.json pipeline | pending | 1 | T-005 |
| T-012 | Full test suite + integration smoke (GREEN) | pending | 2 | T-008, T-009, T-010 |
| T-013 | Wire CI gate, JSDoc, architecture docs | pending | 1 | T-011, T-012 |
| T-014 | Commit + open PR to staging | pending | 1 | T-013 |
| T-015 | Post-merge: update indexes + close BETA-44 | pending | 1 | T-014 |

## Notes

- T-001B is an inserted phase-0 task that corrects ALIEN baseline drift in design-tokens tests (6 RED asserts from sponsor/amenity/auth SSOT commits pre-SPEC-176). It only touches test asserts and the generate-css snapshot — no source changes. T-004 (emitVariantTokens) will shift these counts again later; that is expected.
- T-003 is the highest complexity (4) — census derivation + 42-entry map + Zod schema. Can be split if needed but fits within 1-3 hour estimate given the census script already exists.
- T-005 is the second highest complexity (4) — codemod execution + manual resolution of ~49 lightness-math cases. The report-driven workflow keeps it manageable.
- T-010 (Playwright) depends on T-001 directly (script scaffold lives in T-001) and T-005 (post-codemod source). It does NOT depend on T-001B.
- T-009 (dark-mode) runs in parallel with T-007/T-008 (admin gate) after T-004.
- The CLAUDE.md bug-fix rule is honored: T-001 (regression guard scaffold) lands BEFORE any implementation.
