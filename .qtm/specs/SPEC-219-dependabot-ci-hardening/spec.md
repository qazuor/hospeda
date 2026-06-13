---
spec-id: SPEC-219
title: Dependabot CI Hardening & Dependency Bump Merge Strategy
type: infrastructure
complexity: medium
status: in-progress
created: 2026-06-11
---

# SPEC-219 — Dependabot CI Hardening & Dependency Bump Merge Strategy

## 1. Overview

### Goal

Make Dependabot pull requests pass CI reliably and define an explicit, documented
merge strategy for dependency bumps, so that safe updates flow with minimal friction
and risky majors are isolated for deliberate, code-migrated handling.

### Motivation

Two distinct, recurring failures were observed on open Dependabot PRs:

- **PR #1548** (`ci: bump the github-actions group with 6 updates`) — the **Build** job
  fails because the admin build validates env vars (`VITE_API_URL`, `VITE_SITE_URL`,
  `HOSPEDA_API_URL`) sourced from repo `secrets.*`. Dependabot-triggered workflow runs
  execute **without access to repository secrets**, so those values arrive empty, fail
  URL validation, and abort the build. This is NOT a defect in the bump — it fails on
  **every** Dependabot PR regardless of what it changes.
- **PR #1570** (`chore(deps): bump the production-minor-patch group, 66 updates`) — in
  addition to the same secrets/build problem, it carries **real breaking changes**:
  - `zod` `4.3.6 → 4.4.3`: `.merge()` on object schemas containing refinements now
    throws (*".merge() cannot be used on object schemas containing refinements. Use
    .safeExtend() instead."*), breaking `test/env-registry-cross-validation.test.ts`
    (Guards) and cascading into E2E.
  - `@tanstack/react-router` `1.131 → 1.170`: the admin healthcheck behavior is
    documented against `1.131.26` in `apps/admin/CLAUDE.md` (server route handlers are a
    no-op in that version; the `/healthz` path-intercept depends on it). A router bump
    must be validated against that behavior.

These two problems have different root causes and different fixes. The first is pure CI
plumbing; the second is a process/config problem (Dependabot must not lump
migration-requiring majors in with mechanical patches).

### Success Criteria

- A Dependabot PR that changes only safe patch/minor versions passes **all** required CI
  jobs (including Build) with no manual intervention.
- The admin Build job no longer fails solely because repo secrets are absent in the
  Dependabot run context.
- Dependabot config groups/separates updates such that breaking majors land in their own
  PRs, clearly distinguishable from auto-mergeable safe updates.
- A short, written policy exists (in `docs/`) describing how to triage and merge
  Dependabot PRs, including who/what handles majors and how they link to migration specs.
- The strategy explicitly **defers** the actual major migrations (Zod 4.4, TanStack
  Router) to their own specs/tasks — see Out of Scope.

## 2. Scope

### In Scope

1. **CI build resilience to absent secrets** — make the Build job succeed in the
   Dependabot context (empty `secrets.*`) without weakening validation for real
   (push/PR-from-branch) runs.
2. **Dependabot configuration** (`.github/dependabot.yml`) — grouping rules that separate
   safe updates from majors, ignore/strategy rules for known migration-gated packages,
   and sensible schedule/PR limits.
3. **Merge-strategy documentation** — a `docs/` guide describing triage + merge flow for
   Dependabot PRs and how majors are routed to migration specs.
4. **Re-validation of the two trigger PRs** — confirm #1548 passes after the build fix;
   confirm #1570 is split/handled per the new strategy (the breaking bumps peeled off).

### Out of Scope (explicitly)

- **Implementing the Zod 4.4 `.merge()` → `.safeExtend()` migration.** That is a code
  migration; route it to **SPEC-132** (Zod 4 migration) or a dedicated follow-up spec.
- **Implementing the TanStack Router `1.131 → 1.170` upgrade.** Route to **SPEC-045**
  (Vite/TanStack migration) or a dedicated follow-up spec, with mandatory admin
  healthcheck re-validation.
- **Auth/secrets architecture changes** beyond what the CI build fix needs.
- **Granting production secrets broadly to fork/Dependabot runs** if it widens the
  security surface (evaluated as an option below, not pre-decided).

## 3. Technical Approach

> Each option below is a real fork to be decided during implementation. The spec
> documents the trade-offs; it does not pre-commit to one.

### 3.1 CI Build resilience to absent secrets

The admin build calls env validation that requires valid URLs. In Dependabot runs,
`secrets.HOSPEDA_API_URL` (and the `VITE_*` derived from it) are empty. Candidate fixes:

- **Option A — Build-time placeholder URLs (recommended starting point).** In the CI
  workflow Build step, fall back to safe dummy URLs (e.g. `https://example.invalid`) when
  the secret is empty. The build only needs *syntactically valid* URLs; it does not call
  them. Lowest blast radius, no secret exposure, no validation weakening for real runs.
  - Pros: minimal, secure, isolated to CI; real deploys still use real secrets.
  - Cons: a placeholder must be kept obviously non-functional to avoid masking a real
    misconfig; needs a guard so production builds never accept placeholders.
- **Option B — Dependabot secrets.** Define the needed values as *Dependabot* secrets
  (separate from Actions secrets) so Dependabot runs can read them.
  - Pros: build uses real-shaped values; no workflow conditionals.
  - Cons: widens where these values are readable; ongoing maintenance of a second secret
    set; still leaks nothing sensitive only if the URLs are non-secret (they are
    low-sensitivity, which makes this viable).
- **Option C — Relax URL validation during CI build.** Gate the strict URL check behind a
  `CI` / build-only flag.
  - Pros: simplest conceptually.
  - Cons: weakens a real safety net; risks shipping a genuinely misconfigured build that
    validation would otherwise catch. Least preferred.

Decision criteria: prefer the option that keeps production validation strict and exposes
no real secrets. Option A is the recommended default; revisit if placeholders prove
fragile.

### 3.2 Dependabot configuration & grouping

Update `.github/dependabot.yml` to:

- **Group** patch + minor updates per ecosystem into a single low-noise PR (already
  partially done — the `production-minor-patch` group exists).
- **Separate majors**: give major-version updates their own PRs (do not fold a major into
  a minor/patch group), so a breaking bump never rides in on an otherwise-green PR.
- **Migration-gate known packages**: for packages with documented migration cost (`zod`,
  `@tanstack/react-router`), either pin/ignore the major until its migration spec lands,
  or label its PR so triage routes it to the migration spec rather than auto-merge.
- **Schedule & limits**: sane `open-pull-requests-limit` and cadence to avoid PR floods
  (the 66-update PR is a symptom of over-broad grouping).

### 3.3 Merge-strategy documentation

Add a concise guide (e.g. `docs/guides/dependabot-policy.md`) covering:

- The three CI job classes a Dependabot PR must satisfy and what "green" means here.
- How safe patch/minor groups are reviewed and merged (candidate for auto-merge once CI
  is reliably green).
- How majors are triaged: peel off, link to the relevant migration spec (SPEC-132 /
  SPEC-045 / new), and never merge until the migration is done and validated.
- The secrets/build caveat (why Dependabot runs lack secrets) so future failures are not
  re-diagnosed from scratch.

### 3.4 T-005 triage findings — `production-minor-patch` group (#1570 → #1588)

The grouped production PR was triaged in June 2026. Findings recorded so they are not
re-diagnosed from scratch:

**Three chained breaking changes in one 69-bump group** (each fix exposed the next):

1. `zod` 4.3.6 → 4.4.3 — `.merge()` throws on object schemas containing refinements
   (`.safeExtend()` is the replacement). Breaks `@repo/schemas` (web prerender build and
   the admin env cross-validation test run by Guards). Owner: **SPEC-132**.
2. `@astrojs/node` 10.1.1 → 10.1.4 — imports `createRequestFromNodeRequest` from astro
   internals, which only exists in **astro ≥ 6.4.0** (verified empirically: the export is
   absent from every 6.3.x tarball, present from 6.4.0). apps/web pins astro `^6.3.3`, so
   the web build fails with `[MISSING_EXPORT]`. The package's `peerDependencies` declares
   `astro: ^6.3.0`, which is misleading — do NOT trust the peer range. Owner: astro 6.4
   alignment (this spec / a follow-up).
3. `vite` 8 in `apps/landing` — astro 5.18 (landing) declares `vite: ^6.4.1`, but the
   uncapped root override `"vite@^6.0.0": ">=6.4.2"` resolves it to the latest vite 8 on
   any fresh install; astro 5.18 crashes under vite 8.0.13+ ("Invalid URL"). NOT ignorable
   (no single bump to exclude — it is a lockfile-regeneration side effect). Decision:
   **exclude landing from CI** (it is a temporary pre-launch app, removed at launch).

**Critical infra finding — Dependabot reads `dependabot.yml` from the DEFAULT branch
(`main`), NOT the `target-branch` (`staging`).** The `zod` / `@tanstack/react-router`
ignores were added to `staging` but never took effect, because Dependabot evaluates the
config from `main`, which is currently far behind `staging`. **No ignore works until
`dependabot.yml` reaches `main`.** This is the single highest-leverage fix and is gated on
the staging→main promotion (SPEC-220).

**Actions taken (PR #1605 → staging):** excluded `hospeda-landing` from the turbo-fanned
CI tasks (`--filter=!hospeda-landing`); added `@astrojs/node` to the dependabot `ignore`.

**Still required:** promote `dependabot.yml` (with the ignores) to `main` so Dependabot
honours it. Until then the group PR keeps regenerating red regardless of fixes on staging.

### 3.5 Active ignores & unblock roadmap

Removing an `ignore` entry (or the landing CI exclusion) is the deliberate trigger to take
on that migration. This table is the source of truth for what is currently held back and
who owns lifting it.

| Held back | Why | Lift trigger / owner |
| --- | --- | --- |
| `zod` (ignore) | 4.4 `.merge()` breaks `@repo/schemas` | Migrate `.merge()` → `.safeExtend()` across schemas. **SPEC-132** |
| `@tanstack/react-router` (ignore) | 1.170 risks `/healthz` path-intercept (admin) | Validate against admin healthcheck behavior. **SPEC-045** |
| `@astrojs/node` (ignore) | 10.1.4 needs astro ≥ 6.4; web pins 6.3.3 | Move apps/web to astro ≥ 6.4, then lift the ignore. **this spec / follow-up** |
| `apps/landing` (CI-excluded) | astro 5.18 breaks under vite 8 on fresh install | Removed at production launch (app is temporary, no migration owed) |

## 4. Risks

| Risk | Impact | Likelihood | Mitigation |
| --- | --- | --- | --- |
| Placeholder URLs mask a real env misconfig in production builds | High | Low | Guard so production/deploy builds reject placeholder values; only the CI Build step (not deploy) accepts them. |
| Relaxing URL validation (Option C) hides genuine config errors | High | Medium | Prefer Option A/B; if C is chosen, scope the relaxation to a CI-only flag and keep deploy validation strict. |
| Dependabot grouping change floods or starves PRs | Medium | Low | Set explicit `open-pull-requests-limit` and validate on the next Dependabot cycle. |
| Auto-merge of "safe" minors ships a subtle breaking change | Medium | Medium | Only auto-merge after CI (incl. full test + E2E) is reliably green; keep majors strictly manual. |
| Overlap/duplication with SPEC-132 / SPEC-045 migration work | Medium | Medium | This spec is infra-only; it references those specs and does NOT implement migrations. |

## 5. Tasks (Suggested)

### Setup

- T-001: Document current CI Build failure mode for Dependabot PRs (secrets absent) and
  capture the exact failing step/log refs from #1548 and #1570 as the baseline.

### Core

- T-002: Implement CI Build resilience to absent secrets (chosen option from §3.1) in the
  workflow, with a guard preventing production/deploy builds from accepting placeholders.
- T-003: Update `.github/dependabot.yml` grouping so majors get isolated PRs and
  migration-gated packages (`zod`, `@tanstack/react-router`) are pinned/ignored/labeled.

### Integration

- T-004: Re-trigger / re-run CI on PR #1548 and confirm Build + CI Pass go green with the
  build fix.
- T-005: Triage PR #1570 per the new strategy — peel off the breaking majors (Zod,
  TanStack Router) into their migration specs; confirm the safe remainder passes CI.

### Testing

- T-006: Add/adjust a CI guard or test asserting the build fails loudly on placeholder
  URLs in a production/deploy context (so Option A cannot silently mask misconfig).

### Docs

- T-007: Write `docs/guides/dependabot-policy.md` (triage + merge flow, secrets caveat,
  major-migration routing) and cross-link from the repo CI docs and `apps/admin/CLAUDE.md`.

### Cleanup

- T-008: Link SPEC-219 from SPEC-132 / SPEC-045 (and create dedicated migration follow-up
  specs if those are not the right home) so the major migrations have an owner.

### T-005 follow-through (production-minor-patch triage, June 2026)

- T-009: Exclude the temporary `hospeda-landing` app from the turbo-fanned CI tasks and
  add `@astrojs/node` to the dependabot `ignore` list (PR #1605 → staging). See §3.4.
- T-010: Promote `dependabot.yml` (with the zod / react-router / @astrojs/node ignores) to
  `main` so Dependabot actually honours them — Dependabot reads config from the default
  branch, not the target branch. Gated on / coordinated with the staging→main promotion
  (SPEC-220). Until this lands, every `production-minor-patch` group PR regenerates red.

## 6. Internal Review Notes

- **Strengthened**: scope is deliberately constrained to CI/infra + Dependabot config;
  the two breaking-change migrations are pushed to dedicated specs to avoid duplicating
  SPEC-132 (Zod 4) and SPEC-045 (Vite/TanStack) work.
- **Open questions for implementation time**:
  - Which §3.1 option is chosen (A recommended). Decision deferred to T-002.
  - Whether `zod`/`@tanstack/react-router` should be `ignore`d outright in dependabot.yml
    vs. labeled-and-routed. Decision deferred to T-003.
  - Whether safe minor/patch groups become auto-merge or stay manual-but-easy.
- **References**: PR #1548, PR #1570; `apps/admin/CLAUDE.md` (healthcheck / router
  caveat); related drafts SPEC-132, SPEC-045, SPEC-129.
- Not urgent — this is planning for later work; no worktree created.
