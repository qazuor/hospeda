---
spec-id: SPEC-188
title: Vitest Test-Suite Performance — Cut Per-File Overhead Without Saturating the Machine
type: improvement
complexity: medium
status: completed
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

### Measured baseline — `apps/api` (2026-06-02, the bottleneck package)

Partial Phase-1 measurement run on the dev machine (16 cores / 62 GB, 3 workers,
`apps/api` unit suite: 268 files / 4002 tests, run package-by-package so the
machine stayed safe). Raw outputs: `/tmp/api_{forks,threads,noiso}_*.txt`.

| Config | Wall-clock | collect¹ | tests¹ | Result |
| --- | --- | --- | --- | --- |
| `forks` (current, isolate ON) | ~421s | **1101s** | **69s** | ✅ 266 passed |
| `threads` (`maxThreads:3`) | — | — | — | 💥 **SIGSEGV crash** |
| `isolate:false` (forks) | ~52-69s | ~68-79s | 61-109s | ❌ **128/268 files fail, non-deterministic** |

¹ `collect`/`tests` are CPU-time aggregated across the 3 workers (vitest's own
`Duration` breakdown), not wall-clock — they sum above the total.

**The killer number:** `collect : tests` ≈ **16 : 1** (1101s vs 69s). Over **90%**
of the cost is per-file cold-import / transform / module instantiation; **under
10%** is real test execution. This confirms the spec's core thesis with our own
data — optimising individual slow files is futile; the cost is structural per-file
startup.

**But the two cheap levers do NOT work on `apps/api`:**

- **`threads` → segfaults.** The suite crashes (SIGSEGV) mid-run. A native-addon
  / non-thread-safe module (most likely `better-auth` under `worker_threads`)
  is incompatible with the threads pool. Matches Risk "Native addons break under
  threads". **Verdict: forks-only for api.**
- **`isolate:false` → collapses collect (~94%: 1101s→~70s) but breaks 128/268
  files** (851-1207 test failures) and is **non-deterministic** across runs
  (1207 fails one run, 851 the next). Massive shared-state pollution — unreset
  mocks, module-level singletons, app instances leaking between files. The wall
  numbers above are NOT a valid speedup; they are a broken suite failing fast.
  **Verdict: not usable on api without per-file isolation remediation** — which is
  the large, high-flake-risk work the spec flags for route/service suites.

**Implication (recalibration):** the >90% overhead is real, but in the bottleneck
package the speedup is **NOT a config quick-win**. Recovering it requires the hard
path: either per-file isolation cleanup (reset mocks/singletons so `isolate:false`
becomes safe) or shrinking the import graph (lazy-load `better-auth` /
`service-core`, trim `setup.ts`). The cheap levers (`isolate:false`) likely still
pay off on **pure schema/util packages**, but those are not the bottleneck. See
the revised lever notes and the split-track plan below.

### Levers to evaluate (measure-then-decide; do NOT apply blind)

The work is **experiment-driven**. Each lever is measured in isolation against a
fixed baseline, kept only if it gives real gain with **no flakes** and **no
concurrency increase beyond the safe cap**.

1. **Pool: `threads` vs tuned `forks`.** `threads` (worker_threads) has lower
   per-file startup than `forks` (child_process) and lower memory footprint —
   attractive for the machine-safety constraint. Risk: shared-memory pollution,
   native-addon incompatibility. Must audit global state / non-reentrant
   modules. Measure both; pick per-package if needed.
   > **MEASURED 2026-06-02 — `apps/api`: REJECTED.** `--pool=threads` segfaults
   > (SIGSEGV) mid-suite. Keep `forks` for api. Re-evaluate per-package only for
   > packages with no native-addon / non-thread-safe deps (pure schema/util).
2. **`isolate: false`** (reuse the environment across files in a worker). Large
   speedup AND fewer processes (machine-friendly), but high pollution risk
   (unreset mocks, singletons, module-level state). Only where a package's tests
   are proven clean. Likely safe for pure schema/util packages, risky for
   route/service suites that instantiate apps.
   > **MEASURED 2026-06-02 — `apps/api`: REJECTED as-is.** Cuts collect ~94%
   > (1101s→~70s) but breaks 128/268 files with non-deterministic pollution
   > failures. Confirms the "risky for route/service suites" caveat empirically.
   > Only viable on api AFTER per-file isolation remediation (see split-track).
   > Still a candidate for pure schema/util packages — measure those separately.
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

### SC-3 concurrency ceiling (Track A, locked 2026-06-03)

**Machine:** leo-laptop — 16 cores / 62 GB RAM. RAM is NOT the constraint; CPU is.

**Formula:** `safe_ceiling = cores - 4 = 16 - 4 = 12`

Reserve 4 cores for OS, IDE, and turbo orchestration overhead. The remaining 12
are split as: `turbo_concurrency × vitest_maxForks = 4 × 3 = 12 peak processes`.

