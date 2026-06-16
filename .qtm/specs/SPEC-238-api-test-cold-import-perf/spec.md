---
spec-id: SPEC-238
title: Reduce apps/api per-file test cold-import overhead (~9% suite speedup)
type: improvement
complexity: medium
status: in-progress
created: 2026-06-15T00:00:00Z
tags: [ci, testing, vitest, performance, api, infrastructure]
---

# SPEC-238 — Reduce apps/api per-file test cold-import overhead

## 1. Overview

### Goal

Cut the per-file cold-import cost of the `apps/api` vitest suite so the overall
Unit Tests wall-clock drops ~9%, **without** saturating the CI machine
(the same machine-safety constraint that governed SPEC-188 Track A applies).

### Origin

This is the **"B2" lever extracted from SPEC-188**. SPEC-188 shipped Track A
(concurrency cap, PR #1427, merged) and archived. B2 was implemented on branch
`spec/SPEC-188-vitest-test-performance` but **never merged**: by the time it was
ready the branch sat ~1760 commits behind `staging`, so a rebase was unviable.

The branch was deleted as part of the 2026-06-15 registry cleanup. The
implementation is recoverable by SHA if needed for reference:

- Branch tip: `9825dd9ff40915c3790f032fd70fa18f86737cf6`
- B2 perf commit: `d6c023179` — "cut apps/api per-file cold-import
  (drop service-core importOriginal, mock sentry)"

**Important:** do NOT cherry-pick the old commit. The B2 implementation relied on
a ~670-line `apps/api/test/helpers/mocks/service-core-extras.ts` mock written
against an old `@repo/service-core` API. That mock is almost certainly stale
(service-core changed substantially: billing, entitlements, moderation). Treat
this as a **fresh re-implementation on current `staging`**, using the old commit
only as a reference for the technique.

## 2. Technique (from the B2 reference)

The core idea that produced the ~9% gain:

1. Stop importing the **real `@repo/service-core`** in api route/service tests
   (cold-import is the dominant per-file cost). Provide a focused mock instead.
2. Mock **Sentry** in `apps/api/test/setup.ts` to avoid its init cost per file.
3. Introduce a **shared vitest base config** (`vitest.shared.config.ts`) so the
   per-file environment setup is consistent and minimal.

Files the reference branch touched (for orientation only — re-derive against
current source):

- `vitest.shared.config.ts` (+ shared test config / test-runner variants)
- `apps/api/test/helpers/mocks/service-core-extras.ts` (the stale mock — rewrite)
- `apps/api/test/setup.ts` (Sentry mock + setup)
- `apps/api/test/routes/revalidation.test.ts` and ~15 service/route tests
  (each gained the mock wiring)
- `.github/workflows/ci.yml` (CI override), `turbo.json`
- `docs/guides/test-performance.md`

## 3. Acceptance criteria

- [ ] `apps/api` Unit Tests wall-clock measurably reduced (target ~9%, measured
      before/after on the self-hosted runner, not a dev laptop).
- [ ] No increase in total concurrency / peak memory (machine-safety invariant
      from SPEC-188 holds).
- [ ] The service-core mock reflects the **current** `@repo/service-core` surface
      and does not mask real bugs (mocked behavior must match real contracts for
      the methods exercised).
- [ ] No flakiness introduced; full suite green in CI.

## 4. Notes

- Priority: P3 (DX / CI cost, not a launch blocker). Sibling of SPEC-105
  (E2E suite repair) and SPEC-233 (Vitest 4 migration) — coordinate if Vitest 4
  lands first, since the shared-config shape may change.
- Crosses with: SPEC-188 (parent/origin), SPEC-233 (Vitest 4), SPEC-179
  (self-hosted runner — the measurement environment).
