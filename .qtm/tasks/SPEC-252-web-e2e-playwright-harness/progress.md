# SPEC-252 — Progress

## Origin (2026-06-20, realigned 2026-06-21)

SPEC-249 T-025 ("E2E: owner edits gastronomy + experience") was validated live by hand
(MCP-driven browser + HTTP). The original spec assumed apps/web had no Playwright
harness. Realigned on 2026-06-21: apps/e2e (hospeda-e2e) is a mature functional
Playwright harness with CI wired (e2e-pr.yml @p0 grep, e2e-nightly.yml). Scope changed
from "create a harness in apps/web" to "extend apps/e2e with commerce-owner flows +
fix seed gaps." Owner approved.

Two seed gaps must be fixed before the E2E tests can run:

- Experience listings owned by a non-logueable seed user (<commerce-owner-seed@hospeda.test>).
- gastro-owner-*@local.test users seeded with profile_completed=false, blocking the
  commerce area middleware gate.

## Task status

| ID    | Title                                                              | Phase       | Status  |
| ----- | ------------------------------------------------------------------ | ----------- | ------- |
| T-001 | Fix e2e seed: logueable commerce owner, both verticals, profile_completed=true | setup | pending |
| T-002 | Add reusable commerce-owner sign-in helper to apps/e2e/fixtures/  | setup       | pending |
| T-003 | E2E positive spec: owner edits gastronomy + experience             | core        | pending |
| T-004 | E2E negative spec: tourist/non-owner blocked                       | core        | pending |
| T-005 | Verify CI picks up @p0 commerce tests + document in spec           | integration | pending |

## Dependency graph

```
T-001 (seed fix)
  └─> T-002 (auth helper, optional — can skip and inline)
        └─> T-003 (positive E2E)
              └─> T-004 (negative E2E)
                    └─> T-005 (CI verify + docs)
```

T-002 is parallel-optional: if only one test file uses the helper, skip T-002 and
inline the sign-in in T-003/T-004 directly.

## Critical path

T-001 → T-003 → T-004 → T-005 (4 steps, seed is the blocker for everything).

## Notes

- apps/e2e scripts: e2e:up, e2e:seed, e2e:test, e2e:test:p0 (--grep @p0), e2e:test:p1
- Auth pattern in existing fixtures: fetch ${API_URL}/api/auth/sign-in/email (Better Auth)
- Structural template for new spec: apps/e2e/tests/host/host-01-onboarding-handoff.spec.ts
- Tags for new tests: @p0 @commerce
- CI job: .github/workflows/e2e-pr.yml runs `pnpm --filter hospeda-e2e e2e:test:p0`
- SPEC-253 (extended fields E2E) will add more commerce tests on top of this foundation.
