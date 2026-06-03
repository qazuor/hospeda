# SPEC-181 — PostHog Reverse Proxy (web) — Progress

**Status**: in-progress (0/11)
**Created**: 2026-06-02
**Linear**: BETA-77

## Phase Summary

| Phase | Tasks | Done |
|---|---|---|
| phase-worker (Worker authoring) | T-001, T-002, T-003, T-004 | 0/4 |
| phase-app (CSP + env-registry) | T-005, T-006, T-007 | 0/3 |
| phase-docs | T-008, T-009 | 0/2 |
| phase-verify (owner ops + smoke) | T-010, T-011 | 0/2 |

## Critical Path

T-001 → T-002 → T-003 → T-010 → T-011
T-001 → T-004 → T-010 → T-011
T-005 → T-007 → T-011
T-006 → T-011

## Owner Actions Required

- **T-010**: Deploy Worker + set Cloudflare route (must happen BEFORE T-011)
- **T-011**: Set PUBLIC_POSTHOG_HOST in Coolify + redeploy + smoke with ad-blocker

## Notes

- No tasks started yet. Spec authored 2026-06-02.
- Coupling risk: CSP changes (T-005) and env var change (T-011/Coolify) must be atomic.
  Worker (T-010) must be live and verified before Coolify env is set.
