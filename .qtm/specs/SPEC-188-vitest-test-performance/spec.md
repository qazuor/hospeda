---
spec-id: SPEC-188
title: Vitest Test-Suite Performance — Cut Per-File Overhead Without Saturating the Machine
type: improvement
complexity: medium
status: draft
created: 2026-06-02T00:00:00Z
tags: [ci, testing, vitest, performance, infrastructure, monorepo]
---

# SPEC-188 — Vitest Test-Suite Performance

## 1. Overview

### Goal

Reduce the **wall-clock of the Unit Tests suite** by attacking the **per-file
test overhead** (vitest worker startup + environment init per file), measured
and applied lever-by-lever, **without increasing — and ideally while bounding —
the total concurrency**, because the machine that runs PR CI (the self-hosted
`leo-laptop` runner) is the same class of machine developers use locally, and it
**hangs and needs a hard reboot when too many test processes run in parallel**.

### Motivation

- The 4-way sharded Unit Tests job was calibrated at ~13-15 min/shard (PR #1060)
  with a 20 min cap. After SPEC-165 (comments), SPEC-170 (permission panel),
  SPEC-177 (FAQ), and the baseline-recovery additions, every shard now runs
  ~18-20 min, so shards 1 & 3 began **hitting the 20 min cap and getting
  cancelled** on `ubuntu-latest`.
- PR #1386 raised the cap 20 → 30 min as a **band-aid**. This spec is the
  structural fix.
- Profiling `apps/api` shows the bottleneck is **systemic per-file cost**, not a
  few slow outliers: the slowest file (`auth.test.ts`, 13.2s) is **1 of 268**,
  so optimising individual files yields <5%. The cost is `vitest startup + env
  init` multiplied across hundreds of files (the existing `ci.yml` comment
  already says so).
- **Hard constraint (the machine):** running many test processes in parallel
  **crashes `leo-laptop` / the dev machine** (RAM/CPU exhaustion → hang →
  reboot; observed 2026-06-02). The current layout is `turbo` running many
  packages concurrently, each vitest config using `pool: 'forks'` with
  `maxForks: 3` → potentially dozens of forks at once. On hosted CI each shard
  is its own VM so this is invisible; locally it is fatal.

### Success Criteria

- **SC-1 (correctness):** the full unit suite stays green; **zero new flakes**
  introduced (validated by repeated runs — see Testing Strategy).
- **SC-2 (speed):** measurable reduction in per-shard wall-clock on hosted CI
  vs the current baseline. Target: comfortably back under the original
  13-15 min/shard band (so the 30 min cap has large margin). The exact target is
  set after the baseline measurement in Phase 1.
- **SC-3 (machine safety):** a local full-suite run (`pnpm test`) completes on
  `leo-laptop`/dev **without exhausting memory or hanging** — a bounded,
  documented peak concurrency. This is a **gate**, not a nice-to-have.
- **SC-4 (single source of truth):** the tuning lives in **one shared base
  config** that every package extends, so future packages inherit it and the
  knobs are changed in one place.

## 2. User Stories & Acceptance Criteria

### US-1 — As a developer, `pnpm test` does not crash my machine

- **Given** a developer (or the `leo-laptop` runner) runs the full unit suite,
- **When** the suite executes,
- **Then** total concurrent test processes stay within a documented, bounded cap
  (turbo concurrency × vitest pool size), and the machine completes the run
  without OOM/hang.
- **AC-1.1:** there is an explicit, documented ceiling on `turbo` concurrency
  for the `test` task AND on vitest `maxForks`/`maxWorkers`, such that their
  product cannot exceed a safe number for an 8-16 GB / N-core laptop.
- **AC-1.2:** a local full-suite run is observed to complete without the machine
  hanging (manual sign-off recorded in the spec's validation log).

### US-2 — As a maintainer, CI shards finish well under the cap

- **Given** the Unit Tests job on `ubuntu-latest`,
- **When** a shard runs,
- **Then** each shard's wall-clock is meaningfully below the prior baseline and
  far below the 30 min cap.
- **AC-2.1:** post-change shard times are recorded and compared against the
  pre-change baseline; the improvement is quantified in the PR.
- **AC-2.2:** no shard exceeds the original 13-15 min band on hosted CI (stretch;
  final target locked after Phase 1 baseline).

### US-3 — As a maintainer, the suite has no new flakes

- **Given** any pool/isolation change (e.g. `pool: 'threads'`, `isolate: false`),
- **When** the suite runs repeatedly,
- **Then** results are deterministic across runs.
- **AC-3.1:** each accepted lever is validated with **≥3 consecutive green full
  runs** of the affected packages before it is kept. Any lever that produces a
  single flake is reverted or scoped out.
- **AC-3.2:** the `.only`/`.skip` guard and existing coverage thresholds keep
  passing unchanged.

### US-4 — As a maintainer, config is centralised

- **Given** the 26 per-package vitest configs,
- **When** the tuning is applied,
- **Then** shared knobs (pool, isolate, environment defaults, timeouts) come from
  a single base config the others extend.
- **AC-4.1:** a `vitest.shared.config.ts` (name TBD) exists and is extended by
  every package config via `mergeConfig`.
- **AC-4.2:** per-package configs retain only what is genuinely package-specific
  (aliases, setupFiles, coverage thresholds, environment override).

## 3. Technical Approach

### Current state (measured)

- Root `vitest.config.ts` registers all packages via `test.projects`.
- **All 19 tested packages use `pool: 'forks'`**, `maxForks: 3`, `isolate`
  default (true).
- `environment: 'node'` for api/service-core/db/etc.
- `environment: 'jsdom'` for **5 packages only**: `apps/admin`, `apps/web`,
  `packages/auth-ui`, `packages/feedback`, `packages/icons`.
- No shared base config — 26 configs duplicate the same knobs.

### Levers to evaluate (measure-then-decide; do NOT apply blind)

The work is **experiment-driven**. Each lever is measured in isolation against a
fixed baseline, kept only if it gives real gain with **no flakes** and **no
concurrency increase beyond the safe cap**.

1. **Pool: `threads` vs tuned `forks`.** `threads` (worker_threads) has lower
   per-file startup than `forks` (child_process) and lower memory footprint —
   attractive for the machine-safety constraint. Risk: shared-memory pollution,
   native-addon incompatibility. Must audit global state / non-reentrant
   modules. Measure both; pick per-package if needed.
2. **`isolate: false`** (reuse the environment across files in a worker). Large
   speedup AND fewer processes (machine-friendly), but high pollution risk
   (unreset mocks, singletons, module-level state). Only where a package's tests
   are proven clean. Likely safe for pure schema/util packages, risky for
   route/service suites that instantiate apps.
3. **Environment split (`environmentMatchGlobs` / per-file `// @vitest-environment
   node`).** Within the 5 jsdom packages, run only true DOM/component tests under
   jsdom; everything else under `node` (jsdom init is a big per-file cost). Also
   evaluate `happy-dom` as a lighter DOM than `jsdom` for the component tests
   that remain.
4. **Concurrency cap (the machine-safety lever).** Bound `turbo` `--concurrency`
   for the `test` task and/or vitest `maxForks`/`maxWorkers` so the product of
   (parallel packages) × (forks per package) stays under a safe ceiling locally.
   On hosted CI (one VM per shard) the cap can differ. Consider a
   `VITEST_MAX_FORKS` env knob read by the shared config so local and CI use
   different values from the same config.
5. **Shared setup cost.** Audit `setupFiles` for expensive per-file work that
   could be hoisted or made lazy.

### Architecture of the change

- Add `vitest.shared.config.ts` at the repo root exporting a base `test` config
  (pool, isolate, environment default `node`, timeouts, the concurrency/forks
  knob driven by env). Each package config uses `mergeConfig(shared, { ...local
  overrides })`.
- jsdom packages set `environment: 'jsdom'` only via `environmentMatchGlobs` for
  their component globs; the rest inherit `node`.
- The local-vs-CI concurrency difference is driven by env vars (e.g.
  `VITEST_MAX_FORKS`, turbo `--concurrency`) so one config serves both, honouring
  the machine-safety cap locally.

### Files (indicative)

- NEW `vitest.shared.config.ts`.
- MODIFIED: 26 `vitest.config.ts` across `apps/*` and `packages/*` (extend
  shared, drop duplicated knobs).
- MODIFIED `turbo.json` (test task concurrency, if used as the cap).
- MODIFIED `.github/workflows/ci.yml` (pass CI-side concurrency env; possibly
  lower the cap back toward 20 once gains land — separate decision).
- NEW `docs/guides/test-performance.md` (the knobs, the machine-safety cap, how
  to re-measure).

## 4. Constraints

- **C-1 (machine safety — overriding):** no change may raise peak local
  concurrency. The dev/runner machine hangs under heavy parallel test load
  (observed). Bounding concurrency is in scope and is a success gate (SC-3).
- **C-2:** no product/behaviour changes — test infra/config only.
- **C-3:** coverage thresholds and the `.only/.skip` guard must keep passing.
- **C-4:** changes are reversible per-package (a lever that flakes one package is
  scoped out without blocking the rest).

## 5. Risks

| Risk | Impact | Likelihood | Mitigation |
| --- | --- | --- | --- |
| `threads`/`isolate:false` introduce test pollution / flakes | High | Medium | Per-lever ≥3 green-run gate (AC-3.1); audit global/module state; scope out per-package on any flake |
| Lowering concurrency to protect the machine slows hosted CI | Medium | Medium | Drive local vs CI concurrency from separate env values; CI VMs are isolated so keep CI parallelism while capping local |
| 26-config migration introduces drift/regressions | Medium | Medium | Centralise via `mergeConfig`; migrate package-by-package with the suite green after each |
| `happy-dom` behaves differently from `jsdom` for some component tests | Medium | Low | Only adopt where the package's component tests pass identically; keep jsdom otherwise |
| Native addons break under `threads` | Medium | Low | Detect during measurement; keep `forks` for affected packages |
| Re-measurement needed as suite grows | Low | High | Document the measurement procedure so it can be re-run |

## 6. Testing / Validation Strategy

This spec changes test infrastructure, so "tests" = **validating the test runner
itself** does not regress correctness, determinism, or machine safety.

- **Baseline (Phase 1):** record current per-package and per-shard timings + a
  local peak-memory/concurrency observation **before** any change. This is the
  comparison point for every lever. (Run sequentially / package-by-package to
  avoid hanging the machine — do NOT fan out heavy parallel runs locally.)
- **Per-lever validation:** for each accepted lever, run the affected packages
  **≥3 consecutive times fully green** (AC-3.1). Record before/after timings.
- **Determinism check:** run the full suite (in CI, where it's safe to
  parallelise) at least twice; results must match.
- **Machine-safety gate (SC-3):** a manual local full-suite run on
  `leo-laptop`/dev that completes without hang; sign-off recorded in the spec.
- **Coverage gate:** existing coverage thresholds still pass.
- **Guard gate:** `.only`/`.skip` guard still green.
- No new product tests are added (no product code changes); existing suites are
  the regression surface.

## 7. Out of Scope

- Rewriting or splitting individual slow test files for micro-gains (<5%;
  explicitly rejected by profiling).
- Changing the sharding count (4-way) — orthogonal; revisit only if needed after
  these gains.
- E2E / integration suites (separate configs, separate runners) — unit only.
- Reverting the #1386 timeout bump (keep the safety margin; lowering it is a
  later decision once gains are proven).
- Product/behaviour changes of any kind.

## 8. Tasks (Suggested)

#### Phase: setup / measurement

- Establish baseline: per-package + per-shard timings; local peak memory &
  safe-concurrency observation (sequential, machine-safe).
- Lock SC-2 target and the SC-3 concurrency ceiling from the baseline.

#### Phase: core (lever experiments, measure-then-keep)

- Spike `pool: 'threads'` on a representative node package; measure + 3× green.
- Spike `isolate: false` on a pure (schema/util) package; measure + 3× green.
- Spike environment split (`environmentMatchGlobs` / `happy-dom`) on `admin`;
  measure + 3× green.
- Decide per-package the winning combination from the spikes.

#### Phase: integration

- Add `vitest.shared.config.ts` with env-driven concurrency knob.
- Migrate node packages to extend shared (package-by-package, green after each).
- Migrate jsdom packages with the environment split.
- Wire the concurrency cap (turbo `--concurrency` + vitest forks/threads env) for
  local vs CI.

#### Phase: testing / validation

- Determinism: ≥2 full CI runs match; ≥3 green per changed package.
- Machine-safety gate: local full-suite completes without hang (sign-off).
- Confirm coverage + guards still pass.

#### Phase: docs / cleanup

- `docs/guides/test-performance.md`: knobs, caps, re-measure procedure.
- Update the `ci.yml` test-unit comment with the new baseline; decide whether to
  lower the 30 min cap.

## 9. Internal Review Notes

- **Strengthened during review:** machine-safety (SC-3 / C-1) elevated to a
  first-class gate after the user reported the dev/runner machine hanging under
  parallel test load (2026-06-02) — this reframes the spec from "go faster via
  more parallelism" to "go faster via less per-file cost, with bounded
  concurrency."
- **Open questions for the user (pre-implementation):**
  1. SC-2 numeric target — set after the Phase 1 baseline, or fix a number now
     (e.g. ≤12 min/shard)?
  2. The safe local concurrency ceiling depends on `leo-laptop` specs (cores/RAM)
     — provide them so the cap (AC-1.1) is concrete.
  3. Adopt `happy-dom` if it proves faster and behaviour-equal, or stay on
     `jsdom` to avoid any DOM-semantics risk?
- **External docs to verify at implementation time:** Vitest config reference for
  `pool`, `poolOptions`, `isolate`, `environmentMatchGlobs`, and `mergeConfig`
  (Vitest v3) — verify against current docs before applying, since these APIs
  have shifted across versions.