**Chosen local cap: turbo concurrency 4 × maxForks 3 = 12.**

Why turbo=4, not 6 or 8? With `maxForks=3` each package spawns 3 forks. At
turbo concurrency 4, at most 4 packages run simultaneously → 12 forks. At
turbo concurrency 6 → 18 forks, which is 6 cores over the ceiling and into the
territory that caused the original hangs. 4 is the largest value that keeps the
product ≤ 12.

**CI divergence (intentional):** on CI each shard runs in an isolated VM so
machine-safety does not apply. CI uses `VITEST_MAX_FORKS=4` (higher throughput,
no shared machine) with `--concurrency=4` (already inline in ci.yml). CI peak
per shard = 1 active package × 4 forks = 4 forks.

**Where the cap lives:**

- `vitest.shared.config.ts` (root) — reads `VITEST_MAX_FORKS` env, defaults to 3.
- `turbo.json` `test` task — `"concurrency": 4`.
- `.github/workflows/ci.yml` `test-unit` job `env:` — `VITEST_MAX_FORKS: 4`.
- Root `pnpm test` script — `--concurrency=4` (redundant guard against direct
  turbo invocations that bypass the task-level cap).

**Full rationale:** `docs/guides/test-performance.md`.

### Revised plan — split tracks (post-measurement, 2026-06-02)

The api measurement shows the work splits into two tracks with very different
cost/risk/value. Treat them as independently shippable so the cheap win is not
held hostage by the expensive one.

