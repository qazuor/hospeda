# Test Performance Guide

> SPEC-188 — Vitest Test-Suite Performance (Track A implemented; Track B in progress)

## Machine-Safety Concurrency Cap (SC-3)

### The problem

leo-laptop (16 cores / 62 GB) hangs and requires a hard reboot when too many
test processes run in parallel. The old layout had turbo running up to 19
packages concurrently, each vitest config spawning 3 forks — potentially
19 × 3 = 57 child processes competing for CPU, which saturated the machine.

### The formula

```
safe_ceiling = cores - 4 = 16 - 4 = 12
```

Reserve 4 cores for the OS, IDE, and turbo orchestration overhead.
The remaining 12 cores are distributed as:

```
turbo_concurrency × vitest_maxForks = 4 × 3 = 12
```

### Chosen values

| Context | turbo concurrency | VITEST_MAX_FORKS | Peak processes |
|---------|------------------|------------------|----------------|
| Local (leo-laptop) | 4 | 3 (default) | 12 |
| CI (ubuntu-latest, 1 VM/shard) | 4 (inline --concurrency=4) | 4 | 4 per shard |

Note: CI concurrency is not a safety concern because each shard runs in an
isolated VM. The higher `VITEST_MAX_FORKS=4` gives a small throughput boost.

### Where the caps live

- **vitest fork count**: `vitest.shared.config.ts` at the repo root reads the
  `VITEST_MAX_FORKS` env var and defaults to `3` when unset. All package
  `vitest.config.ts` files should extend this via `mergeConfig()` (T-014/T-015,
  Track B integration phase — not yet done for most packages).
- **turbo concurrency**: the `test` task in `turbo.json` has `"concurrency": 4`.
  The root `pnpm test` script also passes `--concurrency=4` as a redundant guard.
- **CI override**: `.github/workflows/ci.yml` `test-unit` job sets
  `VITEST_MAX_FORKS: 4` at the job level via the `env:` block.

### Overriding locally

On a beefier machine (e.g. 32 cores), you can raise the cap:

```sh
VITEST_MAX_FORKS=6 pnpm test
```

Or override turbo concurrency directly:

```sh
pnpm turbo run test --concurrency=6
```

---

## Measured Baseline (apps/api, 2026-06-02)

`apps/api` is the bottleneck package (268 files / 4002 tests).

| Config | Wall-clock | collect (CPU-agg) | tests (CPU-agg) | Result |
|--------|------------|-------------------|-----------------|--------|
| forks, isolate ON (current) | ~421s | 1101s | 69s | 266 passed |
| threads (maxThreads:3) | — | — | — | SIGSEGV crash |
| forks, isolate:false | ~52-69s | ~68-79s | 61-109s | 128/268 files fail |

`collect : tests` ratio ≈ 16:1 — over 90% of cost is per-file cold-import.

See SPEC-188 spec.md §3 for full analysis and the Track B plan.

---

## Env Knobs Reference

| Var | Default | Where set | Effect |
|-----|---------|-----------|--------|
| `VITEST_MAX_FORKS` | `3` | `vitest.shared.config.ts` | vitest fork workers per package |
| `VITEST_SHARD` | unset | CI step env | vitest shard slice (e.g. `1/4`) |
| `--concurrency` | `4` (task) | `turbo.json` + pnpm scripts | turbo parallel package limit |

---

## Re-measure Procedure

Run each step sequentially — do NOT fan out multiple packages at once locally.

```sh
# 1. Single package baseline (safe — sequential, one package at a time)
pnpm --filter @repo/schemas test 2>&1 | tee /tmp/baseline_schemas.txt
pnpm --filter @repo/utils   test 2>&1 | tee /tmp/baseline_utils.txt

# 2. apps/api baseline (heavy — expect ~400s wall-clock)
pnpm --filter hospeda-api test 2>&1 | tee /tmp/baseline_api.txt

# 3. Extract timing from vitest output
grep -E "Duration|collect|tests" /tmp/baseline_api.txt

# 4. Full suite (ONLY after SC-3 cap is in place and verified safe locally)
VITEST_MAX_FORKS=3 pnpm test
```

---

## Track B — Per-lever Validation Results

> Status: not yet started. Results will be recorded here as Track B tasks complete.

Each lever must pass 3 consecutive fully-green runs before being kept.

| Package | Lever | Run 1 | Run 2 | Run 3 | Verdict |
|---------|-------|-------|-------|-------|---------|
| (pending T-011/T-012/T-013 results) | | | | | |

---

## CI Shard Timing Baseline

> Status: not yet collected (T-002 pending).
> Pre-change shard times will be recorded here for comparison.

| Shard | Pre-change wall-clock | Post-change wall-clock | Delta |
|-------|----------------------|------------------------|-------|
| 1/4 | — | — | — |
| 2/4 | — | — | — |
| 3/4 | — | — | — |
| 4/4 | — | — | — |
