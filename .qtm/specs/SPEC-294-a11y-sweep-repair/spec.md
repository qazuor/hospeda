---
spec-id: SPEC-294
title: Repair the A11y Sweep CI workflow (broken since SPEC-270) + move it pre-merge
type: bugfix
complexity: medium
status: draft
created: 2026-06-27T00:00:00Z
model_fit: basic-to-medium
---

# SPEC-294 — Repair the A11y Sweep CI workflow

> Follow-up of **SPEC-270** (web accessibility audit), which added
> `.github/workflows/a11y-sweep.yml`. That workflow has **never run green**: it
> triggers on `push` to `staging` (post-merge), so the SPEC-270 PR merged without
> the sweep ever executing, and every push to `staging` since has failed. The
> failure surfaced for the first time during the `staging → main` promotion
> (PR #1863, 2026-06-27), where it appears red in the rollup. This spec finishes
> the repair started in PRs #1865/#1867 and fixes the root cause (post-merge
> trigger) so the workflow is validated before it can rot again.

## 1. Overview

### Goal

Make the A11y Sweep workflow run **green end-to-end** and run it **pre-merge**
(on PRs) instead of only on push-to-staging, so a broken sweep is caught in
review instead of silently failing post-merge.

### Governance note

The A11y Sweep is **not** the merge gate (the gate is the `CI Pass` check from
the main `CI` workflow; `main` has no GitHub branch protection — protection is
agent-side). It is a quality signal. Nothing here changes the gate; it makes the
signal trustworthy.

## 2. Current state (verified 2026-06-27, PR #1863 promotion)

`.github/workflows/a11y-sweep.yml` runs on `push` to `staging` + `workflow_dispatch`.
Because it never ran on the SPEC-270 PR, a chain of bugs accumulated. Found so far
(each one masked the next):

| # | Bug | Evidence | Status |
|---|-----|----------|--------|
| B1 | `NODE_ENV: production` at the **job** level makes `pnpm install` skip ALL devDeps → `husky: not found`, then `turbo: not found` | install step aborts | **fixed** in #1865 (`husky install \|\| true`, partial) + #1867 (move `NODE_ENV` to server-runtime steps only) |
| B2 | Build/exec filters use non-existent package names `--filter=api --filter=web` (real: `hospeda-api` / `hospeda-web`) — 3 sites (build, playwright install, sweep) | `No package found with name 'api'` | **fixed** in #1867 |
| B3 | `PUBLIC_SENTRY_DSN: ''` fails the web env schema (validates URL; empty = "Invalid URL") during prerender | `Invalid web app environment configuration` | **fixed** in #1867 (omit the vars) |
| B4+ | Steps past the web build (migrations, extras, seed, Playwright install, server boot, the axe sweep itself) have **never executed** — unknown failures likely remain | n/a — never reached | **OPEN** |

PRs #1865 and #1867 land B1–B3. This spec owns B4+ and the root-cause trigger
change.

## 3. Scope

### A. Get the sweep green end-to-end (BÁSICO/MEDIO)

