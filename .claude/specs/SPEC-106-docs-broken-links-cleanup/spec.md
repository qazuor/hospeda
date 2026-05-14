---
spec-id: SPEC-106
title: Docs CI — Baseline Cleanup (Broken Links + Validate-Examples Hang)
type: chore
complexity: medium
status: in-progress
created: 2026-05-13T03:00:00Z
started: 2026-05-14T00:00:00Z
effort_estimate_hours: 6-16
tags: [docs, ci, tech-debt, cleanup]
extracted_from: SPEC-101 (uncovered by the check-links infinite-loop fix in commit `960aeb5ba` + post-fix audit revealing `validate-examples.ts` also hangs)
---

# SPEC-106: Docs CI — Baseline Cleanup (Broken Links + Validate-Examples Hang)

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Bring the **Documentation CI** workflow fully green. Two distinct issues:

1. `pnpm docs:check-links` exits 0 across the repository (currently fails fast on 299 broken internal links).
2. `pnpm docs:validate-examples` completes within the workflow timeout (currently hangs and gets cancelled at the 10-min cap).

Once both are green, future PRs touching `docs/**`, `apps/**/docs/**`, or `packages/**/docs/**` stop having a permanent red check.

**Why now:** SPEC-101 fixed an infinite-loop bug in `scripts/check-links.ts` (commit `960aeb5ba`). Pre-fix, the script hung on the first markdown file containing an external link, so it never completed and never reported broken internal links. Post-fix, the script runs in ~0.8s and reports **299 broken internal links** distributed across the repo. None of them live in SPEC-101's newsletter docs — they are all pre-existing tech debt that the script simply could not detect before.

Post-fix audit also surfaced that `scripts/validate-examples.ts` was hanging silently in CI for the same 10-min cap. Different root cause (not regex iteration — likely TypeScript compiler API misuse: the script calls `ts.createProgram([virtualFileName], ...)` per code block, and TypeScript walks the filesystem looking for `tsconfig.json` and the virtual file path that does not exist, which is slow at best and may loop). Tracked in scope here so we close out Documentation CI in a single cleanup pass instead of two.

**Why a new spec (not part of SPEC-101 or SPEC-103):**

