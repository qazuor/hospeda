# SPEC-182 — Unified Authentication + Host-Mode Access Model — Progress

**Status**: in-progress (3/22)
**Created**: 2026-06-02
**Linear**: BETA-52, BETA-57

## Phase Summary

| Phase | Tasks | Done |
|---|---|---|
| phase-1-web-auth (callbackUrl + allowlist) | T-001, T-002, T-003, T-004 | 0/4 |
| phase-2-admin-auth (guard redirect + page removal) | T-005, T-006, T-007, T-008, T-009 | 0/5 |
| phase-3-staff-host-creation (endpoint migration + UI) | T-010 ✓, T-011, T-012, T-013 | 1/4 |
| phase-4-host-mode-toggle (web CTA three-state) | T-014 ✓, T-015, T-016 | 1/3 |
| phase-5-dev-local-cookie (cross-subdomain workaround) | T-017 ✓, T-018 | 1/2 |
| phase-6-closeout (tests + docs + smoke + indexes) | T-019, T-020, T-021, T-022 | 0/4 |

## Critical Path

T-002 → T-001 → T-005 → T-006 → T-019 → T-020 → T-021 → T-022
T-002 → T-003 → T-004 → T-019
T-005 → T-007 → T-008 → T-009 → T-019
T-010 → T-011 → T-012 → T-013 → T-019
T-014 → T-015 → T-016 → T-019
T-017 → T-018 → T-019

## Owner Decisions — ALL RESOLVED (2026-06-02)

| # | Decision | Resolution |
|---|----------|-----------|
| D1 | Permission for staff host-creation | `USER_CREATE` (existing permission) |
| D2 | Staff host-creation UI placement | Modal on the admin users list |
| D3 | Host CTA "has published accommodation" check | Derive from `role === 'HOST'` (no extra API call) |
| D4 | Dev-local cookie workaround | `*.hospeda.local` + `/etc/hosts` recipe |
| D5 | `callbackUrl` param name | `callbackUrl` |

Implementation is unblocked on all phases.

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