| # | Change | Notes |
|---|--------|-------|
| A1 | Run the full sweep on a branch via `workflow_dispatch` (post-#1867) and fix each remaining failure: migrations/extras/seed against the CI Postgres service, Playwright Chromium install, API + web server boot/health-wait, and the `a11y:sweep` script itself | Iterate until the job reaches the sweep step and exits 0. |
| A2 | Triage what the axe sweep reports. If it surfaces **real** WCAG violations on the live built site, either fix them (small, in-scope) or, if large, capture them as a separate SPEC-270 follow-up and set the sweep threshold/allowlist so the workflow reflects a true pass — never a silent skip | Distinguish infra failures (this spec) from genuine a11y debt (escalate). |
| A3 | Reduce config drift: the sweep reimplements env + build setup that already exists in the `CI` workflow's build job. Where practical, reuse the shared `./.github/actions/setup` contract and the same build invocation so the two cannot diverge again | Don't over-refactor; the goal is one source of truth for "how to build for CI". |

### B. Fix the root cause — validate pre-merge (MEDIO)

| # | Change | Notes |
|---|--------|-------|
| B1 | Change the trigger from `push: [staging]` to `pull_request` targeting `staging` (and keep `workflow_dispatch`). A broken sweep then fails the PR's checks in review, not silently after merge | This is why the workflow rotted unnoticed; fixing it prevents recurrence. |
| B2 | Decide whether the sweep is **required** or **advisory** (report-only, like the existing Lighthouse job). Default to advisory first (don't block merges on a freshly-repaired sweep), promote to required once stable | Owner decision at implementation time. |
| B3 | Make CI workflows **re-runnable**: add `workflow_dispatch` to `sync-main-to-staging.yml` (today it only triggers on `push` to `main`, so a failed back-merge cannot be retried without a new push). Audit other `push`-only workflows for the same gap | Same lesson as B1: a workflow that can't be dispatched can't be recovered when it fails. Surfaced 2026-06-27 when the sync workflow failed (Actions PR-create permission, since enabled) with no way to re-run it. |

## 4. Out of scope

- Re-doing SPEC-270's accessibility fixes. This spec repairs the CI **workflow**;
  any NEW real WCAG violations the sweep finds are escalated, not fixed here
  (beyond trivial ones).
- Changing the `staging → main` promotion gate or branch-protection model.
- The CodeQL findings on the promotion diff (separate concern; the 7 production
  ones were fixed in #1866, the 5 test ones are accepted false positives).

## 5. User Stories

#### US-1 — Sweep runs green end-to-end (A1)

- **GIVEN** the repaired workflow
  **WHEN** it runs (dispatch or PR)
  **THEN** install, build, migrations, seed, Playwright install, server boot and
  the `a11y:sweep` step all complete and the job exits 0.

#### US-2 — Real a11y debt is visible, not hidden (A2)

- **GIVEN** the sweep reaches the axe step
  **WHEN** it finds violations
  **THEN** they are either fixed (trivial) or tracked + thresholded, so a green
  run means "no unaddressed violations", never "the sweep didn't run".

#### US-3 — Broken sweep is caught pre-merge (B1)

- **GIVEN** a PR that breaks the sweep
  **WHEN** CI runs on the PR
  **THEN** the A11y Sweep check fails on the PR (not silently after merge).

## 6. Tasks

| Task | Title | Fit |
|---|---|---|
| T-294-01 | A1: iterate `workflow_dispatch` runs, fix each remaining step failure past the web build until the job exits 0 | MEDIO |
| T-294-02 | A2: triage axe output — fix trivial violations, escalate/threshold the rest | MEDIO |
| T-294-03 | A3: de-duplicate build/env setup vs the `CI` workflow build job | BÁSICO |
| T-294-04 | B1: switch trigger to `pull_request` → `staging` (+ keep `workflow_dispatch`) | BÁSICO |
| T-294-05 | B2: decide advisory vs required; wire accordingly | BÁSICO |
| T-294-06 | Docs: note the workflow contract + the "CI workflows that only run post-merge never get validated" lesson | BÁSICO |
| T-294-07 | B3: add `workflow_dispatch` to `sync-main-to-staging.yml` + audit other `push`-only workflows for missing dispatch | BÁSICO |

## 7. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| The axe sweep finds large real a11y debt | Medium | Separate infra-green (this spec) from a11y-debt (escalate to a SPEC-270 follow-up); threshold so green is honest. |
| Pre-merge trigger makes every PR slower | Low/Med | Make it advisory first; the sweep is already time-boxed (20 min) and concurrency-cancelled. |
| Reusing the CI build job introduces coupling | Low | Reuse only the setup contract + build invocation, not the whole job. |

## 8. Notes

- Built from the live PR #1863 promotion incident (2026-06-27). The B1–B3 fixes
  already shipped in #1865/#1867; this spec is the dedicated follow-up the owner
  requested after we stopped chasing the chain mid-promotion.
- Core lesson to encode: **a CI workflow that only triggers post-merge is never
  validated by the PR that introduces it** — it can merge broken and stay broken
  silently. Prefer `pull_request` triggers for anything that should gate quality.