- **Not SPEC-101**: SPEC-101 is "newsletter MVP". Stuffing a 299-link cleanup into its PR would balloon scope, bury the actual newsletter delta in a sea of unrelated doc edits, and slow merge to `staging`.
- **Not SPEC-103**: SPEC-103 already shipped (merged 2026-05-12 in PR #1060). Re-opening it for cleanup that was discovered after merge is the wrong shape.
- This is its own scoped, isolated chore.

**Audience:** Solo developer (qazuor) with intermittent attention. Each batch is independent; ergonomic to ship one directory at a time.

### 2. Out of Scope

- Adding new docs. This is **cleanup of existing references**, not authoring.
- Improving the link-check script beyond what's needed to land green (the script already works after `960aeb5ba`).
- Validating **external** links (http/https). The script only checks internal references; that policy stays.
- Linting MD style (`pnpm lint:md:docs` is a separate green check).
- Adding a Markdown anchor-check (the link checker only resolves the file path, not `#anchor` fragments). Separate spec if we want it.

### 2-bis. In scope — `validate-examples.ts` hang

In addition to the broken-link cleanup, this spec also fixes `scripts/validate-examples.ts` so the workflow's **Validate TypeScript Examples** job lands green. Investigation steps:

1. Reproduce the hang locally with `pnpm docs:validate-examples` against a single markdown file with a TypeScript code block. Confirm timing.
2. Profile: is the slow path inside `ts.createProgram` (filesystem walk)? Per `createSourceFile`? Per language-service lookup?
3. Likely root causes to test:
   - Passing a non-existent virtual file path to `createProgram` triggers a recursive search for `tsconfig.json` from `cwd`.
   - `getPreEmitDiagnostics` runs the full type-check, including resolving every transitive import — expensive when code blocks reference workspace types.
   - One-program-per-block instead of a single Program for all blocks.
4. Likely fix shape: either (a) ditch `getPreEmitDiagnostics` and rely on `sourceFile.parseDiagnostics` alone (syntax-only check, much faster), or (b) build a single Program with all virtual files and re-use it across blocks, or (c) call `ts.transpileModule` (which doesn't type-check but catches syntax errors quickly).
5. Acceptance: `pnpm docs:validate-examples` finishes in under 60 seconds against the full repo, exits 0 (or surfaces real syntax errors with file:line:reason).

### 3. Current state

**Refresh 2026-05-14** (on `spec/SPEC-106-docs-broken-links-cleanup`, branched from `origin/staging`):

- **365 broken internal links** reported by `pnpm docs:check-links` (up from 299 in the original snapshot because pre-launch sprint added beta tester docs in `apps/web/src/content/beta/` that introduced 66 new broken links — these use relative paths like `(beta/host/dashboard)` that look like Astro frontend routes but are checked as filesystem references and fail).
- Updated distribution (366 total — small rounding because one is at `docs/index.md` standalone):

| Directory | Broken links |
|---|---:|
| `apps/web/` (beta content) | 66 |
| `apps/admin/` | 44 |
| `packages/service-core/` | 36 |
| `apps/api/` | 31 |
| `packages/db/` | 27 |
| `docs/deployment/` | 26 |
| `packages/logger/` | 19 |
| `packages/schemas/` | 15 |
| `docs/runbooks/` | 14 |
| `packages/icons/` | 13 |
| `packages/seed/` | 9 |
| `packages/i18n/` | 7 |
| `docs/guides/` | 7 |
| `packages/billing/` | 6 |
| `docs/resources/` | 6 |
| `docs/examples/` | 6 |
| `docs/contributing/` | 5 |
| `docs/testing/` | 4 |
| `docs/performance/` | 4 |
| Other (utils, notifications, config, auth-ui, docs/security, docs/architecture, tailwind-config, root) | 21 |

**Original snapshot 2026-05-13** (on `spec/SPEC-101-newsletter-mvp` HEAD `960aeb5ba`):

- **299 broken internal links** reported by `pnpm docs:check-links`.
- Distribution by top-level dir:

| Directory | Broken links |
|---|---:|
| `apps/admin/` | 44 |
| `packages/service-core/` | 36 |
| `apps/api/` | 31 |
| `packages/db/` | 27 |
| `docs/deployment/` | 26 |
| `packages/logger/` | 19 |
| `packages/schemas/` | 15 |
| `docs/runbooks/` | 14 |
| `packages/icons/` | 13 |
| `packages/seed/` | 9 |
| `packages/i18n/` | 7 |
| `docs/guides/` | 7 |
| `packages/billing/` | 6 |
| `docs/resources/` | 6 |
| `docs/examples/` | 6 |
| `docs/contributing/` | 5 |
| `docs/testing/` | 4 |
| `docs/performance/` | 4 |
| `packages/utils/` | 3 |
| `packages/notifications/` | 3 |
| Other (other apps/*, packages/*, root) | balance to 299 |

- Common failure patterns observed in a sample skim:
  - Links to docs that were **moved** during the SPEC-049/SPEC-058/SPEC-063 reorgs (e.g. `docs/development/code-standards.md` → no longer exists; content lives under `.claude/docs/standards/` now).
  - Links typed with `packages/apps/api/...` (typo — `apps/api/...` was intended).
  - Links pointing at **directories** instead of `README.md` files within them (`apps/api/docs/billing` → should be `apps/api/docs/billing/README.md`).
  - Links to specs that were **archived** (e.g. SPEC-078 directory removed when the spec was closed, but doc references remained).
  - Links written assuming the old project root layout pre-monorepo refactor.

### 4. Approach

Cleanup runs in **per-directory batches** so PRs stay small and reviewable. Each batch:

1. Run `pnpm docs:check-links` and grep the report for the target directory.
2. For each broken link in that directory:
   - **Moved target** → update the link path to the new location.
   - **Typo'd path** → fix the path.
   - **Directory link** → append `/README.md` (or whichever index file the dir uses).
   - **Truly gone target** → delete the link, replacing the inline reference with prose where useful.
   - **Outdated reference** (linked file should exist but has been retired entirely) → delete or rewrite the surrounding sentence.
3. Re-run `pnpm docs:check-links` and confirm the directory's count is `0`.
4. Commit one batch per directory: `docs(<scope>): repair internal links in <dir>`.

Order proposed (largest first to maximize incremental progress visible in CI):

1. `apps/admin/` — 44 links
2. `packages/service-core/` — 36 links
3. `apps/api/` — 31 links
4. `packages/db/` — 27 links
5. `docs/deployment/` — 26 links
6. `packages/logger/` — 19 links
7. Remaining tail packages + docs/ subdirs — batched into ~3 PRs.

### 5. Tasks

| Task | Title | Status | Estimated effort |
|---|---|---|---|
| T-106-00 | Repair broken links in `apps/web/src/content/beta/` (66 — added 2026-05-14, beta tester docs with Astro-route-style relative paths) | pending | 45-75 min |
| T-106-01 | Repair broken links in `apps/admin/` (44) | pending | 45-60 min |
| T-106-02 | Repair broken links in `packages/service-core/` (36) | pending | 45-60 min |
| T-106-03 | Repair broken links in `apps/api/` (31) | pending | 30-45 min |
| T-106-04 | Repair broken links in `packages/db/` (27) | pending | 30-45 min |
| T-106-05 | Repair broken links in `docs/deployment/` (26) | pending | 30-45 min |
| T-106-06 | Repair broken links in `packages/logger/` (19) | pending | 20-30 min |
| T-106-07 | Repair broken links in `packages/schemas/` (15) | pending | 15-25 min |
| T-106-08 | Repair broken links in `docs/runbooks/` (14) | pending | 15-25 min |
| T-106-09 | Repair broken links in `packages/icons/` (13) | pending | 15-25 min |
| T-106-10 | Repair broken links in `packages/seed/` + `packages/i18n/` + `docs/guides/` (23) | pending | 20-30 min |
| T-106-11 | Repair broken links in remaining tail dirs (≤ 50) | pending | 30-45 min |
| T-106-12 | Investigate + fix `validate-examples.ts` hang per §2-bis | pending | 1-3 h |
| T-106-13 | Phase gate: `pnpm docs:check-links` AND `pnpm docs:validate-examples` exit 0, Documentation CI green on a clean PR | pending | 10 min |

Per-task acceptance: the targeted directory contributes **0 broken links** to the next run of `pnpm docs:check-links`.

### 6. Risks

| Risk | Mitigation |
|---|---|
| Some "broken" links point at files that **should** still exist but were deleted by mistake during a refactor | Inspect the git history of the referencing file: if the link was added intentionally and the target file was deleted as part of a refactor, this is a regression worth surfacing — file a separate ticket rather than silently dropping the link. |
| Multiple batches conflict on the same file (e.g. `docs/index.md` is referenced from many places) | Each batch only edits files **inside its target directory**, never the linked-to side. So `apps/admin/docs/foo.md` updates the link text/path in its own file; the target file is read-only for this work. |
| New broken links sneak in during the cleanup work (concurrent PRs touching docs) | The script now runs in ~0.8s, so the cost of re-running between batches is tiny. Each batch re-runs the script before commit. |
| One of the broken paths is a **deliberate placeholder** ("coming in v2") | Replace with a TODO comment in the markdown: `<!-- TODO(SPEC-XXX): point this at the real doc once it exists -->` and remove the link. Anchor any such TODO to a tracking spec ID. |

### 7. Acceptance Criteria

This spec is "done" when:

- [ ] `pnpm docs:check-links` exits 0 on `staging` HEAD.
- [ ] **Documentation CI → Check Internal Links** is green on the first PR that touches `docs/**` after T-106-12 lands.
- [ ] No `<!-- TODO -->` placeholders introduced without a spec ID anchor.
- [ ] No referenced file deletions during this cleanup are surprises — each one either flips the referencing prose or is logged in the per-task PR body.

## Part 2 — Implementation Notes

### Source

Originally surfaced as a side effect of fixing the check-links infinite-loop bug in SPEC-101 commit `960aeb5ba`. The bug masked these 299 pre-existing issues for an unknown time (months at least, given the affected docs span multiple older specs).

### When to start

Low priority. Documentation CI failing red doesn't block merges per current GitHub branch protection (the PR for SPEC-101 was MERGEABLE despite docs CI red). However:

- **Before public launch** would be nice — clean docs CI looks more professional in the repo.
- **After public launch** acceptable — the regression risk is zero (these are link references, not code).

### Sequencing relative to active specs

- **Independent of SPEC-101** (newsletter MVP): SPEC-101 only added good docs (ADR-027, README updates) that don't appear in the 299-link report.
- **Independent of SPEC-104** (beta-to-prod migration): doesn't touch docs.
- **Independent of SPEC-105** (E2E nightly repair): doesn't touch docs.
- Should ideally land **before** new docs-heavy specs to keep the cleanup boundary clean.

### Tooling

The link checker (`scripts/check-links.ts`) is the single source of truth. The script:

- Globs `{docs,apps,packages}/**/*.md`.
- Extracts relative + absolute internal links from each file.
- Resolves and checks each target with `fs.existsSync`.
- Exits 0 / 1 with a per-link report.

No external HTTP. No anchor / fragment checking. Out of scope here: extending the script to check anchors within target files (separate spec if we want it).
