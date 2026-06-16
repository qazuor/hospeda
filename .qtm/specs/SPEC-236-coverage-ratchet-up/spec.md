---
spec-id: SPEC-236
title: Coverage ratchet-up — restore per-package thresholds to the 90% target
type: chore
complexity: medium
status: completed
created: 2026-06-15
---

# SPEC-236 — Coverage ratchet-up

## 1. Overview

### Goal

Raise per-package unit-test coverage back up to the original targets (90% default;
lower bars for framework-heavy apps) and ratchet the CI coverage floors up to match,
recovering the quality bar that eroded while the coverage gate was broken.

### Motivation

The `Coverage Threshold` job (push-to-main only, `.github/workflows/ci.yml`
`coverage-check`) never actually passed while a vitest `sortSpecs` crash took down
every shard from ~2026-06-10 (missing `--passWithNoTests` on `test:coverage`; fixed
in PR #1658). With the gate unenforced, coverage drifted **below** the configured
bars. To restore a working gate without blocking on a large test-writing effort, the
thresholds were **recalibrated to each package's current coverage as a floor** (the
floor only fails on a FUTURE regression). This spec tracks raising coverage — and the
floors — back toward the 90% target.

### Current floors vs target (lines %, baselined 2026-06-15)

| Package | Floor (now) | Target | Gap |
| --- | --- | --- | --- |
| feedback | 43 | 90 | 47 |
| admin | 45 | 50* | 5 |
| icons | 56 | 90 | 34 |
| api | 70 | 75* | 5 |
| seed | 75 | 90 | 15 |
| service-core | 79 | 88 | 9 |
| notifications | 80 | 90 | 10 |
| schemas | 83 | 85 | 2 |
| billing | 87 | 90 | 3 |
| web | 55 | 55* | 0 |

\* web/admin/api keep lower targets by design (Astro SSR / TanStack routes / React
islands / vi.spyOn-mocked handlers that v8 can't follow — verified via integration +
E2E instead). The 90% target applies to the logic packages.

### Success Criteria

- Each package's real coverage raised toward its target; CI floor raised in lockstep.
- No package left below its (new, higher) floor; `Coverage Threshold` stays green.
- Prioritise the largest gaps / highest-value logic packages first (feedback, icons,
  seed, service-core, notifications, billing, schemas).

## 2. Scope

### In Scope

- Add unit tests to raise coverage per package toward target.
- Ratchet the floors in `.github/workflows/ci.yml` `coverage-check` up as coverage rises.

### Out of Scope

- The framework-app lower bars (web/admin/api) — covered by integration/E2E, not unit.
- Vitest 4 migration (SPEC-233) — coordinate if it changes coverage tooling.

## 3. Tasks (suggested)

- T-001: Per failing package, identify the lowest-coverage / highest-value files; add tests.
- T-002: Raise the CI floor for each package as its coverage rises (keep floor ≤ actual).
- T-003: Land incrementally (per-package PRs to `staging`); keep the gate green throughout.

## 4. References

- PR #1658 (the `--passWithNoTests` fix that surfaced this).
- `.github/workflows/ci.yml` `coverage-check` job (floors live here).
- SPEC-188 (vitest perf), SPEC-233 (Vitest 4).
