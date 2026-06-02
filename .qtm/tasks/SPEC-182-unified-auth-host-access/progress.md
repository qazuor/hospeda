# SPEC-182 — Unified Authentication + Host-Mode Access Model — Progress

**Status**: in-progress (0/22)
**Created**: 2026-06-02
**Linear**: BETA-52, BETA-57

## Phase Summary

| Phase | Tasks | Done |
|---|---|---|
| phase-1-web-auth (callbackUrl + allowlist) | T-001, T-002, T-003, T-004 | 0/4 |
| phase-2-admin-auth (guard redirect + page removal) | T-005, T-006, T-007, T-008, T-009 | 0/5 |
| phase-3-staff-host-creation (endpoint migration + UI) | T-010, T-011, T-012, T-013 | 0/4 |
| phase-4-host-mode-toggle (web CTA three-state) | T-014, T-015, T-016 | 0/3 |
| phase-5-dev-local-cookie (cross-subdomain workaround) | T-017, T-018 | 0/2 |
| phase-6-closeout (tests + docs + smoke + indexes) | T-019, T-020, T-021, T-022 | 0/4 |

## Critical Path

T-002 → T-001 → T-005 → T-006 → T-019 → T-020 → T-021 → T-022
T-002 → T-003 → T-004 → T-019
T-005 → T-007 → T-008 → T-009 → T-019
T-010 → T-011 → T-012 → T-013 → T-019
T-014 → T-015 → T-016 → T-019
T-017 → T-018 → T-019

## Owner Decisions Required (BLOCKERS — must resolve before implementation)

- **T-010**: D1 (USER_CREATE vs HOST_ONBOARD permission) + D2 (UI placement for staff host-creation)
- **T-014**: D3 (host CTA check: role vs API call) + D5 (callbackUrl vs returnUrl param name)
- **T-017**: D4 (dev-local cookie: *.hospeda.local recipe vs document-only)

## Owner Actions Required (non-automatable)

- **T-021**: Manual smoke — web→admin round-trip per role (staging or local with D4 workaround)
- **T-022**: Open PR to staging after smoke passes

## Notes

- No tasks started yet. Spec authored 2026-06-02.
- BETA-52 closes when T-005 ships (admin redirects to web auth instead of own signin).
- BETA-57 closes when T-006 ships (admin signup page deleted — the buggy OAuth path disappears).
- Phase 3 (staff host-creation) and Phase 4 (host-mode toggle) are parallel once decisions are made (T-010/T-014 respectively).
- Phase 5 (dev-local cookie) is parallel to all other phases.
- Phase 6 is the integration gate — waits for all other phases.
- Cross-app coupling risk: after this spec, admin auth depends on web. Document in T-020 and the auth-architecture runbook.