**Track A — machine-safety concurrency cap (cheap, low-risk, ship first).**
Bound `turbo --concurrency` × vitest `maxForks`/`maxWorkers` (env-driven: tight
locally, looser on CI's one-VM-per-shard). Does NOT touch pool/isolate, so it
carries zero pollution risk. Directly fixes SC-3 (local `pnpm test` stops
hanging). This is worth doing **regardless of any speedup** and is the
recommended first deliverable. It does not reduce CI wall-clock — it bounds peak
parallelism.

**Track B — per-file overhead reduction (expensive, gated, the real speedup).**
The >90% cold-import overhead lives here. In `apps/api` neither cheap lever
applies (threads segfaults, `isolate:false` breaks 128 files), so Track B is NOT
a config tweak — it is one of:

- **B1 (isolation remediation):** make api's suites `isolate:false`-safe by
  resetting mocks/singletons/app instances per file (audit `setup.ts` +
  module-level state). High effort, high flake-risk, but unlocks the ~94% collect
  saving. Validate with the ≥3-green gate per package; scope out on any flake.
- **B2 (import-graph diet):** lazy-load the heavy graph (`better-auth`,
  `service-core`) and trim `setup.ts` so each file cold-imports less. Lower
  pollution risk than B1, attacks the same `collect` cost from the other side.
  Measure B2 first — it may yield meaningful gains without the isolation rewrite.
- **Pure packages (schemas/utils/etc.):** `isolate:false` and possibly `threads`
  are likely safe and cheap here — apply lever-by-lever with the green gate. Low
  absolute impact (they are not the bottleneck) but free wins.

**SC-2 recalibration:** the original "back under 13-15 min/shard" target assumed
config-only tuning. With Track B being real engineering, set the SC-2 number
**after** a B2 import-graph spike on api — do not promise a % up front.

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
| `threads`/`isolate:false` introduce test pollution / flakes | High | **Confirmed (api)** | **MEASURED: `isolate:false` breaks 128/268 api files non-deterministically.** Per-lever ≥3 green-run gate (AC-3.1); audit global/module state; scope out per-package on any flake. On api, isolate:false is gated behind Track-B isolation remediation |
| Lowering concurrency to protect the machine slows hosted CI | Medium | Medium | Drive local vs CI concurrency from separate env values; CI VMs are isolated so keep CI parallelism while capping local |
| 26-config migration introduces drift/regressions | Medium | Medium | Centralise via `mergeConfig`; migrate package-by-package with the suite green after each |
| `happy-dom` behaves differently from `jsdom` for some component tests | Medium | Low | Only adopt where the package's component tests pass identically; keep jsdom otherwise |
| Native addons break under `threads` | Medium | **Confirmed (api)** | **MEASURED: `--pool=threads` segfaults (SIGSEGV) on api.** Keep `forks` for api; only spike threads on packages with no native-addon / non-thread-safe deps |
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

- ~~Establish baseline for `apps/api`~~ **DONE 2026-06-02** (see Measured
  baseline §3): forks ~421s, collect:tests 16:1, threads segfaults,
  `isolate:false` breaks 128 files. Outputs in `/tmp/api_*`.
- Extend baseline to the other heavy node packages (`service-core`, `db`) and
  capture per-shard timings on CI, still sequential / machine-safe locally.
- Lock the SC-3 concurrency ceiling from the dev-machine spec; defer the SC-2
  numeric target until after the Track-B B2 spike.

#### Phase: Track A — machine-safety concurrency cap (cheap, ship first)

- Add the env-driven `turbo --concurrency` × vitest `maxForks` cap; document the
  safe local ceiling. Validate SC-3: local full `pnpm test` completes without
  hang (sign-off). No pool/isolate change → no pollution risk.

#### Phase: Track B — per-file overhead (gated, the real speedup)

- **B2 first (lower risk):** spike import-graph diet on `apps/api` — lazy-load
  `better-auth` / `service-core`, trim `setup.ts`; measure `collect` delta + 3×
  green. Use it to set the SC-2 target.
- **B1 (if B2 insufficient):** isolation remediation to make api
  `isolate:false`-safe (reset mocks/singletons/app instances per file); measure +
  3× green; scope out on any flake.
- **Pure packages:** spike `isolate:false` (and `threads` where no native addon)
  on a schema/util package; measure + 3× green; keep only clean wins.
- **jsdom packages:** spike environment split (`environmentMatchGlobs` /
  `happy-dom`) on `admin`; measure + 3× green.
- `pool: 'threads'` on `apps/api` is **REJECTED** (segfault) — do not re-spike.

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

### T-007 audit — apps/api import graph (2026-06-03)

#### Source-file counts (what vite must transpile or instantiate)

| Package / scope | TS source files | Alias target |
| --- | --- | --- |
| `packages/schemas/src` | 414 | `@repo/schemas → src` |
| `apps/api/src` | 742 | `@ → src` |
| `packages/service-core/src` | 200 | `@repo/service-core → src` |
| `packages/db/src` | 156 | `@repo/db → src` |
| `packages/config/src` | 27 | `@repo/config → src` |
| `packages/billing/src` | 20 | `@repo/billing → src` |
| `packages/notifications/src` | 36 | `@repo/notifications → src` |

No `dist/` directory exists for any of these packages in this worktree; every
alias points to **TypeScript source**. Vite transpiles each `.ts` file on first
access. With `isolate: true` (default), module instantiation runs fresh per
test file even if vite's transform result is cached on disk.

#### How many unit test files pay each cost

Of the **267 unit test files** (after excluding `test/e2e/` and
`test/integration/` per the vitest config):

| Pattern | Files | What cold-imports on every collect |
| --- | --- | --- |
| `initApp()` import | **94** | Full app graph: `app.ts` → `routes/index.ts` (40+ route barrels) → `@repo/service-core` (200 files) + `@repo/schemas` (414 files) + `@repo/db` (156 files) + `@repo/billing` + `@sentry/node` + `@sentry/profiling-node` |
| `vi.mock('@repo/service-core', async (importOriginal) ⇒ { actual = await importOriginal() })` in **setup.ts** | **ALL 267** | `importOriginal()` forces a full load of the real `@repo/service-core` source — 200 files + transitive deps (`@repo/schemas` 414, `@repo/db` 156, `drizzle-orm`) — on every single file, even ones that never reference service-core |
| `vi.mock('@repo/db', async (importOriginal) …)` in individual test files | **46** | Real `@repo/db` source (156 files + `drizzle-orm` native bindings) |
| 174 unit files with **zero** `@repo/service-core` reference | **174** | STILL pay the full `importOriginal('@repo/service-core')` cost via setup.ts — 100% wasted |

**The dominant cost is setup.ts `importOriginal('@repo/service-core')` called 267×.**

#### Ranked import cost list (qualitative, highest to lowest)

1. **`@repo/service-core` real-module load via `importOriginal()` in setup.ts (ALL 267 files)**
   Every test file — including 174 that never touch service-core — pays the
   full cost of loading 200 service-core TS files plus their transitive deps:
   414 schemas, 156 db models, `drizzle-orm`, `@qazuor/qzpay-core`. This is
   paid 267× and is the single biggest lever for T-008.

2. **Full app graph via `initApp()` (94 files)**
   `initApp` → `app.ts` → `routes/index.ts` imports all 40+ route barrels in
   one static graph. Each barrel is itself a barrel that imports 3–5 route
   handler files, each of which imports `@repo/service-core`, `@repo/schemas`,
   the route-factory, `@hono/zod-openapi`, etc. All these route source files
   (742 in `apps/api/src`) get loaded, and the full middleware chain runs
   (including `sentryMiddleware` → `@sentry/node` + `@sentry/profiling-node`).

3. **`@sentry/profiling-node` (native .node addon) loaded by ALL 94 `initApp` files**
   `create-app.ts` registers `sentryMiddleware()` unconditionally. `sentry.ts`
   imports `@sentry/profiling-node` at module top-level. This loads a native
   C++ addon (`sentry_cpu_profiler-linux-x64-glibc-*.node`) — confirmed present
   in the pnpm store. This addon is **almost certainly the cause of the
   `threads` pool SIGSEGV** (native addons are not thread-safe) and adds
   meaningful load cost for the 94 `initApp` files that can't be thread-pooled.
   Sentry is NOT globally mocked in `setup.ts`.

4. **`@repo/schemas` (414 files, Zod schema instantiation)**
   Pulled in transitively by service-core, db, and most route handler imports.
   Zod schema objects are created at module scope (`z.object(…)` calls), so all
   414 files execute JavaScript at instantiation time. This cost is already
   included in items 1–2 above but would be separately visible if service-core
   were lazy-loaded.

5. **`@repo/db` (156 files + drizzle-orm) — 46 test files load the real module**
   Individual test files that call `vi.mock('@repo/db', async (importOriginal)
   ⇒ { actual = await importOriginal() })` load real drizzle-orm and all 156 db
   source files. The global setup.ts `vi.mock('@repo/db')` does NOT call
   `importOriginal`, so the remaining ~221 files do not pay this cost.

6. **`@repo/service-core` direct per-file `importActual`/`importOriginal` — 79 files**
   Beyond setup.ts, 79 individual test files also call `vi.importActual` or
   `importOriginal` for `@repo/service-core`. This is additive on top of
   setup.ts but occurs within the same isolated module context so may share the
   transform cache.

7. **`auth.ts` / `better-auth` — light overall but blocked by `threads`**
   Only 1 source file imports `better-auth` directly (`apps/api/src/lib/auth.ts`),
   and `auth.ts` uses a lazy `getAuth()` factory so the `betterAuth(…)` call
   doesn't execute at import time. However, the top-level `import { betterAuth }
   from 'better-auth'` still loads the `better-auth` package at module init.
   For the 94 `initApp` files, `auth.ts` is in the app graph. `better-auth` is
   the likely second cause of the threads SIGSEGV alongside `@sentry/profiling-node`.

#### What setup.ts does per file

```
setup.ts MODULE SCOPE (runs before any test, 267×):
  1. process.env.* assignments                         — CHEAP, ~0ms
  2. if (!globalThis.crypto) …                         — CHEAP
  3. vi.mock('@repo/logger', () => {…})                — CHEAP: no importOriginal,
                                                          pure literal mock object
  4. vi.mock('@repo/db', async () => { createDbMock() })
                                                       — CHEAP: no importOriginal,
                                                          createDbMock() is pure JS
                                                          class definitions, zero
                                                          external imports
  5. vi.mock('@repo/db/schemas', () => {…})            — CHEAP: static object literal
  6. vi.mock('@repo/service-core', async (importOriginal) => {
         const actual = await importOriginal()         — EXPENSIVE: loads 200 real
                                                          service-core TS files +
                                                          414 schemas + 156 db +
                                                          drizzle-orm + qzpay-core
         /* then imports 8 mock helper files */        — LIGHTWEIGHT: these files
                                                          have no external imports
                                                          (only ServiceErrorCode
                                                          from @repo/schemas which
                                                          is cheap via cache)
     })

setup.ts beforeAll (runs once per file, after mocks):
  7. await import('../src/utils/env')                  — MODERATE: env.ts loads
                                                          @repo/config (27 files),
                                                          dotenv, zod; runs
                                                          existsSync + dotenv.config()
  8. await import('@repo/logger') → .configure(…)     — CHEAP: logger is mocked
```

**Item 6 is responsible for the vast majority of the 1101s collect cost.**
The 8 mock helper files themselves (content-services.ts, billing-services.ts,
etc. — 5010 lines total) have no heavy external imports and are negligible.

#### Why `importOriginal` is called in setup.ts

The comment in setup.ts reads: *"Pass through all actual exports (types, enums,
pure functions) then override service classes."* The spread `...actual` passes
non-service exports through so individual test files can import enums, error
classes, and utility functions from `@repo/service-core` without each test
file needing its own `importActual` call.

**Audit of what the spread actually provides at runtime:**

- `RoleEnum`, `VisibilityEnum`, etc. — re-exported from `@repo/schemas` (NOT
  service-core-specific; these could be imported directly from `@repo/schemas`
  in the few test files that need them at runtime)
- `ServiceError` class — used in ~10 test files; could be inlined as a
  standalone lightweight class in `test/helpers/mocks/service-error.ts`
  (a 21-line stub already exists there)
- `ADDON_RECALC_SOURCE_ID`, `BILLING_EVENT_TYPES` — string/object constants;
  could be inlined as test-only stubs
- `diffPlanFields`, `insertPlanAuditLog`, `getDefaultPromoCodeConfigs`,
  `getRevalidationService`, `mapDbToPlan` — functions used in a handful of
  service/cron tests; these tests could use `vi.importActual` locally
- `RoleEnum` — already exported by `@repo/schemas`; test files could import
  it from there directly

**Conclusion:** the `importOriginal` call in setup.ts provides a convenience
layer for ~20–25 test files, but every one of the 174 test files that never
use service-core pays the full 200-file load cost to support this convenience.

#### Alias-to-source transpile cost: the big lever discussion

All `@repo/*` aliases point to TypeScript **source**, not **dist**. This
means vite must:

1. **Transform** (TS→JS): cached to disk on warm runs (vite transform cache).
   After a first full run, transforms should be cache-hits. No `.vite/` cache
   dir was found in this worktree, meaning transforms have never been warmed
   here — a first run is fully cold.
2. **Instantiate** (run module body): ALWAYS happens per isolated file.
   All `z.object(…)`, `drizzle.table(…)`, and class definitions in 414+200+156
   files execute fresh for every test file. This is the dominant cost on warm
   runs after transforms are cached.

**Dist lever:** If `@repo/schemas`, `@repo/service-core`, `@repo/db` pointed
to prebuilt **dist** (a single bundled `.js`), instantiation would involve one
or a small number of module bodies instead of 770+ individual files. This is
potentially the largest single improvement and would benefit ALL 267 files.

**Prerequisites and risks:**

- `turbo.json test.dependsOn = ["build"]` uses the **own** build, not `^build`.
  Changing to `^build` would ensure all dependency packages have dist before
  tests run, but would add build time to every test run for affected packages.
  Alternative: a separate `build:deps` step run once before the test suite
  (the api already has `scripts.build:deps` that does exactly this).
- The alias override in `vitest.config.ts` must be changed per package.
  For packages under active development this creates a risk of stale dist; a
  CI gate or `pnpm build` step must precede tests.
- For **local development** (watch mode), using dist means schema/service
  changes don't reflect in tests without rebuilding. A dev could run
  `pnpm --filter @repo/schemas build --watch` alongside vitest but this is
  cumbersome. **Recommended scope:** use dist in CI only; keep src alias for
  local watch mode, driven by `NODE_ENV` or a `VITEST_USE_DIST` env flag.
- The `@repo/service-core` mock in setup.ts calls `importOriginal()` which
  would also use the dist (or src, depending on the alias). If dist is a
  single bundle, `importOriginal()` loads one file instead of 200 — large
  gain. If the dist is not tree-shaken (CJS bundle with all 200 modules),
  the gain is from fewer file-system operations and less module resolution
  overhead, not fewer module bodies.

**Flag for discussion (T-009 / T-010):** before building the alias-to-dist
lever, measure whether the `importOriginal` removal (T-008) alone closes
enough of the gap, since it's lower-risk and doesn't require build-pipeline
changes.

---

#### T-008 concrete plan — lazy-load / remove importOriginal

**Target: eliminate the `importOriginal('@repo/service-core')` call in setup.ts.**

This is the highest-leverage single change. It eliminates a 200-file +
transitive load that currently runs for ALL 267 test files (including 174 that
never use service-core).

**Step 1 (setup.ts): Replace `importOriginal` with an inlined minimal passthrough.**

Instead of:

```ts
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<…>();
    return { ...actual, PostService, AccommodationService, … };
});
```

Use:

```ts
vi.mock('@repo/service-core', async () => {
    // Inline the lightweight non-service values that tests actually need
    // at runtime (enum objects, error class, constants).
    // These are the only runtime values from @repo/service-core used in
    // non-service-specific tests; all others are `import type` (erased).
    const { ServiceError } = await import('./helpers/mocks/service-error');
    // RoleEnum, VisibilityEnum, etc. live in @repo/schemas — use re-export stubs
    const { RoleEnum, VisibilityEnum, LifecycleStatusEnum, ModerationStatusEnum,
            PermissionEnum, ServiceErrorCode, EntityPermissionReasonEnum } =
        await import('@repo/schemas');
    return {
        // Service classes: mocked implementations
        PostService, TagService, …,
        // Non-service runtime values: inlined from their actual source
        ServiceError,
        RoleEnum, VisibilityEnum, LifecycleStatusEnum, ModerationStatusEnum,
        PermissionEnum, ServiceErrorCode, EntityPermissionReasonEnum,
    };
});
```

**What this avoids:** loading `packages/service-core/src` (200 files) +
`packages/db/src` (156 files + drizzle-orm) + `packages/schemas/src` (414
files) on every test-file collect.

**What still loads:** `@repo/schemas` (414 files) — but only once per
worker via the module cache (all 267 files share it within a worker), not
267 fresh instantiations.

**Files to check before applying:**

- `apps/api/test/setup.ts` lines 223–363: the full `vi.mock('@repo/service-core')`
  block.
- `packages/service-core/src/types/index.ts`: confirm `ServiceError` class
  definition is fully self-contained (no drizzle/db imports at class level).
- `apps/api/test/helpers/mocks/service-error.ts` (21 lines): already has a
  standalone `ServiceError` stub; verify it matches the interface expected by
  callers.
- Individual test files that use `ADDON_RECALC_SOURCE_ID`, `BILLING_EVENT_TYPES`,
  `diffPlanFields`, `insertPlanAuditLog`, `getDefaultPromoCodeConfigs`,
  `getRevalidationService`, `mapDbToPlan`, `NoOpRevalidationAdapter`,
  `RevalidationService` — these were previously passed through via `...actual`;
  after removal they must either be added as inline stubs in the mock OR those
  specific test files must use `vi.importActual` locally. The latter is safer
  (don't burden ALL 267 files with every function that only 3–5 files need).

**Step 2 (setup.ts): Add global vi.mock for `@sentry/node` + `@sentry/profiling-node`.**

`@sentry/profiling-node` loads a native `.node` addon (confirmed:
`sentry_cpu_profiler-linux-x64-glibc-*.node`). It is loaded transitively by
all 94 `initApp` test files and is NOT globally mocked. Adding a lightweight
mock in setup.ts saves the native-addon load for those 94 files AND removes
the thread-safety risk for future `threads` pool exploration.

```ts
// setup.ts — add near the top with other vi.mock calls:
vi.mock('@sentry/node', () => ({
    init: vi.fn(),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    setUser: vi.fn(),
    setTag: vi.fn(),
    setContext: vi.fn(),
    withScope: vi.fn((_cb: (scope: unknown) => void) => {}),
    startSpan: vi.fn(async (_opts: unknown, cb: () => unknown) => cb()),
    isEnabled: vi.fn().mockReturnValue(false),
    flush: vi.fn().mockResolvedValue(true),
    getCurrentScope: vi.fn().mockReturnValue({ setUser: vi.fn(), setTag: vi.fn() }),
    default: { isEnabled: vi.fn().mockReturnValue(false) }
}));
vi.mock('@sentry/profiling-node', () => ({
    nodeProfilingIntegration: vi.fn().mockReturnValue({})
}));
```

**Files to check:** `apps/api/test/lib/sentry.test.ts` already mocks
`@sentry/node` and `@sentry/profiling-node` locally — after adding the global
mock in setup.ts, that file's local mocks may need to be verified as
compatible (vi.mock in a test file overrides the setupFiles mock).

**Step 3 (individual test files): Defer `importOriginal` calls to files that truly need them.**

46 test files call `importOriginal` or `importActual` for `@repo/db`. Each
of those already pays the real db load regardless of the setup.ts change.
These should be reviewed individually for whether the `importOriginal` is
needed or can be replaced with a more targeted stub.

---

#### T-009 concrete plan — trim setup.ts per-file global setup

**Goal: remove global setup that is not needed for every file.**

1. **Remove `importOriginal('@repo/service-core')` from setup.ts** (covered by
   T-008 Step 1 above). This is the biggest trim.

2. **Move the `beforeAll env validation` to a per-suite helper** (optional,
   lower impact). The current `beforeAll` in setup.ts imports `env.ts` and calls
   `validateApiEnv()`. `env.ts` loads `@repo/config` (27 files), `dotenv`, and
   runs file-system operations (`existsSync`, `dotenv.config`). Moving this to a
   shared `beforeAll` hook in a smaller `setupFiles` or a `globalSetup.ts` that
   runs once per worker (not per file) would save ~27 module instantiations per
   file. Lower priority than T-008.

3. **Convert the `@repo/db` mock to avoid `createDbMock()` being called at mock
   registration time** (currently fine — `createDbMock()` runs inside the `async
   () =>` factory, so it runs lazily on first mock resolution, not at setup.ts
   module scope). Keep as-is.

4. **Consider splitting setup.ts into a lightweight `setup.env.ts` (env vars +
   cheap mocks) and a heavier `setup.mocks.ts` (service-core mock)**. Then
   route tests that don't need service-core could use only `setup.env.ts` via
   `setupFiles` override in their describe block or a separate vitest project
   slice. This is a larger restructuring; measure T-008 gain first.

---

#### Risk notes for T-008 / T-009

- **`vi.mock` hoisting + dynamic `import()`**: `vi.mock` calls are hoisted by
  vitest to the top of the module (like babel-jest's jest.mock). Dynamic
  `import()` inside a `vi.mock` factory is fine (it uses the transformed module
  system), but the factory must NOT reference variables declared after the mock
  call (those would be `undefined` due to hoisting). The current setup.ts
  pattern already uses this correctly.

- **`...actual` spread removal breakage**: if any test file relies on a
  service-core export that is neither a service class nor one of the listed
  enum/error stubs, removing `...actual` will cause `undefined` at runtime.
  The safe approach: run the full suite once with `...actual` replaced by the
  explicit stub list; any `TypeError: X is not a function` points to a missing
  stub. This is a bounded, enumerable set.

- **Sentry mock in setup.ts + local test override**: `sentry.test.ts` mocks
  `@sentry/node` locally. Adding a global mock in setup.ts + a local override
  in the same file is valid (the local mock takes precedence), but check that
  the global mock's shape doesn't conflict with assertions in `sentry.test.ts`
  that verify the mock was called. The local mock should completely replace the
  global one for that file.

- **`@repo/schemas` still loaded by the mock factory**: even after removing
  `importOriginal('@repo/service-core')`, the new mock factory imports enum
  values from `@repo/schemas`. That means 414 schema files still load per file
  (or per worker isolation). The alias-to-dist lever (§ above) is the path to
  cutting that cost; T-008 alone does not eliminate it.

- **Test files using `ADDON_RECALC_SOURCE_ID` etc.**: these are constants
  (`string` / plain objects). If removed from the global mock, the affected
  test files (a handful in `test/services/` and `test/cron/`) will get
  `undefined`. They should add local `vi.mock` with the literal value OR switch
  to `vi.importActual` scoped to that file. Neither is risky.

---

### Revision — partial Phase-1 measurement (2026-06-02)

Ran the `apps/api` baseline early to size the levers before committing to the
full task set. Findings (detail in §3 Measured baseline):

1. **Thesis confirmed with hard data:** >90% of api's cost is per-file
   cold-import (`collect:tests` ≈ 16:1). The premise is real.
2. **Both cheap levers fail on the bottleneck package:** `threads` segfaults;
   `isolate:false` breaks 128/268 files non-deterministically. So api's speedup
   is real engineering (Track B), not a config flip.
3. **Re-scoped into two tracks** (§3 Revised plan): Track A (concurrency cap —
   cheap, low-risk, fixes the local hang, ship first) and Track B (overhead
   reduction — gated, the real CI speedup, B2 import-graph diet before B1
   isolation remediation).
4. **Recommendation to the user:** if the dominant pain is "can't run tests
   locally", Track A alone is a fast, low-risk win. The CI speedup (Track B) is a
   genuine project — decide scope after the B2 spike sets a credible SC-2 number.
   Open question 1 below is partially answered: do **not** fix a % up front.

---

### T-010 measurement — T-008/T-009 delta (2026-06-03)

Implemented T-008 (drop `importOriginal` from global mock, mock `@sentry/node` +
`@sentry/profiling-node`) and T-009 (trim setup.ts). All 268 test files pass
(266 pass, 2 skipped) — same baseline: 4002 total tests, 0 regressions.

#### Before / After

3-consecutive-run clean measurement (no other workloads, same maxForks:3):

| Run | Wall | collect | tests | Test Files |
| --- | --- | --- | --- | --- |
| Baseline (T-007) | ~421s | **1101s** | 69s | 266 passed |
| After T-008 R1 | 406s | 1040s | 81s | 266 passed |
| After T-008 R2 | 382s | 976s | 78s | 266 passed |
| After T-008 R3 | 386s | 991s | 76s | 266 passed |
| **T-008 median** | **391s** | **1002s** | **78s** | **266 passed** |

**collect reduction: (1101−1002)/1101 = −9%**
**wall reduction: (421−391)/421 = −7%**

Earlier under-load runs (session running analysis + editors) showed collect up to
1681s — environment noise can dominate. The 3-consecutive-run figure is the
reliable signal.

**All 268 files match baseline: 266 passed, 2 skipped, 4002 tests, 0 regressions.**

#### Why the gain is small

The spec anticipated a 60%+ collect reduction by eliminating `importOriginal` from
the global `@repo/service-core` mock in `setup.ts`. The actual gain is ~5% at best.
Two root causes:

1. **42 pre-existing local `importOriginal` mocks.** Before T-008, 42 test files
   already had `vi.mock('@repo/service-core', async (importOriginal))` overrides
   that loaded the real module. These files still pay the full service-core load
   cost after T-008. They represent the bulk of the heavy integration and service
   tests (billing, addon lifecycle, webhook, conversation, etc.) — i.e., the files
   that take longest to collect. The ~213 lighter route/schema/middleware tests
   that previously loaded service-core via the global mock no longer do, but those
   were faster to begin with.

2. **12 new passthrough mocks added to restore 0 regressions.** Tests that tested
   the REAL logic of service-core functions (billing-settings, promo-code, plan,
   notification-retention, addon-expiration, etc.) needed `importOriginal` locally
   because the stub global mock broke their assertions. These 12 files now have
   `vi.mock('@repo/service-core', async (importOriginal) => ({ ...(await importOriginal()) }))`.
   Combined: 42 + 12 = **54 files still load service-core real** (was 267).

3. **`@sentry/node` + `@sentry/profiling-node` global mocks added.** These
   eliminate the native `.node` addon load for all 94 `initApp` files. The sentry
   benefit is included in the measured delta but is modest because the native-addon
   load was per-file but fast (native .node files mmap, not re-parsed).

#### Summary

T-008/T-009 reduced the population of files loading service-core real from
**267 to 54** (an 80% reduction in load count). The collect-time reduction is
small (~5%) because the 54 remaining files are the heaviest ones (they dominate
the aggregate). The 213 lighter files that no longer load service-core real save
approximately (213 × avg_service_core_load_cost), but those files were already
fast (low individual collect times).

**The alias-to-dist lever (B1 on the revised plan) remains the path to the >60%
gain** the spec targeted. If `@repo/service-core`, `@repo/schemas`, and `@repo/db`
pointed to prebuilt dist bundles, ALL 268 files (including the 54 with real module
loads) would benefit: one bundle file instead of 200+ source modules.

T-008 alone does NOT warrant skipping alias-to-dist. It is a hygiene improvement
that removes unnecessary coupling (the global mock no longer forces all 267 files
to instantiate the full service-core graph), and it documents which files genuinely
need the real module (the 54 with local `importOriginal`). This is a prerequisite
for T-005/B1: once we know which files truly need the real module, we can target
the alias-to-dist change more precisely.

---

## Closure (2026-06-04)

### Track A — Delivered (this PR)

The machine-safety concurrency cap (SC-3) is implemented and merged via
`fix/SPEC-188-track-a-concurrency-cap`:

- `vitest.shared.config.ts` — root-level single source of truth for fork-pool
  settings. `VITEST_MAX_FORKS` env knob, local default `3` (safe for 16c
  leo-laptop: turbo concurrency 4 × maxForks 3 = 12 peak processes).
- `vitest.shared.config.test.ts` — 10 tests, 100% passing, validates the env
  knob and pool structure.
- `.github/workflows/ci.yml` `test-unit` job `env:` — `VITEST_MAX_FORKS: 4`
  (each shard is an isolated VM; higher value is safe and gives throughput).
- Root `pnpm test` script — already had `--concurrency=4` as a redundant guard.
- `docs/guides/test-performance.md` — full rationale, formula, env-knobs
  reference, and re-measure procedure.

SC-3 is satisfied: the local `pnpm test` run is now bounded to 12 peak
processes (formula: `cores - 4 = 12`), preventing the OOM/hang observed
2026-06-02 on leo-laptop.

### Track B2 — Implemented, validated on branch spec/SPEC-188, NOT merged

B2 (import-graph diet, T-007/T-008/T-009/T-010) was implemented on the
`spec/SPEC-188-vitest-test-performance` branch but was NOT cherry-picked into
this PR. Reasons:

- That branch is 147 commits behind staging — a rebase is non-trivial and
  high-conflict-risk.
- The measured gain is only **~9% collect-time reduction** (1101s → 1002s,
  median over 3 consecutive runs). Wall-clock dropped ~7% (421s → 391s).
  The improvement is real but below the "back under 13-15 min/shard" target.
- The repo went public in May 2026 (revert of SPEC-179 self-hosted routing).
  With GitHub-hosted unlimited minutes, the urgency of every shard saving a
  few minutes is significantly reduced.

The B2 changes are re-applicable when the leo-laptop local runner is reused
(or if CI shard times creep up again). The audit in §3 (T-007) documents
exactly which 54 files still load service-core real and why — future work
can target those specifically.

### Four rejected levers (dead ends — documented for future reference)

1. **`pool: 'threads'` on `apps/api`** — SIGSEGV crash confirmed 2026-06-02.
   Root cause: `@sentry/profiling-node` native C++ addon + `better-auth` are
   not thread-safe under `worker_threads`. Never retry on api without first
   removing these native-addon deps from the test graph.

2. **`isolate: false` on `apps/api`** — breaks 128/268 files non-deterministically
   (851–1207 test failures across runs). Module-level singletons, unreset mocks,
   app instances leak between files. Only viable after full isolation remediation
   (Track B1 — high effort, high flake-risk, not started).

3. **`@repo/*` alias-to-dist** — would require changing `turbo.json`
   `test.dependsOn` from `build` to `^build` (adds build cost to every test
   run for all dep packages) and breaks local watch mode (stale dist). Benefit
   would be large (one bundle file instead of 200+ modules per worker), but
   the setup cost and dev-workflow regression make it a dedicated future effort.

4. **`deps.optimizer.enabled`** — the vitest transform cache already handles
   the TS→JS transform cost on warm runs. The optimizer doesn't help with
   module instantiation (the dominant cost), and enabling it caused spurious
   cache invalidation in early experiments.

### Re-apply B2 checklist (for next time)

When the branch `spec/SPEC-188-vitest-test-performance` is revisited:

1. Rebase onto current `staging` (resolve conflicts in `apps/api/test/setup.ts`
   and the 12 files with new local `vi.mock` blocks added by T-008).
2. Re-run the 3-consecutive-green measurement to confirm the ~9% baseline
   still holds (suite has grown since the measurement).
3. Decide whether to also cherry-pick `sentry` global mocks from T-008 Step 2
   (these are independent and low-risk — mock `@sentry/node` +
   `@sentry/profiling-node` globally to remove native-addon load from the
   94 `initApp` test files).
4. Open a PR to staging with the re-validated delta.
